// Notchy: tiến trình chính. File này giữ phần lõi của viên thuốc: cửa sổ, tự ẩn, phím tắt, cầu nối nhạc,
// khay hệ thống, khởi động. Các phần khác nằm trong lib/:
//   core (log, cài đặt, gửi tin), prefs (chuẩn hóa cài đặt, có test), bridges (chạy exe Rust / PowerShell),
//   thumbs (ảnh bìa), stats (tab Hệ thống + âm lượng), weather, clip (bảng tạm), shelf (kệ tạm, tải xong,
//   ảnh chụp màn hình), updater, settings-window (cửa sổ Cài đặt, báo lỗi, giới thiệu).
const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu, nativeImage, shell, desktopCapturer, nativeTheme } = require('electron');
const path = require('path');
const { execFile } = require('child_process');

// Tên hiển thị (productName) là "Notchy", nhưng giữ thư mục dữ liệu cũ %APPDATA%/dynamic-island-windows
// (cài đặt, ghi chú, lịch sử bảng tạm) cho cả bản chạy bằng chay.bat lẫn bản cài đặt. Phải gọi trước khi đọc userData.
app.setName('dynamic-island-windows');

const core = require('./lib/core');
const P = require('./lib/prefs');
const { stopProc, writeProc, withFallback } = require('./lib/bridges');
const thumbs = require('./lib/thumbs');
const stats = require('./lib/stats');
const weather = require('./lib/weather');
const clip = require('./lib/clip');
const shelf = require('./lib/shelf');
const updater = require('./lib/updater');
const settingsWin = require('./lib/settings-window');
const { log, loadSettings, saveSettings, send } = core;

process.on('uncaughtException', (e) => log('uncaught:', e && e.stack ? e.stack : e));

const WIN_W = 640;
const WIN_H = 470;

let win = null;
let tray = null;
let mediaProc = null;

let island = { w: 156, h: 34 }; // kích thước hiện tại của "viên thuốc" do giao diện báo về
let hoverNow = false;
let hiddenNow = false;   // viên thuốc đang tự ẩn (thu thành vạch)
let userHidden = false;  // người dùng chọn ẩn (menu / Cài đặt)
let fsHidden = false;    // đang ẩn hẳn vì game / ứng dụng Direct3D toàn màn hình
let alerting = false;    // đang đổ chuông nhắc ghi chú
let covered = false;     // có cửa sổ khác (trình duyệt phóng to...) nằm dưới viên thuốc
let fullUnder = false;   // cửa sổ dưới viên thuốc đang toàn màn hình (video, trình chiếu, game không viền): luôn thu thành vạch
let tabUnder = false;    // có tab (thanh tab trình duyệt, Explorer) nằm ngay dưới viên thuốc (di-media dò bằng UI Automation)
let revealed = false;    // người dùng đã đưa chuột lên mép trên để gọi viên thuốc ra
let edgeSince = 0;
let leaveSince = 0;
let peekUntil = 0;
let holding = false;     // đang kéo thanh trượt
let typing = false;      // đang gõ chữ vào ô nhập
let kbOpen = false;      // viên thuốc đang mở bằng phím tắt (chưa rê chuột vào)
// Kéo thả từ ứng dụng khác (tệp từ Explorer...): di-media báo nút chuột trái. Bấm giữ ở ngoài viên thuốc rồi kéo tới
// vùng giữa mép trên => hiện viên thuốc và cho nhận chuột ngay (kể cả đang thu thành vạch), giữ thêm một lúc sau khi
// thả chuột để cú thả kịp tới cửa sổ.
let lbDown = false;      // chuột trái đang được giữ
let pressOutside = false; // lần bấm hiện tại bắt đầu ở ngoài vùng viên thuốc
let dragUntil = 0;       // đang kéo tới viên thuốc (tới thời điểm này)

// ---------- Tự ẩn (xem lib/prefs.js: off / tabs / window + độ trễ) ----------
let hide = { mode: 'window', delay: 5, fullBar: true };
function loadHideSettings() {
  const s = loadSettings();
  const h = P.normalizeHide(s);
  hide = { mode: h.mode, delay: h.delay, fullBar: h.fullBar };
  if (h.changed) { s.hideMode = h.mode; s.hideDelay = h.delay; delete s.idleHide; saveSettings(s); }
}
function setHide(mode, delay) {
  const s = loadSettings(); s.hideMode = mode; if (delay !== undefined) s.hideDelay = delay; saveSettings(s);
  loadHideSettings(); lastUse = Date.now(); refreshTrayMenu();
}
let lastUse = Date.now();
let coveredSince = 0;   // lúc bắt đầu có cửa sổ nằm dưới viên thuốc

// ---------- Chỉ cho chạy một bản ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    // Mở lại Notchy (menu Start...) khi đang chạy: hiện viên thuốc và mở Cài đặt. Bản chạy lúc bật máy thì bỏ qua.
    const sec = P.secondInstanceSection(argv);
    if (sec === null) return;
    if (win) { setUserHidden(false); peek(); }
    settingsWin.openSettings(sec);
  });
  app.setAppUserModelId('com.na.notchy');
  app.whenReady().then(start);
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => { core.quitting = true; });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    stopProc(mediaProc); stats.stopStats();
    clip.flush();
  });
}

function peek() {
  peekUntil = Date.now() + 3300;
  if (win && !win.isDestroyed()) win.webContents.send('peek');
}
const peekFor = (ms) => { peekUntil = Math.max(peekUntil, Date.now() + ms); };

// ---------- Cửa sổ ----------
// Màn hình hiển thị viên thuốc: theo cài đặt (id, rồi tên nếu id đổi sau khi cắm lại), không có thì màn hình chính
function targetDisplay() {
  const s = loadSettings().display, all = screen.getAllDisplays();
  if (s) {
    const d = all.find((x) => x.id === s.id) || (s.label && all.find((x) => x.label === s.label));
    if (d) return d;
  }
  return screen.getPrimaryDisplay();
}
const displayName = (d, i) => `${d.label || `Màn hình ${i + 1}`} (${d.size.width}×${d.size.height})`;

// Kích thước viên thuốc (Cài đặt > Viên thuốc): giao diện phóng bằng CSS zoom trên .stage (renderer/app.js),
// cửa sổ và mọi vùng chuột ở đây nhân theo cùng hệ số. Không dùng webContents.setZoomFactor: mức zoom của
// Chromium dùng chung theo nguồn file://, sẽ phóng luôn cả cửa sổ Cài đặt.
let SCALE = 1;
const loadScale = () => { SCALE = P.pillScale(loadSettings()); };
function placeWindow() {
  if (!win) return;
  const { x, y, width } = targetDisplay().bounds;
  const w = Math.round(WIN_W * SCALE), h = Math.round(WIN_H * SCALE);
  win.setBounds({ x: Math.round(x + (width - w) / 2), y, width: w, height: h });
  sendProbe();
}
function applyScale() {
  const old = SCALE;
  loadScale();
  if (SCALE === old) return;
  island = { w: island.w / old * SCALE, h: island.h / old * SCALE };
  probeBox = { w: probeBox.w / old * SCALE, h: probeBox.h / old * SCALE };
  placeWindow();
  peekFor(2500); // hiện viên thuốc một lúc cho thấy kích thước mới
}

function createWindow() {
  win = new BrowserWindow({
    width: WIN_W, height: WIN_H,
    frame: false, transparent: true, resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, alwaysOnTop: true,
    focusable: false, show: false, backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required',
    },
  });
  core.win = win;
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  placeWindow();
  win.setIgnoreMouseEvents(true, { forward: true });
  // Sóng âm ở viên thuốc: cho giao diện nghe âm thanh hệ thống (loopback) để phân tích phổ.
  // Chỉ lấy âm thanh; hình ảnh màn hình bị giao diện dừng ngay, không hiện hộp thoại chọn.
  win.webContents.session.setDisplayMediaRequestHandler((_req, cb) => {
    desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
      .then((src) => cb(src.length ? { video: src[0], audio: 'loopback' } : {}))
      .catch((e) => { log('loopback:', e.message); cb({}); });
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => updateVisibility());
  win.webContents.on('render-process-gone', (_e, d) => log('renderer gone:', JSON.stringify(d)));
  // giao diện (tải lại) sẵn sàng: gửi lại nhạc + ảnh bìa, cài đặt giao diện, trạng thái tự ẩn (gửi trước khi trang tải xong thì bị mất)
  win.webContents.on('did-finish-load', () => {
    resendMedia(); settingsWin.sendPrefs(); if (hiddenNow) send('hidden', true);
    const u = updater.state(); if (u.state === 'ready') send('update', { version: u.version, notes: u.notes }); // nút Cập nhật
  });
  win.on('closed', () => { win = null; core.win = null; });
  // backgroundThrottling tắt (để nhắc ghi chú chạy đúng giờ) nên khi cửa sổ ẩn trang vẫn tưởng mình đang hiện
  // và vẫn vẽ animation; tự báo cho giao diện biết để dừng.
  win.on('show', () => send('winvis', true));
  win.on('hide', () => send('winvis', false));
}
// Cắm/rút màn hình: đặt lại vị trí và cập nhật danh sách màn hình trong Cài đặt (đăng ký một lần ở start)
function watchDisplays() {
  screen.on('display-metrics-changed', placeWindow);
  screen.on('display-added', () => { placeWindow(); refreshTrayMenu(); });
  screen.on('display-removed', () => { placeWindow(); refreshTrayMenu(); });
}

// ---------- Tự chữa: cửa sổ viên thuốc nuốt cú nhấn chuột ----------
// Thỉnh thoảng cửa sổ rơi vào trạng thái: Windows gửi WM_MOUSEACTIVATE rồi bỏ mất cú nhấn (trang chỉ nhận cú
// nhả), nên rê chuột vẫn phóng to (do pollCursor) nhưng bấm không mở được bảng. Đã đo trên app đang lỗi:
// nạp lại trang, ẩn/hiện, cho focus, gửi bù WM_LBUTTONUP đều không gỡ được; TẠO LẠI CỬA SỔ thì hết ngay.
// Giao diện phát hiện dấu hiệu (nhả chuột mà không có cú nhấn) và báo về đây; tạo lại khi viên thuốc rảnh.
let needRecreate = false;
function recreateWindow() {
  const old = win;
  if (!old || old.isDestroyed()) { createWindow(); return; }
  old.removeAllListeners('closed'); // không để cửa sổ cũ xóa tham chiếu tới cửa sổ mới
  hoverNow = false;
  createWindow();
  // Cửa sổ mới hiện (showInactive) khi vẽ xong, đè đúng chỗ cửa sổ cũ; đóng cửa sổ cũ sau đó để không bị nháy
  win.once('ready-to-show', () => setTimeout(() => { try { old.destroy(); } catch (_) {} }, 300));
}
function maybeRecreate() {
  if (!needRecreate || hoverNow || holding || typing || alerting || kbOpen || outDrag) return;
  needRecreate = false;
  log('pill: cửa sổ nuốt cú nhấn chuột, đã tạo lại cửa sổ');
  recreateWindow();
}

function updateVisibility() {
  if (!win) return;
  const shouldShow = !userHidden && (!fsHidden || alerting);
  if (shouldShow && !win.isVisible()) win.showInactive();
  if (!shouldShow && win.isVisible()) win.hide();
}
function setUserHidden(v) { userHidden = !!v; updateVisibility(); refreshTrayMenu(); }

// ---------- Phím tắt mở / đóng viên thuốc (đổi trong Cài đặt > Chung) ----------
// Mở bằng phím: hiện cả khi đang tự ẩn; Esc hoặc bấm lại phím tắt để đóng; rê chuột vào thì dùng chuột như thường.
let hotkeyNow = '', hotkeyOk = true;
function registerHotkey() {
  if (hotkeyNow) { try { globalShortcut.unregister(hotkeyNow); } catch (_) {} }
  hotkeyNow = ''; hotkeyOk = true;
  // Người dùng chưa tự chọn: thử lần lượt các tổ hợp, lấy tổ hợp đầu tiên chưa bị ứng dụng khác chiếm
  const tries = P.hotkeyTries(loadSettings());
  if (!tries.length) return;
  for (const k of tries) {
    let ok = false;
    try { ok = globalShortcut.register(k, () => setKbOpen(!kbOpen)); } catch (_) {}
    if (ok) { hotkeyNow = k; return; }
    log('hotkey: không đăng ký được', k, '(ứng dụng khác đang dùng)');
  }
  hotkeyOk = false;
}
function hotkeyInfo() {
  const s = loadSettings();
  return { hotkey: hotkeyNow || (P.HOTKEYS.includes(s.hotkey) ? s.hotkey : P.HOTKEYS[0]), ok: hotkeyOk, auto: !P.HOTKEYS.includes(s.hotkey) };
}
function setKbOpen(v) {
  v = !!v;
  if (v === kbOpen) return;
  kbOpen = v;
  if (v) { userHidden = false; updateVisibility(); lastUse = Date.now(); }
  try {
    if (v) globalShortcut.register('Escape', () => setKbOpen(false));
    else if (globalShortcut.isRegistered('Escape')) globalShortcut.unregister('Escape');
  } catch (_) {}
  send('kbopen', v);
}

// Vùng nhận kéo thả: rộng hơn viên thuốc một chút (cả khi đang là vạch nhỏ ở mép trên)
function inDropZone(p, b) {
  return Math.abs(p.x - (b.x + b.width / 2)) <= island.w / 2 + 80 && p.y >= b.y && p.y <= b.y + Math.max(island.h, 40) + 24;
}

// ---------- Kéo tệp từ Kệ tạm ra ứng dụng khác ----------
// Kéo thả của hệ thống (webContents.startDrag) dùng chính cửa sổ viên thuốc làm nguồn. ĐỔI setIgnoreMouseEvents
// TRONG LÚC KÉO LÀ WINDOWS HUỶ PHIÊN KÉO: đã đo bằng chuột thật — pollCursor đổi khi con trỏ rời viên thuốc thì phiên
// kéo chết sau ~430 ms; đổi ngay trước khi kéo thì startDrag trả về sau 84 ms (tệp "tự thả" dù vẫn giữ chuột).
// Nên: không đụng tới setIgnoreMouseEvents, đóng băng pollCursor tới khi nhả chuột (di-media báo lbtn): viên thuốc
// đứng yên, không thu lại. Hạn chế còn lại: không thả được vào phần ứng dụng nằm ngay dưới vùng cửa sổ viên thuốc
// (640x470 ở giữa mép trên); thả ở chỗ khác bình thường.
let outDrag = 0;          // lúc bắt đầu kéo ra (0 = không kéo)
let resyncMouse = false;  // kéo xong: đặt lại setIgnoreMouseEvents theo vị trí chuột thật
function beginOutDrag() {
  outDrag = Date.now();
}
function outDragActive(now) {
  if (!outDrag) return false;
  // Kết thúc khi đã nhả chuột (sau ít nhất 300 ms để kịp nhận trạng thái nút), hoặc quá 2 phút (phòng hờ)
  if ((!lbDown && now - outDrag > 300) || now - outDrag > 120000) {
    outDrag = 0; resyncMouse = true;
    return false;
  }
  return true;
}

// ---------- Theo dõi chuột + tự ẩn (20 lần/giây) ----------
function pollCursor() {
  if (!win || !win.isVisible()) return;
  const now = Date.now();
  if (outDragActive(now)) return; // đang kéo tệp ra: giữ nguyên mọi thứ
  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();
  const cx = b.x + b.width / 2;
  const dx = Math.abs(p.x - cx);

  if (lbDown && pressOutside && inDropZone(p, b)) dragUntil = now + 700;
  const dragging = now < dragUntil;

  // Tự ẩn theo chế độ; đưa chuột lên sát mép trên (giữ ~0,3 giây) thì hiện lại
  if (hoverNow || holding || typing || alerting || kbOpen || now <= peekUntil) lastUse = now;
  if (!covered) coveredSince = 0; else if (!coveredSince) coveredSince = now;
  // 'window': đếm delay giây từ lúc dùng gần nhất hoặc từ lúc cửa sổ vừa xuất hiện bên dưới (lấy mốc muộn hơn)
  const due = (hide.fullBar && fullUnder) || (hide.mode === 'window' ? covered && now - Math.max(lastUse, coveredSince) >= hide.delay * 1000
    : hide.mode === 'tabs' ? covered && tabUnder
    : false);
  const wantAuto = due && !alerting && !kbOpen && !dragging && now > peekUntil;
  if (wantAuto) {
    if (!revealed) {
      // Hiện lại khi đưa chuột lên mép trên HOẶC rê vào vùng thanh Home (10px trên cùng, rộng hơn thanh 2 bên)
      const atEdge = p.y <= b.y + 10 && dx <= island.w / 2 + 60;
      if (atEdge) {
        if (!edgeSince) edgeSince = now;
        if (now - edgeSince >= 200) { revealed = true; leaveSince = 0; }
      } else edgeSince = 0;
    } else {
      const near = (dx <= island.w / 2 + 20 && p.y <= b.y + island.h + 20) || holding || typing;
      if (near) leaveSince = 0;
      else if (!leaveSince) leaveSince = now;
      else if (now - leaveSince > 450) revealed = false;
    }
  } else { revealed = false; edgeSince = 0; leaveSince = 0; }

  const hidden = wantAuto && !revealed;
  if (hidden !== hiddenNow) { hiddenNow = hidden; send('hidden', hidden); }

  let inside = false;
  if (!hidden) {
    const pad = hoverNow ? 14 : 3;
    inside = dx <= island.w / 2 + pad && p.y >= b.y && p.y <= b.y + island.h + pad;
    if (holding || dragging) inside = true;
  }
  if (inside !== hoverNow || resyncMouse) {
    resyncMouse = false;
    const changed = inside !== hoverNow;
    hoverNow = inside;
    if (inside && kbOpen) setKbOpen(false); // rê chuột vào: dùng chuột như thường
    win.setIgnoreMouseEvents(!inside, { forward: true });
    if (changed) send('hover', inside);
  }
  maybeRecreate();
}

// ---------- Cầu nối nhạc (di-media, dự phòng media.ps1): nhạc, cửa sổ che, tab, toàn màn hình ----------
// Nhớ trạng thái nhạc gần nhất kèm ảnh bìa. Cầu nối chỉ gửi ảnh bìa MỘT lần mỗi bài; nếu giao diện chưa
// tải xong hoặc tải lại thì ảnh bị mất -> gửi lại khi giao diện sẵn sàng.
let lastMedia = null, lastThumb = '';
function rememberMedia(m) {
  if (!lastMedia || lastMedia.key !== m.key) lastThumb = '';
  if (typeof m.thumb === 'string') lastThumb = m.thumb;
  lastMedia = m;
}
function resendMedia() {
  if (lastMedia) send('media', lastMedia.active ? { ...lastMedia, thumb: lastThumb } : lastMedia);
}
const startMediaProc = withFallback({
  name: 'di-media', ps: 'media.ps1', label: 'media bridge',
  args: ['--parent-pid', String(process.pid)], psArgs: ['-ParentPid', String(process.pid)],
  onLine: (line) => {
    let m;
    try { m = JSON.parse(line); } catch (_) { return; }
    if (m.type === 'fs') { fsHidden = !!m.value; updateVisibility(); }
    else if (m.type === 'cover') { covered = !!m.value; if (!covered) { tabUnder = false; fullUnder = false; } }
    else if (m.type === 'full') { fullUnder = !!m.value; }
    else if (m.type === 'tabs') { tabUnder = !!m.value; }
    else if (m.type === 'lbtn') {
      lbDown = !!m.value;
      // Bấm ngay trong vùng viên thuốc (bấm tab trình duyệt nằm dưới vạch, kéo tệp từ kệ ra...) không tính là kéo tới
      if (lbDown && win) pressOutside = !hoverNow && !inDropZone(screen.getCursorScreenPoint(), win.getBounds());
    }
    else { if (m.type === 'media') { thumbs.processThumb(m); rememberMedia(m); } send('media', m); }
  },
  // Cầu nối thoát: bật lại (exe Rust sau 1 giây, PowerShell sau 5 giây)
  onExit: (native) => { mediaProc = null; if (!core.quitting) setTimeout(startMedia, native ? 1000 : 5000); },
});
function startMedia() {
  if (process.platform !== 'win32' || core.quitting) return;
  mediaProc = startMediaProc();
  sendProbe();
}
// Dò cửa sổ nằm dưới viên thuốc ở 3 điểm: giữa và hai đầu, gần cạnh dưới của viên thuốc thu gọn.
// probeBox: kích thước viên thuốc ở dạng thu gọn/hover gần nhất (không lấy kích thước lúc mở bảng hay lúc ẩn).
let probeBox = { w: 156, h: 34 };
function sendProbe() {
  if (!mediaProc || process.platform !== 'win32') return;
  try {
    const d = targetDisplay(), cx = d.bounds.x + d.bounds.width / 2;
    const half = Math.min(190, Math.max(30, probeBox.w / 2 - 12));
    const y = d.bounds.y + Math.max(4, probeBox.h - 8);
    const pts = [cx - half, cx, cx + half].map((x) => screen.dipToScreenPoint({ x: Math.round(x), y: Math.round(y) }));
    writeProc(mediaProc, 'probe:' + pts.map((p) => `${p.x}:${p.y}`).join(';'));
  } catch (e) { log('probe:', e.message); }
}

// ---------- Khay hệ thống + menu chuột phải ----------
// Icon khay đơn sắc như icon hệ thống: trắng trên taskbar tối, đen trên taskbar sáng (theo màu taskbar của Windows)
function taskbarIsLight() {
  try {
    const dark = nativeTheme.shouldUseDarkColorsForSystemIntegratedUI;
    return dark === undefined ? !nativeTheme.shouldUseDarkColors : !dark;
  } catch (_) { return false; }
}
function trayImage() {
  for (const f of [taskbarIsLight() ? 'tray-light.png' : 'tray.png', 'tray.png', 'tray.ico']) {
    try {
      const img = nativeImage.createFromPath(path.join(__dirname, 'assets', f));
      if (!img.isEmpty()) { log('tray image:', f, JSON.stringify(img.getSize())); return img; }
      log('tray image empty:', f);
    } catch (e) { log('tray image error:', f, e.message); }
  }
  // Dự phòng cuối: ô vuông trắng 16x16 (BGRA) để chắc chắn có icon
  return nativeImage.createFromBitmap(Buffer.alloc(16 * 16 * 4, 0xff), { width: 16, height: 16 });
}
// Menu chuột phải (viên thuốc và khay) chỉ giữ việc hay dùng; mọi tùy chỉnh nằm trong cửa sổ Cài đặt
function buildMenu() {
  const u = updater.state();
  return Menu.buildFromTemplate([
    ...(u.state === 'ready' ? [{ label: `Cập nhật lên ${u.version} (khởi động lại)`, click: updater.install }, { type: 'separator' }] : []),
    { label: 'Cài đặt…', click: () => settingsWin.openSettings() },
    { label: userHidden ? 'Hiện viên thuốc' : 'Ẩn viên thuốc', click: () => setUserHidden(!userHidden) },
    { type: 'separator' },
    { label: 'Thoát Notchy', accelerator: 'Ctrl+Alt+Q', click: () => app.quit() },
  ]);
}
function refreshTrayMenu() {
  try { if (tray) tray.setContextMenu(buildMenu()); } catch (e) { log('tray menu:', e.message); }
  settingsWin.pushSettings();
}
// Windows 11 hay giấu icon mới trong mũi tên ^; đặt cờ "luôn hiện" cho icon của app
function promoteTray() {
  if (process.platform !== 'win32') return;
  const ps = path.join(__dirname, 'scripts', 'promote-tray.ps1');
  const run = () => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps, '-Exe', process.execPath], { windowsHide: true }, (e, out) => {
    if (e) log('promote tray error:', e.message); else log('promote tray:', String(out).trim().slice(0, 200));
  });
  setTimeout(run, 2500);
  setTimeout(run, 12000);
}
function buildTray() {
  try {
    tray = new Tray(trayImage());
    // Đổi sáng/tối trong Windows: đổi icon theo
    nativeTheme.on('updated', () => { try { if (tray && !tray.isDestroyed()) tray.setImage(trayImage()); } catch (e) { log('tray theme:', e.message); } });
    tray.setToolTip('Notchy');
    refreshTrayMenu();
    tray.on('click', () => { setUserHidden(false); peek(); });
    tray.on('double-click', () => settingsWin.openSettings()); // bấm đúp icon khay: mở Cài đặt
    log('tray created, bounds:', JSON.stringify(tray.getBounds()));
    promoteTray();
  } catch (e) { log('tray error:', e && e.stack ? e.stack : e); }
}

// ---------- Khởi động ----------
function start() {
  log('start v' + app.getVersion(), 'exec:', process.execPath);
  Object.assign(core.hooks, { peek, peekFor, refreshTrayMenu, trayImage, beginOutDrag });
  settingsWin.init({
    hide: () => ({ ...hide }), setHide, reloadHide: loadHideSettings,
    hotkey: hotkeyInfo, registerHotkey,
    isUserHidden: () => userHidden, setUserHidden,
    placeWindow, targetDisplay, displayName, applyScale,
    debug: () => ({ covered, tabUnder, fullUnder, fsHidden }),
  });
  for (const m of [stats, weather, clip, shelf]) m.registerIpc();
  loadHideSettings();
  loadScale();
  clip.start();
  createWindow();
  watchDisplays();
  buildTray();
  startMedia();
  updater.setup();
  stats.startStats(); // ghi nền lịch sử CPU/RAM/GPU/mạng cho tab Hệ thống
  weather.refreshWeather();
  thumbs.pruneThumbs(); setInterval(thumbs.pruneThumbs, 3600 * 1000); // ảnh bìa đệm: xóa ảnh quá 1 ngày
  // Máy thức dậy sau khi ngủ: cập nhật thời tiết ngay (dữ liệu cũ có thể đã lâu)
  require('electron').powerMonitor.on('resume', () => setTimeout(weather.refreshWeather, 5000));
  shelf.start();
  setInterval(pollCursor, 50);
  globalShortcut.register('Control+Alt+Q', () => app.quit());
  registerHotkey();
  const s = loadSettings();
  // Đăng ký lại mỗi lần mở: cập nhật mục cũ chưa có --autostart và xóa mục khởi động thừa từ các bản trước
  core.setAutostart(s.autostart === undefined ? true : !!s.autostart);
  // Tính năng AI thời tiết đã bỏ: xóa khóa API và tin đã lưu (nếu có) khỏi cài đặt
  if ('aiKeyEnc' in s || 'aiKey' in s || 'aiNews' in s) {
    const s2 = loadSettings(); delete s2.aiKeyEnc; delete s2.aiKey; delete s2.aiNews; saveSettings(s2);
  }
}

// ---------- Giao tiếp với viên thuốc (phần còn lại nằm trong các module lib/) ----------
ipcMain.on('island-size', (_e, s) => {
  if (s && Number.isFinite(s.w) && Number.isFinite(s.h)) {
    // Giao diện báo kích thước theo đơn vị CSS (trước khi phóng): đổi ra điểm ảnh thật trên màn hình
    const w = s.w * SCALE, h = s.h * SCALE;
    island = { w, h };
    // Dạng thu gọn/hover (cao 20..60): cập nhật vùng dò cửa sổ che theo đúng bề rộng viên thuốc
    if (s.h >= 20 && s.h <= 60 && (w !== probeBox.w || h !== probeBox.h)) { probeBox = { w, h }; sendProbe(); }
  }
});
ipcMain.on('media-cmd', (_e, cmd) => {
  if (typeof cmd !== 'string' || !/^(play_pause|next|prev|shuffle|focus|seek:\d+(\.\d+)?)$/.test(cmd)) return;
  writeProc(mediaProc, cmd);
});
ipcMain.on('alert', (_e, on) => { alerting = !!on; updateVisibility(); });
ipcMain.on('hold', (_e, on) => { holding = !!on; });
ipcMain.on('typing', (_e, on) => {
  typing = !!on;
  if (!win) return;
  try {
    if (typing) { win.setFocusable(true); win.focus(); }
    else { win.blur(); win.setFocusable(false); }
  } catch (_) {}
});
ipcMain.on('kb-close', () => setKbOpen(false));
ipcMain.on('menu', () => { try { buildMenu().popup({ window: win }); } catch (e) { log('menu:', e.message); } });
ipcMain.on('open-sound', () => { shell.openExternal('ms-settings:sound').catch(() => {}); });
ipcMain.on('notice', () => { peekFor(4200); });
ipcMain.on('input-stuck', () => { needRecreate = true; });
ipcMain.on('install-update', () => updater.install());
// Liên kết trong ghi chú: chỉ mở http(s) bằng trình duyệt mặc định
ipcMain.on('open-url', (_e, u) => {
  if (typeof u !== 'string' || u.length > 2000) return;
  try { const x = new URL(u); if (x.protocol === 'http:' || x.protocol === 'https:') shell.openExternal(x.href).catch(() => {}); } catch (_) {}
});
