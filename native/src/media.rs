// di-media: cầu nối giữa app và Windows, thay cho scripts/media.ps1 (giữ nguyên giao thức).
//
// Ra (stdout), mỗi dòng một JSON:
//   {"type":"media","active":true,"key":..,"title":..,"artist":..,"album":..,"app":..,"status":"Playing",
//    "pos":12.3,"dur":200.0,"upd":<unix ms>,"rate":1.0,"shuffle":false,"live":false,"thumb":"data:..."}
//   {"type":"media","active":false}
//   {"type":"cover","value":bool,"cls":"<lớp cửa sổ>"}   cửa sổ khác đang nằm dưới viên thuốc
//   {"type":"fs","value":bool}                            game / ứng dụng Direct3D toàn màn hình
//   {"type":"error","msg":..}
// Vào (stdin), mỗi dòng một lệnh:
//   play_pause | next | prev | shuffle | seek:<giây> | focus | paste | probe:<x>:<y>[;<x>:<y>...]
//   Hết stdin (app tắt, kể cả bị tắt ngang) thì thoát.
//
// Chạy: di-media.exe --parent-pid <pid của Electron>  (để bỏ qua cửa sổ của chính app khi dò cửa sổ che)

use std::io::{BufRead, Write};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use base64::Engine;
use serde_json::{json, Value};
use windows::core::PWSTR;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Session,
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionMediaProperties as Props,
};
use windows::Storage::Streams::DataReader;
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
use windows::Win32::System::Threading::{
    AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};
use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP};
use windows::Win32::UI::Shell::{SHQueryUserNotificationState, QUNS_RUNNING_D3D_FULL_SCREEN};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, EnumWindows, GetClassNameW, GetForegroundWindow, GetWindow,
    GetWindowLongW, GetWindowRect, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
    SetForegroundWindow, SetProcessDPIAware, ShowWindow, GWL_EXSTYLE, GW_OWNER, SW_RESTORE,
};

// ---------- Xuất JSON ----------
fn emit(v: Value) {
    let out = std::io::stdout();
    let mut o = out.lock();
    let _ = writeln!(o, "{}", v);
    let _ = o.flush();
}
fn log_err(m: &str) {
    let _ = writeln!(std::io::stderr(), "{}", m);
}
fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

// ---------- Phím ----------
fn press_key(vk: u8) {
    unsafe {
        keybd_event(vk, 0, KEYBD_EVENT_FLAGS(0), 0);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
    }
}
fn send_paste() {
    unsafe {
        keybd_event(0x11, 0, KEYBD_EVENT_FLAGS(0), 0); // Ctrl
        keybd_event(0x56, 0, KEYBD_EVENT_FLAGS(0), 0); // V
        keybd_event(0x56, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(0x11, 0, KEYEVENTF_KEYUP, 0);
    }
}

// ---------- Cửa sổ ----------
fn class_name(h: HWND) -> String {
    let mut buf = [0u16; 256];
    let n = unsafe { GetClassNameW(h, &mut buf) };
    String::from_utf16_lossy(&buf[..n.max(0) as usize])
}
fn window_text(h: HWND) -> String {
    let mut buf = [0u16; 512];
    let n = unsafe { GetWindowTextW(h, &mut buf) };
    String::from_utf16_lossy(&buf[..n.max(0) as usize])
}
fn is_cloaked(h: HWND) -> bool {
    let mut v: i32 = 0;
    unsafe {
        DwmGetWindowAttribute(h, DWMWA_CLOAKED, &mut v as *mut i32 as *mut _, 4).is_ok() && v != 0
    }
}
fn window_pid(h: HWND) -> u32 {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(h, Some(&mut pid)) };
    pid
}
// Tên tiến trình (không .exe) của một pid
fn process_name(pid: u32) -> Option<String> {
    unsafe {
        let hp = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let r = QueryFullProcessImageNameW(hp, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len);
        let _ = windows::Win32::Foundation::CloseHandle(hp);
        r.ok()?;
        let path = String::from_utf16_lossy(&buf[..len as usize]);
        let file = path.rsplit(['\\', '/']).next()?.to_string();
        Some(file.strip_suffix(".exe").or_else(|| file.strip_suffix(".EXE")).unwrap_or(&file).to_string())
    }
}

// Lớp của cửa sổ trên cùng tại điểm (x, y): "desk" nếu là màn hình nền/taskbar, "" nếu không có.
struct CoverQ {
    x: i32,
    y: i32,
    ignore_pid: u32,
    res: String,
}
unsafe extern "system" fn cover_cb(h: HWND, l: LPARAM) -> BOOL {
    let q = &mut *(l.0 as *mut CoverQ);
    if !IsWindowVisible(h).as_bool() || IsIconic(h).as_bool() || is_cloaked(h) {
        return true.into();
    }
    if window_pid(h) == q.ignore_pid {
        return true.into();
    }
    let ex = GetWindowLongW(h, GWL_EXSTYLE);
    // WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT
    if ex & 0x80 != 0 || ex & 0x0800_0000 != 0 || ex & 0x20 != 0 {
        return true.into();
    }
    let mut r = RECT::default();
    if GetWindowRect(h, &mut r).is_err() {
        return true.into();
    }
    if q.x < r.left || q.x >= r.right || q.y < r.top || q.y >= r.bottom {
        return true.into();
    }
    if r.right - r.left < 120 || r.bottom - r.top < 40 {
        return true.into();
    }
    let c = class_name(h);
    q.res = if matches!(c.as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd") {
        "desk".into()
    } else {
        c
    };
    false.into()
}
fn cover_at(x: i32, y: i32, ignore_pid: u32) -> String {
    let mut q = CoverQ { x, y, ignore_pid, res: String::new() };
    unsafe {
        let _ = EnumWindows(Some(cover_cb), LPARAM(&mut q as *mut CoverQ as isize));
    }
    q.res
}

// Đưa cửa sổ của trình phát lên trước. Ưu tiên cửa sổ có tiêu đề chứa tên bài (đúng tab YouTube đang phát).
struct FocusQ {
    names: Vec<String>,
    title: String,
    best: HWND,
    first: HWND,
}
unsafe extern "system" fn focus_cb(h: HWND, l: LPARAM) -> BOOL {
    let q = &mut *(l.0 as *mut FocusQ);
    if !IsWindowVisible(h).as_bool() || is_cloaked(h) {
        return true.into();
    }
    if let Ok(owner) = GetWindow(h, GW_OWNER) {
        if !owner.is_invalid() {
            return true.into(); // popup có cửa sổ chủ
        }
    }
    let text = window_text(h);
    if text.is_empty() {
        return true.into();
    }
    let Some(pn) = process_name(window_pid(h)) else { return true.into() };
    if !q.names.iter().any(|n| n.eq_ignore_ascii_case(&pn)) {
        return true.into();
    }
    if q.first.is_invalid() {
        q.first = h;
    }
    if !q.title.is_empty() && text.to_lowercase().contains(&q.title) {
        q.best = h;
        return false.into();
    }
    true.into()
}
fn focus_app(names: Vec<String>, title: &str) -> bool {
    let mut q = FocusQ { names, title: title.trim().to_lowercase(), best: HWND::default(), first: HWND::default() };
    unsafe {
        let _ = EnumWindows(Some(focus_cb), LPARAM(&mut q as *mut FocusQ as isize));
        let w = if !q.best.is_invalid() { q.best } else { q.first };
        if w.is_invalid() {
            return false;
        }
        if IsIconic(w).as_bool() {
            let _ = ShowWindow(w, SW_RESTORE);
        }
        // Windows chỉ cho tiến trình đang nhận input đổi cửa sổ trước: tạm gắn vào luồng của cửa sổ đang ở trước
        let fg = GetForegroundWindow();
        let fg_thread = GetWindowThreadProcessId(fg, None);
        let me = GetCurrentThreadId();
        let attached = fg_thread != 0 && fg_thread != me && AttachThreadInput(me, fg_thread, true).as_bool();
        let _ = BringWindowToTop(w);
        let _ = SetForegroundWindow(w);
        if attached {
            let _ = AttachThreadInput(me, fg_thread, false);
        }
        if GetForegroundWindow() != w {
            keybd_event(0x12, 0, KEYBD_EVENT_FLAGS(0), 0); // dự phòng: nhấn Alt để được đổi cửa sổ trước
            let _ = SetForegroundWindow(w);
            keybd_event(0x12, 0, KEYEVENTF_KEYUP, 0);
        }
        true
    }
}
// Đoán tên tiến trình từ AUMID của phiên nhạc
fn player_names(aumid: &str) -> Vec<String> {
    let a = aumid.to_lowercase();
    let v: &[&str] = if a.contains("spotify") {
        &["Spotify"]
    } else if a.contains("msedge") {
        &["msedge"]
    } else if a.contains("chrome") {
        &["chrome"]
    } else if a.contains("firefox") || a == "308046b0af4a39cb" {
        &["firefox"]
    } else if a.contains("brave") {
        &["brave"]
    } else if a.contains("opera") {
        &["opera"]
    } else if a.contains("coccoc") {
        &["browser"]
    } else {
        // "app.exe" hoặc "Hang.App_xxx!App": lấy phần tên
        let n = a.strip_suffix(".exe").unwrap_or(&a);
        let n = n.rsplit('!').next().unwrap_or(n).to_string();
        let short = n.rsplit('.').next().unwrap_or(&n).to_string();
        return vec![n, short];
    };
    v.iter().map(|s| s.to_string()).collect()
}

// ---------- Nhạc (Windows Media Session) ----------
const TICKS_1601_TO_1970: i64 = 116_444_736_000_000_000;

fn status_name(v: i32) -> &'static str {
    match v {
        0 => "Closed",
        1 => "Opened",
        2 => "Changing",
        3 => "Stopped",
        4 => "Playing",
        5 => "Paused",
        _ => "Unknown",
    }
}

// Ảnh bìa dạng data URL; "" nếu chưa có (ứng dụng có thể gửi ảnh trễ hơn tên bài)
fn read_thumb(props: &Props) -> windows::core::Result<String> {
    let r = props.Thumbnail()?;
    let s = r.OpenReadAsync()?.get()?;
    let size = s.Size()? as u32;
    if size < 100 {
        return Ok(String::new());
    }
    let mime = s.ContentType().map(|h| h.to_string()).unwrap_or_default();
    let reader = DataReader::CreateDataReader(&s)?;
    let n = reader.LoadAsync(size)?.get()?;
    let mut buf = vec![0u8; n as usize];
    reader.ReadBytes(&mut buf)?;
    let mime = if mime.is_empty() { "image/jpeg".to_string() } else { mime };
    Ok(format!("data:{};base64,{}", mime, base64::engine::general_purpose::STANDARD.encode(&buf)))
}

struct MediaState {
    last_key: String,
    thumb_ok: bool,
    thumb_tries: u32,
}

fn poll_media(mgr: &Manager, ms: &mut MediaState) -> windows::core::Result<()> {
    let Ok(s) = mgr.GetCurrentSession() else {
        ms.last_key.clear();
        emit(json!({ "type": "media", "active": false }));
        return Ok(());
    };
    let props = s.TryGetMediaPropertiesAsync()?.get()?;
    let pb = s.GetPlaybackInfo()?;
    let tl = s.GetTimelineProperties()?;
    let app = s.SourceAppUserModelId()?.to_string();
    let title = props.Title()?.to_string();
    let artist = props.Artist()?.to_string();
    let album = props.AlbumTitle().map(|h| h.to_string()).unwrap_or_default();
    let key = format!("{}|{}|{}", app, title, artist);

    let start = tl.StartTime()?.Duration;
    let end = tl.EndTime()?.Duration;
    let pos = tl.Position()?.Duration;
    let upd = tl
        .LastUpdatedTime()
        .ok()
        .map(|d| (d.UniversalTime - TICKS_1601_TO_1970) / 10_000)
        .filter(|ms| *ms > 946_684_800_000) // sau năm 2000 mới tin
        .unwrap_or(0);
    let rate = pb.PlaybackRate().and_then(|r| r.Value()).unwrap_or(1.0);
    let shuffle = pb.IsShuffleActive().and_then(|r| r.Value()).unwrap_or(false);
    let status = status_name(pb.PlaybackStatus()?.0);

    let mut msg = json!({
        "type": "media", "active": true, "key": key, "title": title, "artist": artist, "album": album,
        "app": app, "status": status,
        "pos": round2((pos - start) as f64 / 1e7),
        "dur": if end > start { round2((end - start) as f64 / 1e7) } else { 0.0 },
        "upd": upd, "rate": rate, "shuffle": shuffle,
        // Livestream (YouTube live trên trình duyệt...): Chromium báo thời lượng vô hạn -> EndTime âm
        "live": end - start < 0,
    });
    if key != ms.last_key {
        ms.last_key = key;
        ms.thumb_ok = false;
        ms.thumb_tries = 0;
        msg["thumb"] = json!("");
    }
    // Ảnh bìa thường đến trễ hơn tên bài (Spotify, YouTube): thử lại mỗi lần hỏi, tối đa 40 lần
    if !ms.thumb_ok && ms.thumb_tries < 40 {
        ms.thumb_tries += 1;
        match read_thumb(&props) {
            Ok(t) if !t.is_empty() => {
                ms.thumb_ok = true;
                msg["thumb"] = json!(t);
            }
            Ok(_) => {}
            Err(e) => {
                if ms.thumb_tries <= 2 && e.code().0 != 0 {
                    log_err(&format!("thumb: {}", e.message()));
                }
            }
        }
    }
    emit(msg);
    Ok(())
}

// "x1:y1;x2:y2;..." -> các điểm dò cửa sổ che (bỏ qua điểm sai định dạng)
fn parse_probe(s: &str) -> Vec<(i32, i32)> {
    s.split(';')
        .filter_map(|p| {
            let mut it = p.split(':').map(|v| v.trim().parse::<i32>());
            match (it.next(), it.next()) {
                (Some(Ok(x)), Some(Ok(y))) => Some((x, y)),
                _ => None,
            }
        })
        .collect()
}

fn run_command(mgr: Option<&Manager>, cmd: &str) {
    if cmd == "paste" {
        std::thread::sleep(Duration::from_millis(80));
        send_paste();
        return;
    }
    let s: Option<Session> = mgr.and_then(|m| m.GetCurrentSession().ok());
    if cmd == "focus" {
        if let Some(s) = s {
            let aumid = s.SourceAppUserModelId().map(|h| h.to_string()).unwrap_or_default();
            let title = s
                .TryGetMediaPropertiesAsync()
                .and_then(|a| a.get())
                .and_then(|p| p.Title())
                .map(|h| h.to_string())
                .unwrap_or_default();
            let ok = focus_app(player_names(&aumid), &title);
            // Không có cửa sổ hiện (vd. Spotify đang ẩn dưới khay): kích hoạt lại ứng dụng đóng gói qua shell
            if !ok && aumid.contains('!') {
                let _ = std::process::Command::new("explorer.exe").arg(format!("shell:AppsFolder\\{}", aumid)).spawn();
            }
        }
        return;
    }
    if let Some(s) = &s {
        // Ok(true): trình phát nhận lệnh; Ok(false): trình phát từ chối (Windows trả về false)
        let r: windows::core::Result<bool> = (|| {
            Ok(match cmd {
                "play_pause" => s.TryTogglePlayPauseAsync()?.get()?,
                "next" => s.TrySkipNextAsync()?.get()?,
                "prev" => s.TrySkipPreviousAsync()?.get()?,
                "shuffle" => {
                    let cur = s.GetPlaybackInfo()?.IsShuffleActive().and_then(|r| r.Value()).unwrap_or(false);
                    s.TryChangeShuffleActiveAsync(!cur)?.get()?
                }
                _ if cmd.starts_with("seek:") => {
                    let sec: f64 = cmd[5..].parse().unwrap_or(0.0);
                    let start = s.GetTimelineProperties()?.StartTime()?.Duration;
                    s.TryChangePlaybackPositionAsync(start + (sec * 1e7) as i64)?.get()?
                }
                _ => true,
            })
        })();
        match r {
            Ok(true) => return,
            Ok(false) => log_err(&format!("cmd {}: trinh phat tu choi, dung phim media", cmd)),
            Err(e) => log_err(&format!("cmd {}: {}", cmd, e.message())),
        }
    }
    // Dự phòng: phím media của bàn phím
    match cmd {
        "play_pause" => press_key(0xB3),
        "next" => press_key(0xB0),
        "prev" => press_key(0xB1),
        _ => {}
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let parent_pid: u32 = args
        .iter()
        .position(|a| a.eq_ignore_ascii_case("--parent-pid") || a.eq_ignore_ascii_case("-ParentPid"))
        .and_then(|i| args.get(i + 1))
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    unsafe {
        let _ = SetProcessDPIAware();
        let _ = RoInitialize(RO_INIT_MULTITHREADED);
    }

    // Đọc lệnh ở luồng riêng
    let (tx, rx) = mpsc::channel::<String>();
    std::thread::spawn(move || {
        let stdin = std::io::stdin();
        for line in stdin.lock().lines() {
            match line {
                Ok(l) => { if tx.send(l.trim().to_string()).is_err() { return; } }
                Err(_) => break,
            }
        }
        let _ = tx.send("__quit__".into());
    });

    let mgr = match Manager::RequestAsync().and_then(|a| a.get()) {
        Ok(m) => Some(m),
        Err(e) => {
            emit(json!({ "type": "error", "msg": format!("Khong doc duoc nhac: {}", e.message()) }));
            None
        }
    };

    let mut ms = MediaState { last_key: String::new(), thumb_ok: false, thumb_tries: 0 };
    let mut probe: Vec<(i32, i32)> = Vec::new();
    let mut last_cover: Option<bool> = None;
    let mut last_fs: Option<bool> = None;
    let mut burst = 0u32;
    let mut next_media = Instant::now();
    let mut next_fs = Instant::now();
    let mut next_cover = Instant::now();

    loop {
        // Chờ lệnh tối đa 200 ms (nhịp như bản PowerShell)
        match rx.recv_timeout(Duration::from_millis(200)) {
            Ok(cmd) => {
                if cmd == "__quit__" { break; }
                if let Some(rest) = cmd.strip_prefix("probe:") {
                    probe = parse_probe(rest);
                    last_cover = None;
                } else if !cmd.is_empty() {
                    run_command(mgr.as_ref(), &cmd);
                    burst = 4; // phát lại trạng thái vài lần liên tiếp sau lệnh
                    next_media = Instant::now();
                }
                // còn lệnh trong hàng đợi thì xử lý tiếp ngay
                while let Ok(c) = rx.try_recv() {
                    if c == "__quit__" { return; }
                    if let Some(rest) = c.strip_prefix("probe:") {
                        probe = parse_probe(rest);
                        last_cover = None;
                    } else if !c.is_empty() {
                        run_command(mgr.as_ref(), &c);
                        burst = 4;
                    }
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
        let now = Instant::now();

        // --- Trạng thái nhạc: mỗi ~1 giây, hoặc liên tục 200 ms sau khi có lệnh ---
        if now >= next_media {
            if let Some(m) = &mgr {
                if let Err(e) = poll_media(m, &mut ms) {
                    emit(json!({ "type": "error", "msg": format!("Nhac: {}", e.message()) }));
                }
            }
            let gap = if burst > 0 { burst -= 1; 200 } else { 1000 };
            next_media = now + Duration::from_millis(gap);
        }

        // --- Có cửa sổ nào đang đè lên viên thuốc (trình duyệt phóng to, ứng dụng toàn màn hình...) ---
        // Dò nhiều điểm dọc viên thuốc: bị che nếu bất kỳ điểm nào có cửa sổ (không phải màn hình nền)
        if !probe.is_empty() {
            if now >= next_cover {
                let mut cls = String::new();
                for &(x, y) in &probe {
                    let c = cover_at(x, y, parent_pid);
                    if !c.is_empty() && c != "desk" { cls = c; break; }
                }
                let cov = !cls.is_empty();
                if last_cover != Some(cov) {
                    last_cover = Some(cov);
                    emit(json!({ "type": "cover", "value": cov, "cls": cls }));
                }
                next_cover = now + Duration::from_millis(200);
            }
        }

        // --- Game / ứng dụng Direct3D toàn màn hình: ẩn hẳn ---
        if now >= next_fs {
            if let Ok(st) = unsafe { SHQueryUserNotificationState() } {
                let fs = st == QUNS_RUNNING_D3D_FULL_SCREEN;
                if last_fs != Some(fs) {
                    last_fs = Some(fs);
                    emit(json!({ "type": "fs", "value": fs }));
                }
            }
            next_fs = now + Duration::from_millis(1600);
        }
    }
}
