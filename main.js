const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu, nativeImage, clipboard, powerSaveBlocker, shell, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn, execFile, execFileSync } = require('child_process');
const os = require('os');
const net = require('net');

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
// Chế độ tự ẩn (đọc 1 lần từ cài đặt, cập nhật khi đổi trong menu; pollCursor chạy 20 lần/giây):
//   'smart'   có cửa sổ nằm dưới viên thuốc (trình duyệt, ứng dụng...) và không dùng 5 giây thì ẩn;
//             bên dưới là màn hình nền thì hiện liên tục (mặc định)
//   'covered' có cửa sổ nằm dưới thì ẩn ngay
//   'idle'    không dùng idleSec giây thì ẩn, kể cả không có cửa sổ nào
//   'off'     không tự ẩn
const HIDE_MODES = ['smart', 'covered', 'idle', 'off'];
const SMART_DELAY = 5000;
const IDLE_CHOICES = [5, 10, 30];
let hideMode = 'smart';
let idleSec = 10;
function loadHideSettings() {
  const s = loadSettings();
  hideMode = HIDE_MODES.includes(s.hideMode) ? s.hideMode : 'smart';
  idleSec = IDLE_CHOICES.includes(Number(s.idleHide)) ? Number(s.idleHide) : 10;
}
function setHide(mode, sec) {
  const s = loadSettings(); s.hideMode = mode; if (sec) s.idleHide = sec; saveSettings(s);
  loadHideSettings(); lastUse = Date.now(); refreshTrayMenu();
}
let lastUse = Date.now();
let coveredSince = 0;   // lúc bắt đầu có cửa sổ nằm dưới viên thuốc

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
    stopProc(mediaProc); stopProc(sysProc); stopStats();
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
  win.webContents.on('did-finish-load', () => resendMedia()); // giao diện (tải lại) sẵn sàng: gửi lại nhạc + ảnh bìa
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

  // Tự ẩn theo hideMode (xem trên); đưa chuột lên sát mép trên (giữ ~0,3 giây) thì hiện lại
  if (hoverNow || holding || typing || alerting || now <= peekUntil) lastUse = now;
  if (!covered) coveredSince = 0; else if (!coveredSince) coveredSince = now;
  // 'smart': đếm 5 giây từ lúc dùng gần nhất hoặc từ lúc cửa sổ vừa xuất hiện bên dưới (lấy mốc muộn hơn)
  const due = hideMode === 'smart' ? covered && now - Math.max(lastUse, coveredSince) > SMART_DELAY
    : hideMode === 'covered' ? covered
    : hideMode === 'idle' ? now - lastUse > idleSec * 1000
    : false;
  const wantAuto = due && !alerting && now > peekUntil;
  if (wantAuto) {
    if (!revealed) {
      // Hiện lại khi đưa chuột lên mép trên HOẶC rê vào vùng thanh Home (10px trên cùng, rộng hơn thanh 2 bên).
      // Trước đây chỉ tính hàng điểm ảnh trên cùng (y=0) nên rê/bấm thẳng vào thanh (y=3..7) không có tác dụng.
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
    if (holding) inside = true;
  }
  if (inside !== hoverNow) {
    hoverNow = inside;
    win.setIgnoreMouseEvents(!inside, { forward: true });
    send('hover', inside);
  }
}

// ---------- Cầu nối PowerShell ----------
// Chạy một cầu nối (exe Rust hoặc PowerShell): mỗi dòng stdout là một JSON, lệnh gửi qua stdin
function spawnBridge(label, cmd, args, onLine, onExit) {
  let proc;
  try {
    proc = spawn(cmd, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) { log('spawn', label, e.message); return null; }
  readline.createInterface({ input: proc.stdout }).on('line', onLine);
  proc.stderr.on('data', (d) => log(label, 'stderr:', String(d).slice(0, 300)));
  proc.stdin.on('error', () => {});
  proc.on('error', (e) => log(label, 'error:', e.message));
  proc.on('exit', (code) => { log(label, 'exit', code); onExit(); });
  return proc;
}
function spawnPS(file, args, onLine, onExit) {
  const script = path.join(__dirname, 'scripts', file);
  return spawnBridge(file, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], onLine, onExit);
}
// Cầu nối Rust (native/): bản đóng gói đặt ở bin/, bản đang phát triển ở native/target/release/
function nativeExe(name) {
  for (const p of [path.join(__dirname, 'bin', name + '.exe'), path.join(__dirname, 'native', 'target', 'release', name + '.exe')]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function stopProc(p) { try { if (p) p.kill(); } catch (_) {} }
function writeProc(p, line) { try { if (p && p.stdin.writable) p.stdin.write(line + '\n'); } catch (_) {} }

// Nhớ trạng thái nhạc gần nhất kèm ảnh bìa. Cầu nối chỉ gửi ảnh bìa MỘT lần mỗi bài; nếu giao diện chưa
// tải xong (di-media khởi động gần như tức thì) hoặc tải lại thì ảnh bị mất -> gửi lại khi giao diện sẵn sàng.
// ---------- Ảnh bìa: thu nhỏ + bộ nhớ đệm theo bài ----------
// Ảnh gốc từ Windows có thể là PNG 30..150 KB trong khi giao diện chỉ hiện 66px: thu về tối đa 240px JPEG
// (~10 KB) cho IPC và giải mã nhẹ. Lưu theo bài (key) trong RAM và trên đĩa (userData/thumbs), xóa sau 1 ngày,
// tối đa 300 ảnh: quay lại bài đã nghe thì có ảnh ngay, không phải chờ đọc lại.
const THUMB_TTL = 24 * 3600 * 1000, THUMB_MAX = 300, THUMB_PX = 240;
const thumbDir = () => path.join(userDir(), 'thumbs');
const thumbMem = new Map(); // key -> { url, at }
const thumbFile = (key) => path.join(thumbDir(), require('crypto').createHash('sha1').update(key).digest('hex') + '.jpg');
function shrinkThumb(url) {
  try {
    const img = nativeImage.createFromDataURL(url);
    if (img.isEmpty()) return url;
    const { width, height } = img.getSize(), k = THUMB_PX / Math.max(width, height);
    const out = k < 1 ? img.resize({ width: Math.round(width * k), height: Math.round(height * k), quality: 'best' }) : img;
    return 'data:image/jpeg;base64,' + out.toJPEG(88).toString('base64');
  } catch (e) { log('thumb shrink:', e.message); return url; }
}
function cacheThumb(key, url) {
  thumbMem.delete(key); thumbMem.set(key, { url, at: Date.now() }); // Map giữ thứ tự chèn: đầu là cũ nhất
  while (thumbMem.size > THUMB_MAX) thumbMem.delete(thumbMem.keys().next().value);
  const b64 = url.slice(url.indexOf(',') + 1);
  fs.promises.mkdir(thumbDir(), { recursive: true })
    .then(() => fs.promises.writeFile(thumbFile(key), Buffer.from(b64, 'base64')))
    .catch((e) => log('thumb cache write:', e.message));
}
function cachedThumb(key) {
  const m = thumbMem.get(key);
  if (m && Date.now() - m.at < THUMB_TTL) return m.url;
  try {
    const f = thumbFile(key), st = fs.statSync(f);
    if (Date.now() - st.mtimeMs >= THUMB_TTL) return '';
    const url = 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
    thumbMem.set(key, { url, at: st.mtimeMs });
    return url;
  } catch (_) { return ''; }
}
// Xóa ảnh quá 1 ngày, và bớt ảnh cũ nhất nếu quá THUMB_MAX (chạy lúc mở app và mỗi giờ)
async function pruneThumbs() {
  try {
    const dir = thumbDir();
    const files = await Promise.all((await fs.promises.readdir(dir)).filter((f) => f.endsWith('.jpg'))
      .map(async (f) => ({ f: path.join(dir, f), t: (await fs.promises.stat(path.join(dir, f))).mtimeMs })));
    files.sort((a, b) => b.t - a.t);
    const now = Date.now();
    await Promise.all(files.filter((x, i) => now - x.t >= THUMB_TTL || i >= THUMB_MAX).map((x) => fs.promises.unlink(x.f).catch(() => {})));
  } catch (_) {}
}
// Tin nhắn nhạc từ cầu nối: thu nhỏ ảnh mới và lưu; bài mới chưa có ảnh thì lấy từ bộ nhớ đệm ngay
function processThumb(m) {
  if (m.type !== 'media' || !m.active || !m.key) return;
  if (typeof m.thumb === 'string' && m.thumb.startsWith('data:')) {
    m.thumb = shrinkThumb(m.thumb);
    cacheThumb(m.key, m.thumb);
  } else if (m.thumb === '') {
    const c = cachedThumb(m.key);
    if (c) m.thumb = c;
  }
}

let lastMedia = null, lastThumb = '';
function rememberMedia(m) {
  if (!lastMedia || lastMedia.key !== m.key) lastThumb = '';
  if (typeof m.thumb === 'string') lastThumb = m.thumb;
  lastMedia = m;
}
function resendMedia() {
  if (lastMedia) send('media', lastMedia.active ? { ...lastMedia, thumb: lastThumb } : lastMedia);
}
let mediaNativeFails = 0; // exe Rust thoát ngay sau khi chạy 3 lần liền -> dùng lại PowerShell
function startMedia() {
  if (process.platform !== 'win32' || quitting) return;
  const onLine = (line) => {
    let m;
    try { m = JSON.parse(line); } catch (_) { return; }
    if (m.type === 'fs') { fsHidden = !!m.value; updateVisibility(); }
    else if (m.type === 'cover') { covered = !!m.value; }
    else { if (m.type === 'media') { processThumb(m); rememberMedia(m); } send('media', m); }
  };
  const exe = mediaNativeFails < 3 ? nativeExe('di-media') : null;
  const startedAt = Date.now();
  const onExit = () => {
    mediaProc = null;
    if (exe && Date.now() - startedAt < 10000 && ++mediaNativeFails >= 3) log('di-media lỗi liên tục, chuyển sang media.ps1');
    if (!quitting) setTimeout(startMedia, exe && mediaNativeFails < 3 ? 1000 : 5000);
  };
  mediaProc = exe
    ? spawnBridge('di-media', exe, ['--parent-pid', String(process.pid)], onLine, onExit)
    : spawnPS('media.ps1', ['-ParentPid', String(process.pid)], onLine, onExit);
  if (mediaProc) log('media bridge:', exe ? 'di-media (Rust)' : 'media.ps1');
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
    const cmd = 'probe:' + pts.map((p) => `${p.x}:${p.y}`).join(';');

    writeProc(mediaProc, cmd);
  } catch (e) { log('probe:', e.message); }
}
function ensureSys() {
  if (sysProc || process.platform !== 'win32' || quitting) return;
  sysProc = spawnPS('system.ps1', [], (line) => {
    let m;
    try { m = JSON.parse(line); } catch (_) { return; }
    if (m.type === 'net') onNet(m); else send('sys', m);
  }, () => { sysProc = null; });
}

// ---------- Theo dõi hệ thống (tab Hệ thống) ----------
// Ghi nền liên tục để biểu đồ có lịch sử thật: mỗi 2 giây (1 giây khi tab đang mở), giữ 1 giờ gần nhất.
// CPU/RAM: Node; GPU: nvidia-smi chạy liên tục (-lms); mạng: lệnh 'net' của system.ps1;
// độ trễ: thời gian bắt tay TCP tới 1.1.1.1:443 (không cần quyền ICMP, không phụ thuộc ngôn ngữ).
const HIST_MS = 3600 * 1000;
const stats = {
  on: false, live: false, timer: null, gpuProc: null, gpu: null, gpuOk: true, cpuPrev: null, netPrev: null,
  down: null, up: null, ping: null, pingAt: 0,
  hist: { t: [], cpu: [], ram: [], gpu: [], down: [], up: [] },
};
function cpuTimes() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) { const t = c.times; idle += t.idle; total += t.user + t.nice + t.sys + t.idle + t.irq; }
  return { idle, total };
}
function onNet(m) {
  const now = Date.now(), p = stats.netPrev;
  if (p && now > p.at && m.rx >= p.rx && m.tx >= p.tx) {
    const dt = (now - p.at) / 1000;
    stats.down = (m.rx - p.rx) / dt; stats.up = (m.tx - p.tx) / dt;
  }
  stats.netPrev = { rx: m.rx, tx: m.tx, at: now };
}
function startGpu() {
  if (stats.gpuProc || !stats.gpuOk || process.platform !== 'win32') return;
  let p;
  try {
    p = spawn('nvidia-smi', ['--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total,power.draw',
      '--format=csv,noheader,nounits', '-lms', '1000'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { stats.gpuOk = false; return; }
  p.on('error', () => { stats.gpuOk = false; stats.gpu = null; stats.gpuProc = null; }); // không có card NVIDIA
  readline.createInterface({ input: p.stdout }).on('line', (line) => {
    const v = line.split(',').map((s) => parseFloat(s));
    if (v.length >= 4 && !isNaN(v[0])) stats.gpu = { util: v[0], temp: isNaN(v[1]) ? null : v[1], memUsed: v[2], memTotal: v[3], power: isNaN(v[4]) ? null : v[4] };
  });
  p.on('exit', () => { if (stats.gpuProc === p) stats.gpuProc = null; });
  stats.gpuProc = p;
}
function measurePing() {
  const t0 = process.hrtime.bigint();
  const s = net.connect({ host: '1.1.1.1', port: 443 });
  const done = (ms) => { stats.ping = ms; s.destroy(); };
  s.setTimeout(1500, () => done(null));
  s.once('connect', () => done(Number(process.hrtime.bigint() - t0) / 1e6));
  s.once('error', () => done(null));
}
function statsTick() {
  const now = Date.now();
  const c = cpuTimes(), p = stats.cpuPrev;
  const cpu = p && c.total > p.total ? Math.max(0, Math.min(1, 1 - (c.idle - p.idle) / (c.total - p.total))) : null;
  stats.cpuPrev = c;
  ensureSys(); writeProc(sysProc, 'net');
  if (now - stats.pingAt >= (stats.live ? 2000 : 10000)) { stats.pingAt = now; measurePing(); }
  if (stats.gpuOk && !stats.gpuProc) startGpu(); // nvidia-smi bị tắt ngang thì bật lại
  const total = os.totalmem(), ramUsed = total - os.freemem(), g = stats.gpu;
  // Ghi lịch sử (giá trị 0..1, mạng là byte/giây), bỏ phần cũ hơn 1 giờ
  const h = stats.hist;
  h.t.push(now); h.cpu.push(cpu); h.ram.push(ramUsed / total); h.gpu.push(g ? g.util / 100 : null);
  h.down.push(stats.down); h.up.push(stats.up);
  let cut = 0;
  while (cut < h.t.length && h.t[cut] < now - HIST_MS) cut++;
  if (cut) Object.values(h).forEach((a) => a.splice(0, cut));
  if (stats.live) {
    send('stats', {
      t: now, cpu, cores: os.cpus().length, ramUsed, ramTotal: total,
      gpu: g, down: stats.down, up: stats.up, ping: stats.ping,
    });
  }
}
function statsLoop() {
  try { statsTick(); } catch (e) { log('stats:', e.message); }
  stats.timer = setTimeout(statsLoop, stats.live ? 1000 : 2000);
}
function startStats() {
  if (stats.on) return;
  stats.on = true; stats.cpuPrev = cpuTimes();
  startGpu();
  ensureSys(); writeProc(sysProc, 'net');
  stats.timer = setTimeout(statsLoop, 1000);
}
function stopStats() {
  stats.on = false;
  clearTimeout(stats.timer); stats.timer = null;
  stopProc(stats.gpuProc); stats.gpuProc = null;
}
// ---------- Thời tiết (viên thuốc thu gọn khi không phát gì) ----------
// Vị trí đoán theo IP (ipwho.is), lưu lại 1 ngày; thời tiết từ Open-Meteo, cập nhật mỗi 15 phút.
// Cả hai miễn phí, không cần khóa. Tắt được trong menu ("Hiện thời tiết").
const weather = { data: null, timer: null, failLogged: false };
const weatherOn = () => loadSettings().weather !== false;
async function weatherLocation() {
  const s = loadSettings();
  if (s.weatherLoc && Date.now() - s.weatherLoc.at < 86400000) return s.weatherLoc;
  const j = await (await fetch('https://ipwho.is/?fields=success,city,latitude,longitude', { signal: AbortSignal.timeout(8000) })).json();
  if (!j.success || !Number.isFinite(j.latitude)) throw new Error('không xác định được vị trí');
  const loc = { lat: j.latitude, lon: j.longitude, city: j.city || '', at: Date.now() };
  const s2 = loadSettings(); s2.weatherLoc = loc; saveSettings(s2);
  return loc;
}
async function refreshWeather() {
  clearTimeout(weather.timer); weather.timer = null;
  if (!weatherOn()) { weather.data = null; send('weather', null); return; }
  let next = 15 * 60000;
  try {
    const loc = await weatherLocation();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}`
      + '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1';
    const j = await (await fetch(url, { signal: AbortSignal.timeout(10000) })).json();
    const c = j.current;
    if (!c || !Number.isFinite(c.temperature_2m)) throw new Error('dữ liệu thời tiết không hợp lệ');
    weather.data = {
      temp: c.temperature_2m, code: c.weather_code, day: !!c.is_day, city: loc.city,
      hi: j.daily && j.daily.temperature_2m_max ? j.daily.temperature_2m_max[0] : null,
      lo: j.daily && j.daily.temperature_2m_min ? j.daily.temperature_2m_min[0] : null,
      at: Date.now(),
    };
    weather.failLogged = false;
    send('weather', weather.data);
  } catch (e) {
    if (!weather.failLogged) { log('weather:', e.message); weather.failLogged = true; } // mất mạng: chỉ ghi 1 lần
    next = 5 * 60000;
  }
  if (weatherOn()) weather.timer = setTimeout(refreshWeather, next);
}

// Tab Hệ thống mở: gửi toàn bộ lịch sử một lần rồi cập nhật mỗi giây; đóng: quay về ghi nền 2 giây
function setStatsLive(on) {
  if (!stats.on) startStats();
  stats.live = !!on;
  if (on) {
    send('statsHist', stats.hist);
    clearTimeout(stats.timer); statsLoop();
  }
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
// Icon khay đơn sắc như icon hệ thống: trắng trên taskbar tối, đen trên taskbar sáng (theo màu taskbar của Windows)
function taskbarIsLight() {
  try {
    const { nativeTheme } = require('electron');
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
function buildMenu() {
  return Menu.buildFromTemplate([
    { label: `Dynamic Island ${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: userHidden ? 'Hiện viên thuốc' : 'Ẩn viên thuốc', click: () => { userHidden = !userHidden; updateVisibility(); refreshTrayMenu(); } },
    ...displayMenu(),
    { label: 'Tự ẩn', submenu: [
      { label: 'Không tự ẩn', type: 'radio', checked: hideMode === 'off', click: () => setHide('off') },
      { type: 'separator' },
      { label: 'Khi có cửa sổ bên dưới', enabled: false },
      { label: 'Sau 5 giây không dùng', type: 'radio', checked: hideMode === 'smart', click: () => setHide('smart') },
      { label: 'Ngay lập tức', type: 'radio', checked: hideMode === 'covered', click: () => setHide('covered') },
      { type: 'separator' },
      { label: 'Luôn ẩn khi không dùng', enabled: false },
      ...IDLE_CHOICES.map((v) => ({
        label: `Sau ${v} giây`, type: 'radio', checked: hideMode === 'idle' && idleSec === v, click: () => setHide('idle', v),
      })),
    ] },
    { label: 'Hiện thời tiết', type: 'checkbox', checked: weatherOn(), click: (i) => { const s = loadSettings(); s.weather = i.checked; saveSettings(s); refreshWeather(); } },
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
    // Đổi sáng/tối trong Windows: đổi icon theo
    try { require('electron').nativeTheme.on('updated', () => { try { if (tray && !tray.isDestroyed()) tray.setImage(trayImage()); } catch (e) { log('tray theme:', e.message); } }); } catch (_) {}
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
  loadHideSettings();
  loadClip();
  loadShelf();
  lastClipText = clipList.length ? clipList[0].text : '';
  createWindow();
  buildTray();
  startMedia();
  startStats(); // ghi nền lịch sử CPU/RAM/GPU/mạng cho tab Hệ thống
  refreshWeather();
  pruneThumbs(); setInterval(pruneThumbs, 3600 * 1000); // ảnh bìa đệm: xóa ảnh quá 1 ngày
  // Máy thức dậy sau khi ngủ: cập nhật thời tiết ngay (dữ liệu cũ có thể đã lâu)
  try { require('electron').powerMonitor.on('resume', () => setTimeout(refreshWeather, 5000)); } catch (_) {}
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
  if (s && Number.isFinite(s.w) && Number.isFinite(s.h)) {
    island = { w: s.w, h: s.h };
    // Dạng thu gọn/hover (cao 20..60): cập nhật vùng dò cửa sổ che theo đúng bề rộng viên thuốc
    if (s.h >= 20 && s.h <= 60 && (s.w !== probeBox.w || s.h !== probeBox.h)) { probeBox = { w: s.w, h: s.h }; sendProbe(); }
  }
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
ipcMain.on('stats', (_e, on) => setStatsLive(on));
ipcMain.on('weather-get', () => send('weather', weather.data));
