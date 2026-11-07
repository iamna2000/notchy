const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu, nativeImage, clipboard, powerSaveBlocker, shell, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn, execFile, execFileSync } = require('child_process');

const WIN_W = 640;
const WIN_H = 470;
const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications';

let win = null;
let tray = null;
let mediaProc = null;
let sysProc = null;
let quitting = false;

let island = { w: 156, h: 34 }; // kích thước hiện tại của "viên thuốc" do giao diện báo về
let hoverNow = false;
let hiddenNow = false;   // viên thuốc đang tự ẩn (trượt lên khỏi màn hình)
let userHidden = false;  // người dùng chọn ẩn từ khay hệ thống
let fsHidden = false;    // đang ẩn hẳn vì game / ứng dụng Direct3D toàn màn hình
let alerting = false;    // đang đổ chuông báo thức/hẹn giờ
let covered = false;     // có cửa sổ khác (trình duyệt phóng to...) nằm dưới viên thuốc
let revealed = false;    // người dùng đã đưa chuột lên mép trên để gọi viên thuốc ra
let edgeSince = 0;
let leaveSince = 0;
let peekUntil = 0;
let holding = false;     // đang kéo thanh trượt
let typing = false;      // đang gõ chữ vào ô nhập
let awakeId = null;
let dndOn = false;
let dndByUs = false;

// ---------- Ghi log + cài đặt ----------
const userDir = () => app.getPath('userData');
function log(...a) {
  try {
    fs.appendFileSync(path.join(userDir(), 'log.txt'), `[${new Date().toISOString()}] ${a.join(' ')}\n`);
  } catch (_) {}
}
process.on('uncaughtException', (e) => log('uncaught:', e && e.stack ? e.stack : e));

const settingsFile = () => path.join(userDir(), 'settings.json');
function loadSettings() {
  // Bỏ BOM ở đầu (Notepad/PowerShell có thể thêm vào): nếu không, JSON.parse lỗi, cài đặt coi như trống
  // và lần lưu tiếp theo sẽ ghi đè mất hết
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8').replace(/^﻿/, '')); } catch (_) { return {}; }
}
function saveSettings(s) {
  try { fs.writeFileSync(settingsFile(), JSON.stringify(s)); } catch (e) { log('save settings:', e.message); }
}
const autoHideOn = () => loadSettings().autoHide !== false;
// Tự ẩn khi không dùng sau N giây (0 = tắt)
const IDLE_CHOICES = [0, 5, 10, 30];
const idleHideSec = () => { const v = Number(loadSettings().idleHide); return IDLE_CHOICES.includes(v) ? v : 0; };
let idleSec = 0;        // đọc 1 lần từ cài đặt, cập nhật khi đổi trong menu (pollCursor chạy 20 lần/giây)
let lastUse = Date.now();

// ---------- Chỉ cho chạy một bản ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { userHidden = false; updateVisibility(); peek(); }
  });
  app.setAppUserModelId('DynamicIsland.Windows');
  app.whenReady().then(start);
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (dndByUs) setToasts(true, true);
    stopProc(mediaProc); stopProc(sysProc);
    flushClip();
  });
}

function peek() {
  peekUntil = Date.now() + 3300;
  if (win && !win.isDestroyed()) win.webContents.send('peek');
}
const send = (ch, v) => { if (win && !win.isDestroyed()) win.webContents.send(ch, v); };

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

function placeWindow() {
  if (!win) return;
  const { x, y, width } = targetDisplay().bounds;
  win.setBounds({ x: Math.round(x + (width - WIN_W) / 2), y, width: WIN_W, height: WIN_H });
  sendProbe();
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
  win.on('closed', () => { win = null; });
  // backgroundThrottling tắt (để báo thức chạy đúng giờ) nên khi cửa sổ ẩn trang vẫn tưởng mình đang hiện
  // và vẫn vẽ animation; tự báo cho giao diện biết để dừng.
  win.on('show', () => send('winvis', true));
  win.on('hide', () => send('winvis', false));
  // Cắm/rút màn hình: đặt lại vị trí và cập nhật danh sách màn hình trong menu
  screen.on('display-metrics-changed', placeWindow);
  screen.on('display-added', () => { placeWindow(); refreshTrayMenu(); });
  screen.on('display-removed', () => { placeWindow(); refreshTrayMenu(); });
}

function updateVisibility() {
  if (!win) return;
  const shouldShow = !userHidden && (!fsHidden || alerting);
  if (shouldShow && !win.isVisible()) win.showInactive();
  if (!shouldShow && win.isVisible()) win.hide();
}

// ---------- Theo dõi chuột + tự ẩn ----------
function pollCursor() {
  if (!win || !win.isVisible()) return;
  const now = Date.now();
  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();
  const cx = b.x + b.width / 2;
  const dx = Math.abs(p.x - cx);

  // Tự ẩn khi có cửa sổ nằm dưới, hoặc khi không dùng quá idleSec giây;
  // đưa chuột lên sát mép trên (giữ ~0,3 giây) thì hiện lại
  if (hoverNow || holding || typing || alerting || now <= peekUntil) lastUse = now;
  const idleDue = idleSec > 0 && now - lastUse > idleSec * 1000;  const wantAuto = ((autoHideOn() && covered) || idleDue) && !alerting && now > peekUntil;
  if (wantAuto) {
    if (!revealed) {
      const atEdge = p.y <= b.y && dx <= island.w / 2 + 60;
      if (atEdge) {
        if (!edgeSince) edgeSince = now;
        if (now - edgeSince >= 280) { revealed = true; leaveSince = 0; }
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
    if (holding) inside = true;
  }
  if (inside !== hoverNow) {
    hoverNow = inside;
    win.setIgnoreMouseEvents(!inside, { forward: true });
    send('hover', inside);
  }
}

// ---------- Cầu nối PowerShell ----------
function spawnPS(file, args, onLine, onExit) {
  const script = path.join(__dirname, 'scripts', file);
  let proc;
  try {
    proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) { log('spawn', file, e.message); return null; }
  readline.createInterface({ input: proc.stdout }).on('line', onLine);
  proc.stderr.on('data', (d) => log(file, 'stderr:', String(d).slice(0, 300)));
  proc.stdin.on('error', () => {});
  proc.on('exit', (code) => { log(file, 'exit', code); onExit(); });
  return proc;
}
function stopProc(p) { try { if (p) p.kill(); } catch (_) {} }
function writeProc(p, line) { try { if (p && p.stdin.writable) p.stdin.write(line + '\n'); } catch (_) {} }

function startMedia() {
  if (process.platform !== 'win32' || quitting) return;
  mediaProc = spawnPS('media.ps1', ['-ParentPid', String(process.pid)], (line) => {
    let m;
    try { m = JSON.parse(line); } catch (_) { return; }
    if (m.type === 'fs') { fsHidden = !!m.value; updateVisibility(); }
    else if (m.type === 'cover') { covered = !!m.value; }
    else send('media', m);
  }, () => { mediaProc = null; if (!quitting) setTimeout(startMedia, 5000); });
  sendProbe();
}
function sendProbe() {
  if (!mediaProc || process.platform !== 'win32') return;
  try {
    const d = targetDisplay();
    const pt = screen.dipToScreenPoint({ x: Math.round(d.bounds.x + d.bounds.width / 2), y: Math.round(d.bounds.y + 2) });
    writeProc(mediaProc, `probe:${pt.x}:${pt.y}`);
  } catch (e) { log('probe:', e.message); }
}
function ensureSys() {
  if (sysProc || process.platform !== 'win32' || quitting) return;
  sysProc = spawnPS('system.ps1', [], (line) => {
    let m;
    try { m = JSON.parse(line); } catch (_) { return; }
    send('sys', m);
  }, () => { sysProc = null; });
}

// ---------- Bảng tạm ----------
const clipFile = () => path.join(userDir(), 'clip.json');
let clipList = [];
let clipDirty = false;
let lastClipText = '';
function loadClip() {
  try { const a = JSON.parse(fs.readFileSync(clipFile(), 'utf8')); if (Array.isArray(a)) clipList = a.filter((x) => x && typeof x.text === 'string'); } catch (_) {}
}
function flushClip() {
  if (!clipDirty) return;
  clipDirty = false;
  try { fs.writeFileSync(clipFile(), JSON.stringify(clipList)); } catch (e) { log('save clip:', e.message); }
}
function clipChanged() { clipDirty = true; send('clip', clipList); }
function pollClipboard() {
  let text = '';
  try {
    // Trình quản lý mật khẩu đánh dấu nội dung nhạy cảm bằng định dạng này => bỏ qua
    if (clipboard.availableFormats().some((f) => /ExcludeClipboardContentFromMonitorProcessing/i.test(f))) return;
    text = clipboard.readText();
  } catch (_) { return; }
  if (!text || !text.trim() || text === lastClipText) return;
  lastClipText = text;
  if (text.length > 5000) text = text.slice(0, 5000);
  const old = clipList.find((x) => x.text === text);
  clipList = clipList.filter((x) => x.text !== text);
  clipList.unshift({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, pin: old ? !!old.pin : false, ts: Date.now() });
  let n = 0;
  clipList = clipList.filter((x) => x.pin || ++n <= 50);
  clipChanged();
}

// ---------- Kệ tạm (kéo tệp vào / ra) ----------
let shelf = [];                 // [{ id, path }] chỉ lưu đường dẫn, không sao chép tệp
const iconCache = new Map();
function loadShelf() {
  const s = loadSettings();
  shelf = Array.isArray(s.shelf) ? s.shelf.filter((x) => x && typeof x.id === 'string' && typeof x.path === 'string') : [];
}
function saveShelf() { const s = loadSettings(); s.shelf = shelf; saveSettings(s); }
const exists = (p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } };
async function shelfPayload() {
  const before = shelf.length;
  shelf = shelf.filter((x) => exists(x.path));
  if (shelf.length !== before) saveShelf();
  const out = [];
  for (const it of shelf) {
    let icon = iconCache.get(it.path);
    if (!icon) {
      try { icon = (await app.getFileIcon(it.path, { size: 'normal' })).toDataURL(); } catch (_) { icon = ''; }
      if (icon) { if (iconCache.size > 200) iconCache.clear(); iconCache.set(it.path, icon); }
    }
    out.push({ id: it.id, name: path.basename(it.path) || it.path, dir: path.dirname(it.path), icon });
  }
  return out;
}
async function sendShelf() { try { send('shelf', await shelfPayload()); } catch (e) { log('shelf:', e.message); } }

// ---------- Thông báo "tải xong" (theo dõi thư mục Downloads) ----------
function watchDownloads() {
  let dir;
  try { dir = app.getPath('downloads'); } catch (_) { return; }
  const TEMP = /\.(crdownload|part|tmp|download|partial|opdownload)$/i;
  const timers = new Map();
  const told = new Map();
  const check = (name) => {
    const f = path.join(dir, name);
    let st;
    try { st = fs.statSync(f); } catch (_) { return; }
    if (!st.isFile() || st.size === 0 || Date.now() - st.mtimeMs > 20000) return;
    setTimeout(() => {   // đợi kích thước ổn định rồi mới báo
      let st2;
      try { st2 = fs.statSync(f); } catch (_) { return; }
      if (st2.size !== st.size) return check(name);
      const key = name + '|' + st2.size + '|' + Math.round(st2.mtimeMs / 1000);
      if (told.has(key)) return;
      told.set(key, 1);
      if (told.size > 100) told.clear();
      peekUntil = Date.now() + 4200;
      send('toast', { kind: 'download', title: 'Đã tải xong', sub: name });
    }, 1200);
  };
  try {
    fs.watch(dir, { persistent: false }, (_evt, name) => {
      if (!name || TEMP.test(name) || /^(~\$|\.)/.test(name)) return;
      clearTimeout(timers.get(name));
      timers.set(name, setTimeout(() => { timers.delete(name); check(name); }, 1500));
    });
    log('watching downloads:', dir);
  } catch (e) { log('watch downloads:', e.message); }
}

// ---------- Không làm phiền / giữ máy thức ----------
function setToasts(enabled, sync) {
  const args = ['add', REG_KEY, '/v', 'ToastEnabled', '/t', 'REG_DWORD', '/d', enabled ? '1' : '0', '/f'];
  try {
    if (sync) execFileSync('reg', args, { windowsHide: true });
    else execFile('reg', args, { windowsHide: true }, (e) => { if (e) log('reg:', e.message); });
  } catch (e) { log('reg:', e.message); }
}
function readDnd() {
  if (process.platform !== 'win32') return;
  execFile('reg', ['query', REG_KEY, '/v', 'ToastEnabled'], { windowsHide: true }, (e, out) => {
    dndOn = !e && /ToastEnabled\s+REG_DWORD\s+0x0\b/i.test(String(out));
    sendFlags();
  });
}
const flags = () => ({ dnd: dndOn, awake: awakeId !== null });
const sendFlags = () => send('flags', flags());

// ---------- Khay hệ thống ----------
function autostartEnabled() {
  try { return app.getLoginItemSettings({ path: process.execPath, args: [app.getAppPath()] }).openAtLogin; } catch (_) { return false; }
}
function setAutostart(on) {
  try { app.setLoginItemSettings({ openAtLogin: on, path: process.execPath, args: [app.getAppPath()] }); } catch (e) { log('autostart:', e.message); }
  const s = loadSettings(); s.autostart = on; saveSettings(s);
}
function trayImage() {
  for (const f of ['tray.png', 'tray.ico']) {
    try {
      const img = nativeImage.createFromPath(path.join(__dirname, 'assets', f));
      if (!img.isEmpty()) { log('tray image:', f, JSON.stringify(img.getSize())); return img; }
      log('tray image empty:', f);
    } catch (e) { log('tray image error:', f, e.message); }
  }
  // Dự phòng cuối: ô vuông trắng 16x16 (BGRA) để chắc chắn có icon
  return nativeImage.createFromBitmap(Buffer.alloc(16 * 16 * 4, 0xff), { width: 16, height: 16 });
}
function buildMenu() {
  return Menu.buildFromTemplate([
    { label: `Dynamic Island ${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: userHidden ? 'Hiện viên thuốc' : 'Ẩn viên thuốc', click: () => { userHidden = !userHidden; updateVisibility(); refreshTrayMenu(); } },
    ...displayMenu(),
    { label: 'Tự ẩn', submenu: [
      { label: 'Khi có cửa sổ phóng to', type: 'checkbox', checked: autoHideOn(), click: (i) => { const s = loadSettings(); s.autoHide = i.checked; saveSettings(s); } },
      { type: 'separator' },
      { label: 'Khi không dùng', enabled: false },
      ...IDLE_CHOICES.map((v) => ({
        label: v ? `Sau ${v} giây` : 'Không', type: 'radio', checked: idleSec === v,
        click: () => { const s = loadSettings(); s.idleHide = v; saveSettings(s); idleSec = v; lastUse = Date.now(); refreshTrayMenu(); },
      })),
    ] },
    { label: 'Khởi động cùng Windows', type: 'checkbox', checked: autostartEnabled(), click: (i) => setAutostart(i.checked) },
    { type: 'separator' },
    { label: 'Khởi động lại', click: () => { app.relaunch(); app.quit(); } },
    { label: 'Mở nhật ký lỗi', click: () => shell.showItemInFolder(path.join(userDir(), 'log.txt')) },
    { label: 'Thoát (Ctrl+Alt+Q)', click: () => app.quit() },
  ]);
}
// Mục chọn màn hình: chỉ hiện khi có từ 2 màn hình
function displayMenu() {
  const all = screen.getAllDisplays();
  if (all.length < 2) return [];
  const cur = targetDisplay(), primary = screen.getPrimaryDisplay();
  return [{ label: 'Màn hình', submenu: all.map((d, i) => ({
    label: displayName(d, i) + (d.id === primary.id ? ' · chính' : ''), type: 'radio', checked: d.id === cur.id,
    click: () => {
      const s = loadSettings(); s.display = { id: d.id, label: d.label || '' }; saveSettings(s);
      placeWindow(); refreshTrayMenu();
      peekUntil = Date.now() + 2500; // hiện viên thuốc một lúc ở màn hình mới cho dễ thấy
    },
  })) }];
}
function refreshTrayMenu() { try { if (tray) tray.setContextMenu(buildMenu()); } catch (e) { log('tray menu:', e.message); } }
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
    tray.setToolTip('Dynamic Island');
    refreshTrayMenu();
    const show = () => { userHidden = false; updateVisibility(); peek(); refreshTrayMenu(); };
    tray.on('click', show);
    tray.on('double-click', show);
    log('tray created, bounds:', JSON.stringify(tray.getBounds()));
    promoteTray();
  } catch (e) { log('tray error:', e && e.stack ? e.stack : e); }
}

// ---------- Khởi động ----------
function start() {
  log('start v' + app.getVersion(), 'exec:', process.execPath);
  idleSec = idleHideSec();
  loadClip();
  loadShelf();
  lastClipText = clipList.length ? clipList[0].text : '';
  createWindow();
  buildTray();
  startMedia();
  readDnd();
  watchDownloads();
  setInterval(pollCursor, 50);
  setInterval(pollClipboard, 700);
  setInterval(flushClip, 2000);
  globalShortcut.register('Control+Alt+Q', () => app.quit());
  const s = loadSettings();
  if (s.autostart === undefined) setAutostart(true);
}

// ---------- Giao tiếp với giao diện ----------
ipcMain.on('island-size', (_e, s) => {
  if (s && Number.isFinite(s.w) && Number.isFinite(s.h)) island = { w: s.w, h: s.h };
});
ipcMain.on('media-cmd', (_e, cmd) => {
  if (typeof cmd !== 'string' || !/^(play_pause|next|prev|shuffle|focus|seek:\d+(\.\d+)?)$/.test(cmd)) return;
  writeProc(mediaProc, cmd);
});
ipcMain.on('sys-cmd', (_e, cmd) => {
  if (typeof cmd !== 'string' || !/^(get|devices|mute|vol:[01](\.\d+)?|bri:\d{1,3}|dev:[\w\-.{}]{1,200})$/.test(cmd)) return;
  ensureSys();
  writeProc(sysProc, cmd);
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
ipcMain.on('clip-get', () => send('clip', clipList));
ipcMain.on('clip-paste', (_e, id) => {
  const it = clipList.find((x) => x.id === id);
  if (!it) return;
  lastClipText = it.text;
  clipboard.writeText(it.text);
  typing = false;
  try { win.blur(); win.setFocusable(false); } catch (_) {}
  setTimeout(() => writeProc(mediaProc, 'paste'), 120);
});
ipcMain.on('clip-pin', (_e, id) => { const it = clipList.find((x) => x.id === id); if (it) { it.pin = !it.pin; clipChanged(); } });
ipcMain.on('clip-del', (_e, id) => { clipList = clipList.filter((x) => x.id !== id); clipChanged(); });
ipcMain.on('clip-clear', () => { clipList = clipList.filter((x) => x.pin); clipChanged(); });
ipcMain.on('toggle', (_e, name, on) => {
  if (name === 'awake') {
    if (on && awakeId === null) awakeId = powerSaveBlocker.start('prevent-display-sleep');
    if (!on && awakeId !== null) { powerSaveBlocker.stop(awakeId); awakeId = null; }
  } else if (name === 'dnd' && process.platform === 'win32') {
    dndOn = !!on; if (on) dndByUs = true;
    setToasts(!on, false);
  }
  sendFlags();
});
ipcMain.handle('flags', () => flags());
ipcMain.on('menu', () => { try { buildMenu().popup({ window: win }); } catch (e) { log('menu:', e.message); } });
ipcMain.on('open-sound', () => { shell.openExternal('ms-settings:sound').catch(() => {}); });
ipcMain.on('shelf-get', () => sendShelf());
ipcMain.on('shelf-add', (_e, paths) => {
  if (!Array.isArray(paths)) return;
  for (const p of paths.slice(0, 50)) {
    if (typeof p !== 'string' || !path.isAbsolute(p) || !exists(p) || shelf.some((x) => x.path === p)) continue;
    shelf.unshift({ id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), path: p });
  }
  shelf = shelf.slice(0, 40);
  saveShelf(); sendShelf();
});
ipcMain.on('shelf-del', (_e, id) => { shelf = shelf.filter((x) => x.id !== id); saveShelf(); sendShelf(); });
ipcMain.on('shelf-clear', () => { shelf = []; saveShelf(); sendShelf(); });
ipcMain.on('shelf-open', (_e, id) => { const it = shelf.find((x) => x.id === id); if (it && exists(it.path)) shell.showItemInFolder(it.path); });
ipcMain.on('shelf-drag', (e, id) => {
  const it = shelf.find((x) => x.id === id);
  if (!it || !exists(it.path)) return;
  let icon = null;
  try { const c = iconCache.get(it.path); if (c) icon = nativeImage.createFromDataURL(c); } catch (_) {}
  if (!icon || icon.isEmpty()) icon = trayImage();
  try { e.sender.startDrag({ file: it.path, icon }); } catch (err) { log('shelf drag:', err.message); }
});
ipcMain.on('notice', () => { peekUntil = Date.now() + 4200; });
