#![allow(non_snake_case)] // tên hàm COM giữ đúng như Windows (IPolicyConfig)
// di-sys: cầu nối âm lượng / thiết bị phát / mạng, thay cho scripts/system.ps1 (giữ nguyên giao thức).
// PowerShell + Add-Type tốn ~70 MB RAM chỉ để giữ vài đối tượng COM; bản Rust này chỉ vài MB.
//
// Vào (stdin), mỗi dòng một lệnh:  get | devices | net | mute | vol:<0..1> | dev:<id thiết bị>
// Ra (stdout), mỗi dòng một JSON:
//   {"type":"sys","audio":true,"vol":0.42,"mute":false,"bri":-1}        trạng thái âm lượng
//   {"type":"sys","devices":[{"id":..,"name":..,"def":true}, ...]}      thiết bị phát
//   {"type":"net","rx":<byte>,"tx":<byte>,"n":<số card>}                tổng byte đã nhận / gửi
//   {"type":"sys-error","msg":..}
// Hết stdin (app tắt) thì thoát.

use std::collections::HashSet;
use std::ffi::c_void;
use std::io::{BufRead, Write};

use serde_json::{json, Value};
use windows::core::{interface, IUnknown, IUnknown_Vtbl, GUID, HRESULT, PCWSTR};
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eMultimedia, eRender, IMMDevice, IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
};
use windows::Win32::NetworkManagement::IpHelper::{
    FreeMibTable, GetIfTable2, GetIpForwardTable2, MIB_IF_TABLE2, MIB_IPFORWARD_TABLE2,
};
use windows::Win32::Networking::WinSock::AF_UNSPEC;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED, STGM_READ,
};
use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;

fn emit(v: Value) {
    let out = std::io::stdout();
    let mut o = out.lock();
    let _ = writeln!(o, "{}", v);
    let _ = o.flush();
}

// IPolicyConfig (không công bố chính thức, Windows dùng nội bộ để đổi thiết bị phát mặc định).
// Chỉ gọi SetDefaultEndpoint; các hàm trước đó khai báo để đúng thứ tự trong vtable.
#[interface("F8679F50-850A-41CF-9C72-430F290290C8")]
unsafe trait IPolicyConfig: IUnknown {
    fn GetMixFormat(&self, n: PCWSTR, f: *mut c_void) -> HRESULT;
    fn GetDeviceFormat(&self, n: PCWSTR, d: i32, f: *mut c_void) -> HRESULT;
    fn ResetDeviceFormat(&self, n: PCWSTR) -> HRESULT;
    fn SetDeviceFormat(&self, n: PCWSTR, a: *mut c_void, b: *mut c_void) -> HRESULT;
    fn GetProcessingPeriod(&self, n: PCWSTR, d: i32, a: *mut c_void, b: *mut c_void) -> HRESULT;
    fn SetProcessingPeriod(&self, n: PCWSTR, a: *mut c_void) -> HRESULT;
    fn GetShareMode(&self, n: PCWSTR, m: *mut c_void) -> HRESULT;
    fn SetShareMode(&self, n: PCWSTR, m: *mut c_void) -> HRESULT;
    fn GetPropertyValue(&self, n: PCWSTR, fx: i32, k: *mut c_void, v: *mut c_void) -> HRESULT;
    fn SetPropertyValue(&self, n: PCWSTR, fx: i32, k: *mut c_void, v: *mut c_void) -> HRESULT;
    fn SetDefaultEndpoint(&self, n: PCWSTR, role: i32) -> HRESULT;
    fn SetEndpointVisibility(&self, n: PCWSTR, vis: i32) -> HRESULT;
}
const CLSID_POLICY_CONFIG: GUID = GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

struct Audio {
    en: IMMDeviceEnumerator,
}
impl Audio {
    fn new() -> windows::core::Result<Self> {
        let en: IMMDeviceEnumerator = unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)? };
        Ok(Audio { en })
    }
    // Thiết bị mặc định đọc lại mỗi lần: người dùng có thể vừa đổi loa / rút tai nghe
    fn default_dev(&self) -> windows::core::Result<IMMDevice> {
        unsafe { self.en.GetDefaultAudioEndpoint(eRender, eMultimedia) }
    }
    fn vol(&self) -> windows::core::Result<IAudioEndpointVolume> {
        unsafe { self.default_dev()?.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) }
    }
    fn get(&self) -> windows::core::Result<(f32, bool)> {
        let v = self.vol()?;
        unsafe { Ok((v.GetMasterVolumeLevelScalar()?, v.GetMute()?.as_bool())) }
    }
    fn set_volume(&self, x: f32) -> windows::core::Result<()> {
        let x = x.clamp(0.0, 1.0);
        let v = self.vol()?;
        unsafe {
            v.SetMasterVolumeLevelScalar(x, std::ptr::null())?;
            if x > 0.0 {
                let _ = v.SetMute(false, std::ptr::null()); // kéo âm lượng lên thì bỏ tắt tiếng
            }
        }
        Ok(())
    }
    fn toggle_mute(&self) -> windows::core::Result<()> {
        let v = self.vol()?;
        unsafe {
            let m = v.GetMute()?.as_bool();
            v.SetMute(!m, std::ptr::null())
        }
    }
    fn dev_id(d: &IMMDevice) -> String {
        unsafe {
            match d.GetId() {
                Ok(p) => {
                    let s = p.to_string().unwrap_or_default();
                    CoTaskMemFree(Some(p.0 as *const c_void));
                    s
                }
                Err(_) => String::new(),
            }
        }
    }
    fn dev_name(d: &IMMDevice) -> String {
        unsafe {
            let Ok(ps) = d.OpenPropertyStore(STGM_READ) else { return String::new() };
            let Ok(pv) = ps.GetValue(&PKEY_Device_FriendlyName) else { return String::new() };
            match PropVariantToStringAlloc(&pv) {
                Ok(p) => {
                    let s = p.to_string().unwrap_or_default();
                    CoTaskMemFree(Some(p.0 as *const c_void));
                    s
                }
                Err(_) => String::new(),
            }
        }
    }
    fn devices(&self) -> windows::core::Result<Vec<Value>> {
        let def = self.default_dev().map(|d| Self::dev_id(&d)).unwrap_or_default();
        let mut out = Vec::new();
        unsafe {
            let c = self.en.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
            for i in 0..c.GetCount()? {
                let Ok(d) = c.Item(i) else { continue };
                let id = Self::dev_id(&d);
                out.push(json!({ "id": id, "name": Self::dev_name(&d), "def": !def.is_empty() && id == def }));
            }
        }
        Ok(out)
    }
    fn set_default(&self, id: &str) -> windows::core::Result<()> {
        let w: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe {
            let pc: IPolicyConfig = CoCreateInstance(&CLSID_POLICY_CONFIG, None, CLSCTX_ALL)?;
            for role in 0..3 {
                pc.SetDefaultEndpoint(PCWSTR(w.as_ptr()), role).ok()?; // console, multimedia, communications
            }
        }
        Ok(())
    }
}

// Tổng byte nhận / gửi của các card mạng đang ra Internet: card có tuyến mặc định (0.0.0.0/0 hoặc ::/0),
// để không đếm trùng qua card ảo (Hyper-V vEthernet, VPN...), giống bản PowerShell.
fn net() -> Value {
    let mut rx = 0u64;
    let mut tx = 0u64;
    let mut n = 0;
    unsafe {
        let mut gw: HashSet<u32> = HashSet::new();
        let mut rt: *mut MIB_IPFORWARD_TABLE2 = std::ptr::null_mut();
        if GetIpForwardTable2(AF_UNSPEC, &mut rt).is_ok() && !rt.is_null() {
            let t = &*rt;
            let rows = std::slice::from_raw_parts(t.Table.as_ptr(), t.NumEntries as usize);
            for r in rows {
                if r.DestinationPrefix.PrefixLength == 0 {
                    gw.insert(r.InterfaceIndex);
                }
            }
            FreeMibTable(rt as *const c_void);
        }
        let mut it: *mut MIB_IF_TABLE2 = std::ptr::null_mut();
        if GetIfTable2(&mut it).is_ok() && !it.is_null() {
            let t = &*it;
            let rows = std::slice::from_raw_parts(t.Table.as_ptr(), t.NumEntries as usize);
            for r in rows {
                // 1 = IfOperStatusUp; bỏ loopback (24) và tunnel (131)
                if r.OperStatus.0 != 1 || r.Type == 24 || r.Type == 131 || !gw.contains(&r.InterfaceIndex) {
                    continue;
                }
                rx += r.InOctets;
                tx += r.OutOctets;
                n += 1;
            }
            FreeMibTable(it as *const c_void);
        }
    }
    json!({ "type": "net", "rx": rx as f64, "tx": tx as f64, "n": n })
}

fn round3(x: f32) -> f64 {
    ((x as f64) * 1000.0).round() / 1000.0
}

fn main() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
    let audio = Audio::new();
    let audio_err = audio.as_ref().err().map(|e| e.message().to_string()).unwrap_or_default();
    let audio = audio.ok();

    let state = |a: &Option<Audio>| {
        let mut o = json!({ "type": "sys", "audio": a.is_some(), "vol": -1, "mute": false, "bri": -1 });
        match a {
            Some(a) => match a.get() {
                Ok((v, m)) => {
                    o["vol"] = json!(round3(v));
                    o["mute"] = json!(m);
                }
                Err(e) => o["err"] = json!(e.message().to_string()),
            },
            None => o["err"] = json!(audio_err.clone()),
        }
        emit(o);
    };
    let devices = |a: &Option<Audio>| {
        let list = match a {
            Some(a) => a.devices().unwrap_or_else(|e| {
                emit(json!({ "type": "sys-error", "msg": format!("devices: {}", e.message()) }));
                Vec::new()
            }),
            None => Vec::new(),
        };
        emit(json!({ "type": "sys", "devices": list }));
    };

    state(&audio);
    devices(&audio);

    let stdin = std::io::stdin();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let cmd = line.trim();
        let r: windows::core::Result<()> = (|| {
            match cmd {
                "get" => state(&audio),
                "devices" => devices(&audio),
                "net" => emit(net()),
                "mute" => {
                    if let Some(a) = &audio {
                        a.toggle_mute()?;
                    }
                    state(&audio);
                }
                _ if cmd.starts_with("vol:") => {
                    if let (Some(a), Ok(v)) = (&audio, cmd[4..].parse::<f32>()) {
                        a.set_volume(v)?;
                    }
                }
                _ if cmd.starts_with("dev:") => {
                    if let Some(a) = &audio {
                        a.set_default(&cmd[4..])?;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(300));
                    state(&audio);
                    devices(&audio);
                }
                _ => {}
            }
            Ok(())
        })();
        if let Err(e) = r {
            emit(json!({ "type": "sys-error", "msg": format!("{}: {}", cmd, e.message()) }));
        }
    }
}
