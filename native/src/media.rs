// di-media: cầu nối giữa app và Windows, thay cho scripts/media.ps1 (giữ nguyên giao thức).
//
// Ra (stdout), mỗi dòng một JSON:
//   {"type":"media","active":true,"key":..,"title":..,"artist":..,"album":..,"app":..,"status":"Playing",
//    "pos":12.3,"dur":200.0,"upd":<unix ms>,"rate":1.0,"shuffle":false,"live":false,"thumb":"data:..."}
//   {"type":"media","active":false}
//   {"type":"cover","value":bool,"cls":"<lớp cửa sổ>"}   cửa sổ khác đang nằm dưới viên thuốc
//   {"type":"tabs","value":bool}                          có tab (thanh tab trình duyệt...) nằm ngay dưới viên thuốc
//   {"type":"fs","value":bool}                            game / ứng dụng Direct3D toàn màn hình
//   {"type":"full","value":bool}                          cửa sổ dưới viên thuốc đang toàn màn hình (video, trình chiếu...)
//   {"type":"lbtn","value":bool}                          chuột trái đang được giữ (đang kéo thả tệp...)
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
    hwnd: HWND,
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
    q.hwnd = h;
    q.res = if matches!(c.as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd") {
        "desk".into()
    } else {
        c
    };
    false.into()
}
fn cover_at(x: i32, y: i32, ignore_pid: u32) -> (String, HWND) {
    let mut q = CoverQ { x, y, ignore_pid, res: String::new(), hwnd: HWND::default() };
    unsafe {
        let _ = EnumWindows(Some(cover_cb), LPARAM(&mut q as *mut CoverQ as isize));
    }
    (q.res, q.hwnd)
}

// ---------- Tab nằm dưới viên thuốc (UI Automation) ----------
// Cửa sổ bên dưới có thanh tab (Chrome/Edge/Brave, Explorer...): đọc khung chữ nhật của từng tab, xem có tab nào
// chồng lên vùng viên thuốc không. Danh sách tab lưu lại ~3 giây (chỉ đọc lại vị trí mỗi lần), đổi cửa sổ thì đọc lại.
// Chỉ duyệt khung giao diện, bỏ qua nội dung trang web (Document) cho nhanh.
struct TabProbe {
    uia: Option<windows::Win32::UI::Accessibility::IUIAutomation>,
    win: HWND,
    tabs: Vec<IUIAutomationElement>,
    at: Option<Instant>,
}
impl TabProbe {
    fn new() -> Self { TabProbe { uia: None, win: HWND::default(), tabs: Vec::new(), at: None } }
    fn rescan(&mut self, w: HWND) {
        use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};
        use windows::Win32::UI::Accessibility::{CUIAutomation, UIA_DocumentControlTypeId, UIA_TabItemControlTypeId};
        self.win = w;
        self.tabs.clear();
        self.at = Some(Instant::now());
        unsafe {
            if self.uia.is_none() {
                self.uia = CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).ok();
            }
            let Some(uia) = &self.uia else { return };
            let Ok(walker) = uia.ControlViewWalker() else { return };
            let Ok(root) = uia.ElementFromHandle(w) else { return };
            let mut queue = std::collections::VecDeque::from([(root, 0u32)]);
            let mut seen = 0;
            while let Some((el, depth)) = queue.pop_front() {
                seen += 1;
                if seen > 500 { break; }
                let ct = el.CurrentControlType().unwrap_or_default();
                if ct == UIA_TabItemControlTypeId { self.tabs.push(el); continue; }
                if ct == UIA_DocumentControlTypeId || depth >= 14 { continue; }
                let mut child = walker.GetFirstChildElement(&el).ok();
                while let Some(c) = child {
                    child = walker.GetNextSiblingElement(&c).ok();
                    queue.push_back((c, depth + 1));
                }
            }
        }
    }
    // (x0..x1, y): vùng ngang của viên thuốc và cạnh dưới của nó (toạ độ màn hình)
    fn hit(&mut self, w: HWND, x0: i32, x1: i32, y: i32) -> bool {
        if w.is_invalid() { self.win = HWND::default(); self.tabs.clear(); return false; }
        let stale = self.at.map_or(true, |t| t.elapsed() > Duration::from_millis(3000));
        if w != self.win || stale { self.rescan(w); }
        for t in &self.tabs {
            let Ok(r) = (unsafe { t.CurrentBoundingRectangle() }) else { continue };
            if r.right <= r.left || r.bottom <= r.top { continue; } // tab bị ẩn / cuộn khuất
            if r.right > x0 && r.left < x1 && r.top <= y && r.bottom >= y - 40 { return true; }
        }
        false
    }
}
// Lớp cửa sổ có thanh tab đáng dò: Chromium (Chrome, Edge, Brave, Cốc Cốc...), Firefox, Explorer.
// Các cửa sổ khác (game, ứng dụng toàn màn hình...) bỏ qua: không gọi UI Automation, tránh chậm hoặc treo.
fn tabbed_class(c: &str) -> bool {
    matches!(c, "Chrome_WidgetWin_1" | "MozillaWindowClass" | "CabinetWClass")
}
// Luồng dò tab: nhận (hwnd, x0, x1, y), hwnd = 0 nghĩa là không có cửa sổ có tab bên dưới.
// Chạy riêng để UI Automation chậm (trình duyệt vừa bật trợ năng...) không làm đứng cập nhật nhạc.
// Theo dõi nút chuột trái (25 lần/giây, luồng riêng): báo khi bấm / thả. App dùng để biết người dùng đang kéo
// thứ gì đó (tệp từ Explorer...) tới viên thuốc, kể cả khi viên thuốc đang thu thành vạch và không nhận chuột.
fn spawn_button_watch() {
    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
    std::thread::spawn(|| {
        let mut last = false;
        loop {
            // Nút chính có thể là nút phải nếu người dùng đổi tay trái: GetAsyncKeyState theo nút vật lý,
            // VK_LBUTTON (0x01) luôn là nút chính theo tài liệu Windows
            let down = unsafe { GetAsyncKeyState(0x01) } as u16 & 0x8000 != 0;
            if down != last {
                last = down;
                emit(json!({ "type": "lbtn", "value": down }));
            }
            std::thread::sleep(Duration::from_millis(40));
        }
    });
}

fn spawn_tab_worker() -> mpsc::SyncSender<(isize, i32, i32, i32)> {
    let (tx, rx) = mpsc::sync_channel::<(isize, i32, i32, i32)>(1);
    std::thread::spawn(move || {
        unsafe {
            use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
        let mut tp = TabProbe::new();
        let mut last: Option<bool> = None;
        let mut seen: (bool, u32) = (false, 0); // kết quả gần nhất + số lần liền nhau (chống nhấp nháy)
        while let Ok((h, x0, x1, y)) = rx.recv() {
            let t = h != 0 && tp.hit(HWND(h as *mut _), x0, x1, y);
            seen = if seen.0 == t { (t, seen.1 + 1) } else { (t, 1) };
            if seen.1 >= 2 && last != Some(t) {
                last = Some(t);
                emit(json!({ "type": "tabs", "value": t }));
            }
        }
    });
    tx
}

// Đưa cửa sổ của trình phát lên trước. Ưu tiên cửa sổ có tiêu đề chứa tên bài (đúng tab YouTube đang phát).
struct FocusQ {
    names: Vec<String>,
    title: String,
    best: HWND,
    first: HWND,
    all: Vec<HWND>, // mọi cửa sổ của trình phát (trình duyệt có thể có nhiều cửa sổ)
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
    q.all.push(h);
    if q.best.is_invalid() && !q.title.is_empty() && text.to_lowercase().contains(&q.title) {
        q.best = h;
    }
    true.into()
}

// ---------- Chọn đúng tab đang phát trong trình duyệt (UI Automation) ----------
// Tiêu đề cửa sổ trình duyệt chỉ là tab đang mở; tab đang phát có thể nằm sau. Đọc thanh tab qua UI Automation:
// tìm tab có tên chứa tên bài, không có thì tab mang nhãn "đang phát âm thanh", rồi chọn tab đó.
// Chỉ duyệt khung giao diện (bỏ qua nội dung trang web - Document) để nhanh và không bật chế độ trợ năng của trang.
const AUDIO_TAB_MARKS: [&str; 3] = ["audio playing", "đang phát âm thanh", "playing audio"];
use windows::Win32::UI::Accessibility::IUIAutomationElement;
struct Tab {
    win: HWND,
    el: IUIAutomationElement,
    name: String,  // tên gốc của tab
    lower: String, // tên viết thường để so khớp
    audible: bool, // có nhãn "đang phát âm thanh"
}
// Đọc mọi tab trên thanh tab của các cửa sổ trình duyệt
fn scan_tabs(wins: &[HWND]) -> Vec<Tab> {
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};
    use windows::Win32::UI::Accessibility::{CUIAutomation, IUIAutomation, UIA_DocumentControlTypeId, UIA_TabItemControlTypeId};
    let mut out = Vec::new();
    unsafe {
        let Ok(uia) = CoCreateInstance::<_, IUIAutomation>(&CUIAutomation, None, CLSCTX_INPROC_SERVER) else { return out };
        let Ok(walker) = uia.ControlViewWalker() else { return out };
        for &w in wins {
            let Ok(root) = uia.ElementFromHandle(w) else { continue };
            let mut queue = std::collections::VecDeque::from([(root, 0u32)]);
            let mut seen = 0;
            while let Some((el, depth)) = queue.pop_front() {
                seen += 1;
                if seen > 600 { break; }
                let ct = el.CurrentControlType().unwrap_or_default();
                if ct == UIA_TabItemControlTypeId {
                    let name = el.CurrentName().map(|b| b.to_string()).unwrap_or_default();
                    let lower = name.to_lowercase();
                    let audible = AUDIO_TAB_MARKS.iter().any(|m| lower.contains(m));
                    out.push(Tab { win: w, el: el.clone(), name, lower, audible });
                    continue;
                }
                if ct == UIA_DocumentControlTypeId || depth >= 14 { continue; }
                let mut child = walker.GetFirstChildElement(&el).ok();
                while let Some(c) = child {
                    child = walker.GetNextSiblingElement(&c).ok();
                    queue.push_back((c, depth + 1));
                }
            }
        }
    }
    out
}
// Tên tab -> tên hiển thị: bỏ "(41) " ở đầu và phần trình duyệt thêm vào sau (" - YouTube", " - Audio playing", " - Memory usage"...)
fn clean_tab_name(name: &str) -> String {
    let mut s = name.trim();
    if s.starts_with('(') {
        if let Some(i) = s.find(") ") { if s[1..i].chars().all(|c| c.is_ascii_digit() || c == '+') { s = &s[i + 2..]; } }
    }
    let lower = s.to_lowercase();
    let cut = [" - audio playing", " - đang phát âm thanh", " - playing audio", " - high memory usage", " - memory usage", " - youtube"]
        .iter().filter_map(|m| lower.find(m)).min();
    match cut { Some(i) => s[..i].trim().to_string(), None => s.to_string() }
}
// Chọn tab có tên chứa tên bài; không có thì tab đang phát âm thanh. Trả về cửa sổ chứa tab.
fn select_media_tab(wins: &[HWND], title: &str) -> Option<HWND> {
    use windows::Win32::UI::Accessibility::{IUIAutomationSelectionItemPattern, UIA_SelectionItemPatternId};
    let title = title.trim().to_lowercase();
    let tabs = scan_tabs(wins);
    let t = tabs.iter().find(|t| !title.is_empty() && t.lower.contains(&title)).or_else(|| tabs.iter().find(|t| t.audible))?;
    unsafe {
        let pat: IUIAutomationSelectionItemPattern = t.el.GetCurrentPatternAs(UIA_SelectionItemPatternId).ok()?;
        pat.Select().ok()?;
    }
    Some(t.win)
}
// Mọi cửa sổ của các tiến trình có tên trong names
fn app_windows(names: Vec<String>) -> Vec<HWND> {
    let mut q = FocusQ { names, title: String::new(), best: HWND::default(), first: HWND::default(), all: Vec::new() };
    unsafe { let _ = EnumWindows(Some(focus_cb), LPARAM(&mut q as *mut FocusQ as isize)); }
    q.all
}

fn focus_app(names: Vec<String>, title: &str, browser: bool) -> bool {
    let mut q = FocusQ { names, title: title.trim().to_lowercase(), best: HWND::default(), first: HWND::default(), all: Vec::new() };
    unsafe {
        let _ = EnumWindows(Some(focus_cb), LPARAM(&mut q as *mut FocusQ as isize));
        let mut w = if !q.best.is_invalid() { q.best } else { q.first };
        if w.is_invalid() {
            return false;
        }
        // Trình duyệt: chuyển sang đúng tab đang phát (và đúng cửa sổ chứa tab đó)
        if browser {
            let mut order = q.all.clone();
            if let Some(i) = order.iter().position(|&x| x == w) { order.swap(0, i); } // xét cửa sổ khớp tiêu đề trước
            match select_media_tab(&order, title) {
                Some(tw) => w = tw,
                None => log_err("focus: khong tim thay tab dang phat, chi mo cua so trinh duyet"),
            }
        }
        bring_front(w);
        true
    }
}
fn bring_front(w: HWND) {
    unsafe {
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
    }
}

// Cửa sổ đang ở chế độ toàn màn hình: phủ kín đúng màn hình chứa nó (kể cả chỗ của taskbar) và không phải
// cửa sổ phóng to thường. Gồm video toàn màn hình trên trình duyệt (YouTube, Netflix...), VLC, PowerPoint trình chiếu,
// game cửa sổ không viền.
fn is_fullscreen_win(w: HWND) -> bool {
    use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONULL};
    use windows::Win32::UI::WindowsAndMessaging::GWL_STYLE;
    if w.is_invalid() {
        return false;
    }
    unsafe {
        let c = class_name(w);
        if matches!(c.as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd") {
            return false;
        }
        // Cửa sổ thường (kể cả phóng to, khi taskbar tự ẩn cũng phủ kín màn hình) có thanh tiêu đề WS_CAPTION;
        // toàn màn hình thì bỏ (trình duyệt vẫn giữ cờ WS_MAXIMIZE khi xem video toàn màn hình nên không dựa vào cờ đó)
        if GetWindowLongW(w, GWL_STYLE) as u32 & 0x00C0_0000 == 0x00C0_0000 {
            return false;
        }
        let mut r = RECT::default();
        if GetWindowRect(w, &mut r).is_err() {
            return false;
        }
        let mon = MonitorFromWindow(w, MONITOR_DEFAULTTONULL);
        if mon.is_invalid() {
            return false;
        }
        let mut mi = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
        if !GetMonitorInfoW(mon, &mut mi).as_bool() {
            return false;
        }
        let m = mi.rcMonitor;
        // Chrome/Brave toàn màn hình chừa hụt 1 điểm ảnh ở cạnh dưới (để taskbar tự ẩn vẫn bật lên được): cho sai số 2px
        r.left <= m.left + 2 && r.top <= m.top + 2 && r.right >= m.right - 2 && r.bottom >= m.bottom - 2
    }
}
// Cửa sổ đang ở trước là game / ứng dụng toàn màn hình (không chuyển cửa sổ khi đó)
fn fg_fullscreen() -> bool {
    unsafe {
        SHQueryUserNotificationState().map_or(false, |s| s == QUNS_RUNNING_D3D_FULL_SCREEN)
            || is_fullscreen_win(GetForegroundWindow())
    }
}

// Phần tử đang nhận bàn phím (UI Automation) là ô nhập chữ
fn focus_is_text() -> bool {
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};
    use windows::Win32::UI::Accessibility::{CUIAutomation, IUIAutomation, UIA_ComboBoxControlTypeId, UIA_EditControlTypeId};
    unsafe {
        let Ok(uia) = CoCreateInstance::<_, IUIAutomation>(&CUIAutomation, None, CLSCTX_INPROC_SERVER) else { return false };
        let Ok(el) = uia.GetFocusedElement() else { return false };
        let ct = el.CurrentControlType().unwrap_or_default();
        ct == UIA_EditControlTypeId || ct == UIA_ComboBoxControlTypeId
    }
}

// YouTube trên trình duyệt không đăng ký "bài sau / bài trước" với Windows khi phát video lẻ (ngoài danh sách phát).
// Dùng phím tắt của chính YouTube: tạm chọn tab YouTube đang phát, gửi Shift+N (bài sau) / Shift+P (bài trước),
// rồi trả lại tab đang xem và cửa sổ đang dùng. Bỏ qua khi đang ở game / ứng dụng toàn màn hình.
fn yt_skip(aumid: &str, title: &str, vk: u8) -> bool {
    use windows::Win32::UI::Accessibility::{IUIAutomationSelectionItemPattern, UIA_SelectionItemPatternId};
    use windows::Win32::UI::WindowsAndMessaging::SW_MINIMIZE;
    let (names, browser) = player_names(aumid);
    if !browser {
        return false;
    }
    if fg_fullscreen() {
        log_err("yt: dang o ung dung toan man hinh, khong chuyen bai");
        return false;
    }
    let tabs = scan_tabs(&app_windows(names));
    let tl = title.trim().to_lowercase();
    let Some(ti) = tabs
        .iter()
        .position(|t| !tl.is_empty() && t.lower.contains(&tl))
        .or_else(|| tabs.iter().position(|t| t.audible))
    else {
        log_err("yt: khong tim thay tab dang phat");
        return false;
    };
    let t = &tabs[ti];
    if !t.lower.contains("youtube") {
        return false;
    }
    unsafe {
        let pat = |el: &IUIAutomationElement| el.GetCurrentPatternAs::<IUIAutomationSelectionItemPattern>(UIA_SelectionItemPatternId).ok();
        // Tab đang được chọn trong cùng cửa sổ, để trả lại sau
        let old_tab = tabs.iter().position(|o| {
            o.win == t.win && pat(&o.el).and_then(|p| p.CurrentIsSelected().ok()).map_or(false, |b| b.as_bool())
        });
        let old_fg = GetForegroundWindow();
        let was_min = IsIconic(t.win).as_bool();
        let Some(p) = pat(&t.el) else { return false };
        if p.Select().is_err() {
            return false;
        }
        bring_front(t.win);
        std::thread::sleep(Duration::from_millis(160));
        // Con trỏ đang ở ô nhập chữ (thanh địa chỉ, ô tìm kiếm YouTube, ô bình luận...): Shift+N sẽ gõ chữ "N"
        // vào đó thay vì chuyển bài -> không gửi phím, chỉ trả lại tab / cửa sổ như cũ
        let typing = focus_is_text();
        if typing {
            log_err("yt: con tro dang o o nhap chu, khong gui phim chuyen bai");
        } else {
            keybd_event(0x10, 0, KEYBD_EVENT_FLAGS(0), 0); // Shift
            keybd_event(vk, 0, KEYBD_EVENT_FLAGS(0), 0);
            keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(0x10, 0, KEYEVENTF_KEYUP, 0);
            std::thread::sleep(Duration::from_millis(140));
        }
        if let Some(oi) = old_tab.filter(|&oi| oi != ti) {
            if let Some(op) = pat(&tabs[oi].el) {
                let _ = op.Select();
            }
        }
        if was_min {
            let _ = ShowWindow(t.win, SW_MINIMIZE);
        }
        if !old_fg.is_invalid() && old_fg != t.win {
            bring_front(old_fg);
        }
    }
    true
}
// Đoán tên tiến trình từ AUMID của phiên nhạc; kèm cờ "là trình duyệt" (để chọn đúng tab)
const BROWSERS: [&str; 6] = ["msedge", "chrome", "firefox", "brave", "opera", "browser"];
fn player_names(aumid: &str) -> (Vec<String>, bool) {
    let names = player_names_only(aumid);
    let browser = names.iter().any(|n| BROWSERS.iter().any(|b| n.eq_ignore_ascii_case(b)));
    (names, browser)
}
fn player_names_only(aumid: &str) -> Vec<String> {
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
    cur_thumb: u64,    // băm ảnh bìa đã nhận cho bài hiện tại
    prev_thumb: u64,   // băm ảnh bìa của bài trước (để nhận ra ảnh cũ chưa kịp đổi)
    thumb_str: String, // ảnh bìa (data URL) của phiên hiện tại, để gửi lại khi cần
    emitted_key: String, // key đã gửi cho giao diện lần cuối (đổi thì gửi kèm ảnh bìa)
    // Trình duyệt chỉ báo cho Windows MỘT nguồn: tab vừa phát gần nhất, kể cả video tắt tiếng (vd. reel Instagram
    // tự chạy). Đọc thanh tab để biết tab nào thật sự có tiếng; nhớ nguồn có tiếng gần nhất để hiện tiếp.
    tabs: Vec<(String, String, bool)>, // (tên gốc, tên thường, có tiếng)
    tabs_at: Option<Instant>,
    tabs_key: String,
    good: Option<(Value, String, String, Instant)>, // (tin nhắn, ảnh bìa, tên thường, lúc ghi) của nguồn có tiếng gần nhất
    override_title: Option<String>, // đang hiện nguồn có tiếng thay cho nguồn Windows báo: tên tab cần mở khi bấm ảnh bìa
}
fn hash_str(s: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    s.hash(&mut h);
    h.finish()
}
// Sau khi đổi bài, ảnh giống hệt bài trước thì coi như chưa có ảnh mới, đọc lại trong ~8 lần hỏi (~1,6 giây ở nhịp nhanh)
const STALE_TRIES: u32 = 8;
// Đang chờ ảnh bìa của bài mới: hỏi nhanh (200 ms) trong ~25 lần đầu (~5 giây), sau đó về nhịp 1 giây
const FAST_THUMB_TRIES: u32 = 25;

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

    // Livestream / truyền hình trực tiếp:
    // - YouTube live trên Chromium: thời lượng vô hạn -> EndTime âm
    // - Kênh HLS (TV360, FPT Play...): thời lượng 2^32 giây (~136 năm) và vị trí là giờ thực (giây Unix)
    // Không bài hát / video thường nào dài quá 30 ngày.
    let live = is_live(start, end, pos);
    let mut msg = json!({
        "type": "media", "active": true, "key": key, "title": title, "artist": artist, "album": album,
        "app": app, "status": status,
        "pos": if live { 0.0 } else { round2((pos - start) as f64 / 1e7) },
        "dur": if !live && end > start { round2((end - start) as f64 / 1e7) } else { 0.0 },
        "upd": upd, "rate": rate, "shuffle": shuffle,
        "live": live,
    });
    let key_changed = key != ms.last_key;
    if key_changed {
        ms.last_key = key.clone();
        ms.thumb_ok = false;
        ms.thumb_tries = 0;
        ms.prev_thumb = ms.cur_thumb;
        ms.cur_thumb = 0;
        ms.thumb_str.clear();
        msg["thumb"] = json!("");
    }
    // Ảnh bìa thường đến trễ hơn tên bài (Spotify, YouTube): thử lại mỗi lần hỏi, tối đa 40 lần
    if !ms.thumb_ok && ms.thumb_tries < 40 {
        ms.thumb_tries += 1;
        match read_thumb(&props) {
            Ok(t) if !t.is_empty() => {
                let h = hash_str(&t);
                // Trình phát thường đổi tên bài trước, ảnh bìa sau: ảnh vẫn là của bài trước thì đợi thêm
                if !(h == ms.prev_thumb && ms.thumb_tries < STALE_TRIES) {
                    ms.thumb_ok = true;
                    ms.cur_thumb = h;
                    ms.thumb_str = t.clone();
                    msg["thumb"] = json!(t);
                }
            }
            Ok(_) => {}
            Err(e) => {
                if ms.thumb_tries <= 2 && e.code().0 != 0 {
                    log_err(&format!("thumb: {}", e.message()));
                }
            }
        }
    }

    // --- Trình duyệt: phiên Windows báo có phải tab đang có tiếng không? ---
    let (names, browser) = player_names(&app);
    let mut sess_audible: Option<bool> = None; // None: không tìm thấy tab của phiên
    let mut audible_tab: Option<(String, String)> = None; // (tên gốc, tên thường) của một tab đang có tiếng
    if browser {
        let stale = ms.tabs_at.map_or(true, |t| t.elapsed() > Duration::from_secs(2));
        if key_changed || stale || ms.tabs_key != key {
            ms.tabs = scan_tabs(&app_windows(names)).into_iter().map(|t| (t.name, t.lower, t.audible)).collect();
            ms.tabs_at = Some(Instant::now());
            ms.tabs_key = key.clone();
        }
        let tl = title.trim().to_lowercase();
        if !tl.is_empty() {
            sess_audible = ms.tabs.iter().find(|t| t.1.contains(&tl)).map(|t| t.2);
        }
        audible_tab = ms.tabs.iter().find(|t| t.2).map(|t| (t.0.clone(), t.1.clone()));
    }
    // Phiên Windows báo là tab tắt tiếng: hiện nguồn có tiếng thay thế. Không còn tab nào có tiếng (vd. vừa tạm dừng
    // YouTube) mà vẫn nhớ nguồn có tiếng cùng ứng dụng thì hiện nguồn đó ở trạng thái tạm dừng.
    let same_app_good = ms.good.as_ref().map_or(false, |g| g.0["app"].as_str() == Some(app.as_str()));
    let overriding = browser && sess_audible == Some(false) && (audible_tab.is_some() || same_app_good);

    if !overriding {
        ms.override_title = None;
        // Nhớ nguồn có tiếng gần nhất (đang phát, không phải tab tắt tiếng) để dùng khi bị tab khác giành chỗ
        if status == "Playing" && sess_audible != Some(false) {
            ms.good = Some((msg.clone(), ms.thumb_str.clone(), title.trim().to_lowercase(), Instant::now()));
        }
        if ms.emitted_key != key {
            if msg.get("thumb").is_none() { msg["thumb"] = json!(ms.thumb_str); }
            ms.emitted_key = key;
        }
        emit(msg);
        return Ok(());
    }

    // --- Tab tắt tiếng đang giành chỗ: hiện tiếp nguồn đang có tiếng ---
    if audible_tab.is_none() {
        let (g, gthumb, _, _) = ms.good.clone().unwrap();
        let mut o = g;
        o["status"] = json!("Paused");
        o["upd"] = json!(0);
        if ms.emitted_key != o["key"].as_str().unwrap_or("") { o["thumb"] = json!(gthumb); }
        ms.override_title = Some(o["title"].as_str().unwrap_or("").to_string());
        o["override"] = json!(true);
        o["ctl"] = json!(title);
        ms.emitted_key = o["key"].as_str().unwrap_or("").to_string();
        emit(o);
        return Ok(());
    }
    let (aname, alower) = audible_tab.unwrap();
    let ctl = title.clone(); // tên nguồn mà Windows đang gán nút điều khiển
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0);
    let good = ms.good.clone();
    let mut out = match &good {
        // Nguồn có tiếng là bài đã biết đầy đủ (vd. YouTube trước khi Instagram giành chỗ): giữ tên, ảnh bìa, chạy tiếp thời gian
        Some((g, gthumb, gtitle, at)) if !gtitle.is_empty() && alower.contains(gtitle.as_str()) => {
            let mut o = g.clone();
            let dur = o["dur"].as_f64().unwrap_or(0.0);
            // Vị trí Windows báo là vị trí TẠI lúc cập nhật cuối (upd), có thể đã cũ vài phút: tính tiếp từ upd
            let upd0 = o["upd"].as_i64().unwrap_or(0);
            let since = if upd0 > 0 { (now_ms - upd0).max(0) as f64 / 1000.0 } else { at.elapsed().as_secs_f64() };
            let mut p = o["pos"].as_f64().unwrap_or(0.0) + since;
            if dur > 0.0 { p = p.min(dur); }
            o["pos"] = json!(round2(p));
            o["upd"] = json!(now_ms);
            o["status"] = json!("Playing");
            if ms.emitted_key != o["key"].as_str().unwrap_or("") { o["thumb"] = json!(gthumb); }
            ms.override_title = Some(g["title"].as_str().unwrap_or("").to_string());
            // Cập nhật vị trí đã nhớ: nếu sau đó tab có tiếng dừng thì hiện dừng đúng chỗ
            let mut g2 = g.clone(); g2["pos"] = json!(round2(p)); g2["upd"] = json!(now_ms);
            let keep = (g2, gthumb.clone(), gtitle.clone(), Instant::now());
            ms.good = Some(keep);
            o
        }
        // Chưa biết gì về nguồn có tiếng: lấy tên từ tab
        _ => {
            let t = clean_tab_name(&aname);
            let k = format!("tab|{}", alower);
            let mut o = json!({ "type": "media", "active": true, "key": k, "title": t, "artist": "", "album": "", "app": app,
                "status": "Playing", "pos": 0.0, "dur": 0.0, "upd": 0, "rate": 1.0, "shuffle": false, "live": false });
            if ms.emitted_key != k { o["thumb"] = json!(""); }
            ms.override_title = Some(t);
            o
        }
    };
    out["override"] = json!(true);
    out["ctl"] = json!(ctl);
    ms.emitted_key = out["key"].as_str().unwrap_or("").to_string();
    emit(out);
    Ok(())
}

// "x1:y1;x2:y2;..." -> các điểm dò cửa sổ che (bỏ qua điểm sai định dạng)
// Livestream (đơn vị 100 ns như Windows báo): thời lượng âm (YouTube live trên Chromium), hoặc thời lượng /
// vị trí quá 30 ngày (kênh HLS báo 2^32 giây và vị trí là giờ thực)
fn is_live(start: i64, end: i64, pos: i64) -> bool {
    const LIVE_MAX: i64 = 30 * 86_400 * 10_000_000;
    end - start < 0 || end - start > LIVE_MAX || pos - start > LIVE_MAX
}

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

// ov: đang hiện nguồn có tiếng thay cho nguồn Windows báo (tab tắt tiếng giành chỗ): tên bài của nguồn có tiếng
fn run_command(mgr: Option<&Manager>, cmd: &str, ov: Option<&str>) {
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
            let title = ov.map(|t| t.to_string()).unwrap_or(title);
            let (names, browser) = player_names(&aumid);
            let ok = focus_app(names, &title, browser);
            // Không có cửa sổ hiện (vd. Spotify đang ẩn dưới khay): kích hoạt lại ứng dụng đóng gói qua shell
            if !ok && aumid.contains('!') {
                let _ = std::process::Command::new("explorer.exe").arg(format!("shell:AppsFolder\\{}", aumid)).spawn();
            }
        }
        return;
    }
    // Nút điều khiển lúc này chỉ tác động lên tab tắt tiếng mà trình duyệt đang gán (không phải nguồn có tiếng): bỏ qua
    if ov.is_some() && cmd != "focus" {
        log_err(&format!("cmd {}: bo qua, trinh duyet dang gan dieu khien cho tab tat tieng", cmd));
        return;
    }
    // Trình phát không hỗ trợ bài sau / bài trước (YouTube video lẻ): dùng phím tắt của YouTube
    if let (Some(s), true) = (&s, cmd == "next" || cmd == "prev") {
        let enabled = s
            .GetPlaybackInfo()
            .and_then(|i| i.Controls())
            .and_then(|c| if cmd == "next" { c.IsNextEnabled() } else { c.IsPreviousEnabled() })
            .unwrap_or(true);
        if !enabled {
            // Bài trước khi đã nghe quá 3 giây: tua về đầu bài (giống trình phát nhạc), khỏi phải chuyển tab
            if cmd == "prev" {
                let pos = s.GetTimelineProperties().and_then(|t| Ok(t.Position()?.Duration - t.StartTime()?.Duration)).unwrap_or(0);
                if pos > 30_000_000 {
                    let ok = s
                        .GetTimelineProperties()
                        .and_then(|t| t.StartTime())
                        .and_then(|st| s.TryChangePlaybackPositionAsync(st.Duration))
                        .and_then(|a| a.get())
                        .unwrap_or(false);
                    if ok {
                        return;
                    }
                }
            }
            let aumid = s.SourceAppUserModelId().map(|h| h.to_string()).unwrap_or_default();
            let title = s.TryGetMediaPropertiesAsync().and_then(|a| a.get()).and_then(|p| p.Title()).map(|h| h.to_string()).unwrap_or_default();
            if yt_skip(&aumid, &title, if cmd == "next" { 0x4E } else { 0x50 }) {
                return;
            }
        }
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

    let mut ms = MediaState {
        last_key: String::new(), thumb_ok: false, thumb_tries: 0, cur_thumb: 0, prev_thumb: 0, thumb_str: String::new(),
        emitted_key: String::new(), tabs: Vec::new(), tabs_at: None, tabs_key: String::new(), good: None, override_title: None,
    };
    let mut probe: Vec<(i32, i32)> = Vec::new();
    let mut last_cover: Option<bool> = None;
    let tab_tx = spawn_tab_worker();
    spawn_button_watch();
    let mut next_tabs = Instant::now();
    let mut last_fs: Option<bool> = None;
    let mut d3d = false; // game Direct3D toàn màn hình
    let mut under_full = false; // cửa sổ dưới viên thuốc đang toàn màn hình (đã báo app)
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
                    run_command(mgr.as_ref(), &cmd, ms.override_title.as_deref());
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
                        run_command(mgr.as_ref(), &c, ms.override_title.as_deref());
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
            let waiting_thumb = !ms.thumb_ok && ms.thumb_tries < FAST_THUMB_TRIES && !ms.last_key.is_empty();
            let gap = if burst > 0 { burst -= 1; 200 } else if waiting_thumb { 200 } else { 1000 };
            next_media = now + Duration::from_millis(gap);
        }

        // --- Có cửa sổ nào đang đè lên viên thuốc (trình duyệt phóng to, ứng dụng toàn màn hình...) ---
        // Dò nhiều điểm dọc viên thuốc: bị che nếu bất kỳ điểm nào có cửa sổ (không phải màn hình nền)
        if !probe.is_empty() {
            if now >= next_cover {
                let mut cls = String::new();
                let mut under = HWND::default();
                let mut top = HWND::default();
                for &(x, y) in &probe {
                    let (c, h) = cover_at(x, y, parent_pid);
                    if !c.is_empty() && c != "desk" { if tabbed_class(&c) { under = h; } top = h; cls = c; break; }
                }
                // Cửa sổ bên dưới đang toàn màn hình (video, trình chiếu, game không viền): app thu viên thuốc thành vạch
                let full = is_fullscreen_win(top);
                if full != under_full {
                    under_full = full;
                    emit(json!({ "type": "full", "value": full }));
                }
                let cov = !cls.is_empty();
                if last_cover != Some(cov) {
                    last_cover = Some(cov);
                    emit(json!({ "type": "cover", "value": cov, "cls": cls }));
                }
                next_cover = now + Duration::from_millis(200);
                // Có tab nằm dưới viên thuốc không: ~0,6 giây một lần; chỉ báo khi 2 lần liền cùng kết quả
                if now >= next_tabs {
                    let x0 = probe.iter().map(|p| p.0).min().unwrap_or(0) - 14;
                    let x1 = probe.iter().map(|p| p.0).max().unwrap_or(0) + 14;
                    let y = probe.iter().map(|p| p.1).max().unwrap_or(0);
                    // Luồng dò đang bận thì bỏ qua lượt này (không chờ)
                    let _ = tab_tx.try_send((under.0 as isize, x0, x1, y));
                    next_tabs = now + Duration::from_millis(600);
                }
            }
        }

        // --- Game / ứng dụng Direct3D toàn màn hình: ẩn hẳn ---
        if now >= next_fs {
            if let Ok(st) = unsafe { SHQueryUserNotificationState() } {
                d3d = st == QUNS_RUNNING_D3D_FULL_SCREEN;
            }
            let fs = d3d;
            if last_fs != Some(fs) {
                last_fs = Some(fs);
                emit(json!({ "type": "fs", "value": fs }));
            }
            next_fs = now + Duration::from_millis(1600);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_points() {
        assert_eq!(parse_probe("1200:20;1280:20;1360:20"), vec![(1200, 20), (1280, 20), (1360, 20)]);
        assert_eq!(parse_probe("-5:3; x:1;7:abc;9:9"), vec![(-5, 3), (9, 9)]); // bỏ điểm sai định dạng
        assert!(parse_probe("").is_empty());
    }

    #[test]
    fn tab_names() {
        assert_eq!(clean_tab_name("(41) ON TRỘM BẮN CS2 - YouTube - Audio playing"), "ON TRỘM BẮN CS2");
        assert_eq!(clean_tab_name("Lofi mix - YouTube"), "Lofi mix");
        assert_eq!(clean_tab_name("(1) Facebook"), "Facebook");
        assert_eq!(clean_tab_name("(2020) Phim hay"), "Phim hay");
        assert_eq!(clean_tab_name("(remix) Bài hát"), "(remix) Bài hát"); // ngoặc không phải số thông báo: giữ
        assert_eq!(clean_tab_name("TV360+ 12 - Đang phát âm thanh"), "TV360+ 12");
    }

    #[test]
    fn live_detection() {
        let s = 10_000_000; // 1 giây
        assert!(!is_live(0, 200 * s, 30 * s), "bài hát 200 giây");
        assert!(!is_live(0, 3 * 3600 * s, 3600 * s), "video 3 giờ");
        assert!(is_live(0, -1, 0), "YouTube live: thời lượng âm");
        assert!(is_live(0, 4_294_967_296 * s, 1_794_159_712 * s), "kênh HLS: 2^32 giây, vị trí giờ thực");
        assert!(is_live(0, 0, 1_794_159_712 * s), "chỉ vị trí là giờ thực");
    }
}
