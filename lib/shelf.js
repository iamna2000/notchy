// Kệ tạm (kéo tệp vào / ra) + thông báo "tải xong" (thư mục Downloads) + ảnh chụp màn hình tự lên kệ.
const { app, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const core = require('./core');

let shelf = [];                 // [{ id, path, shot? }] chỉ lưu đường dẫn, không sao chép tệp
const iconCache = new Map();
const newId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const exists = (p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } };

function load() {
  const s = core.loadSettings();
  shelf = Array.isArray(s.shelf) ? s.shelf.filter((x) => x && typeof x.id === 'string' && typeof x.path === 'string') : [];
}
function save() { const s = core.loadSettings(); s.shelf = shelf; core.saveSettings(s); }
async function payload() {
  const before = shelf.length;
  shelf = shelf.filter((x) => exists(x.path));
  if (shelf.length !== before) save();
  const out = [];
  for (const it of shelf) {
    let icon = iconCache.get(it.path);
    if (!icon) {
      try { icon = (await app.getFileIcon(it.path, { size: 'normal' })).toDataURL(); } catch (_) { icon = ''; }
      if (icon) { if (iconCache.size > 200) iconCache.clear(); iconCache.set(it.path, icon); }
    }
    let size = 0;
    try { const st = fs.statSync(it.path); if (st.isFile()) size = st.size; } catch (_) {}
    out.push({ id: it.id, name: path.basename(it.path) || it.path, dir: path.dirname(it.path), icon, size, thumb: await thumbOf(it.path) });
  }
  return out;
}
// Ảnh / video: lấy ảnh xem trước của Windows (như Explorer). Lưu theo đường dẫn + thời điểm sửa tệp,
// tệp bị sửa thì tự lấy lại. Không lấy được (định dạng lạ, thiếu codec) thì dùng icon như cũ.
const THUMB_EXT = /\.(png|jpe?g|gif|webp|bmp|tiff?|heic|heif|avif|ico|jfif|mp4|mov|mkv|avi|webm|wmv|m4v)$/i;
const thumbs = new Map();
async function thumbOf(p) {
  if (!THUMB_EXT.test(p) || process.platform !== 'win32') return '';
  let key;
  try { key = p + '|' + fs.statSync(p).mtimeMs; } catch (_) { return ''; }
  if (thumbs.has(key)) return thumbs.get(key);
  let url = '';
  try {
    const img = await nativeImage.createThumbnailFromPath(p, { width: 192, height: 192 });
    if (!img.isEmpty()) url = img.toDataURL();
  } catch (e) { core.log('shelf thumb:', path.basename(p), e.message); }
  if (thumbs.size > 100) thumbs.clear();
  thumbs.set(key, url);
  return url;
}
async function sendShelf() { try { core.send('shelf', await payload()); } catch (e) { core.log('shelf:', e.message); } }
function clear() { shelf = []; save(); sendShelf(); }

// ----- Thông báo "tải xong" -----
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
      core.hooks.peekFor(4200);
      core.send('toast', { kind: 'download', title: 'Đã tải xong', sub: name });
    }, 1200);
  };
  try {
    fs.watch(dir, { persistent: false }, (_evt, name) => {
      if (!name || TEMP.test(name) || /^(~\$|\.)/.test(name)) return;
      clearTimeout(timers.get(name));
      timers.set(name, setTimeout(() => { timers.delete(name); check(name); }, 1500));
    });
    core.log('watching downloads:', dir);
  } catch (e) { core.log('watch downloads:', e.message); }
}

// ----- Ảnh chụp màn hình -> Kệ tạm -----
// Win+Shift+S / PrtScn: Snipping Tool tự lưu ảnh vào Pictures/Screenshots (mặc định trên Windows 11).
// Theo dõi thư mục đó (cả bản OneDrive nếu có): ảnh mới được đưa lên đầu kệ để kéo thả ngay.
// Kệ chỉ giữ 10 ảnh chụp tự thêm gần nhất (tệp thật không bị xóa). Tắt được trong Cài đặt.
const SHOT_KEEP = 10;
const shotsOn = () => core.loadSettings().shelfShots !== false;
function addShot(f) {
  if (!shotsOn() || shelf.some((x) => x.path === f)) return;
  shelf.unshift({ id: newId(), path: f, shot: true });
  let n = 0;
  shelf = shelf.filter((x) => !x.shot || ++n <= SHOT_KEEP).slice(0, 40);
  save(); sendShelf();
  core.hooks.peekFor(4200);
  thumbOf(f).then((thumb) => core.send('toast', { kind: 'shot', title: 'Đã thêm vào Kệ tạm', sub: path.basename(f), thumb }));
}
function watchScreenshots() {
  const dirs = new Set();
  try { dirs.add(path.join(app.getPath('pictures'), 'Screenshots')); } catch (_) {}
  if (process.env.OneDrive) dirs.add(path.join(process.env.OneDrive, 'Pictures', 'Screenshots'));
  const IMG = /\.(png|jpe?g|gif|webp|bmp)$/i;
  const timers = new Map();
  for (const dir of dirs) {
    if (!exists(dir)) continue;
    const check = (f, size0) => {
      let st;
      try { st = fs.statSync(f); } catch (_) { return; }
      if (!st.isFile() || st.size === 0 || Date.now() - st.birthtimeMs > 30000) return; // chỉ ảnh vừa tạo
      if (st.size !== size0) { timers.set(f, setTimeout(() => check(f, st.size), 600)); return; } // đợi ghi xong
      addShot(f);
    };
    try {
      fs.watch(dir, { persistent: false }, (_evt, name) => {
        if (!name || !IMG.test(name)) return;
        const f = path.join(dir, name);
        clearTimeout(timers.get(f));
        timers.set(f, setTimeout(() => check(f, -1), 500));
      });
      core.log('watching screenshots:', dir);
    } catch (e) { core.log('watch screenshots:', e.message); }
  }
}

function start() {
  load();
  watchDownloads();
  watchScreenshots();
}
function settingsView() { return { shelfShots: shotsOn(), shelfCount: shelf.length }; }

function registerIpc() {
  ipcMain.on('shelf-get', () => sendShelf());
  ipcMain.on('shelf-add', (_e, paths) => {
    if (!Array.isArray(paths)) return;
    for (const p of paths.slice(0, 50)) {
      if (typeof p !== 'string' || !path.isAbsolute(p) || !exists(p) || shelf.some((x) => x.path === p)) continue;
      shelf.unshift({ id: newId(), path: p });
    }
    shelf = shelf.slice(0, 40);
    save(); sendShelf();
  });
  ipcMain.on('shelf-del', (_e, id) => { shelf = shelf.filter((x) => x.id !== id); save(); sendShelf(); });
  ipcMain.on('shelf-clear', clear);
  ipcMain.on('shelf-open', (_e, id) => { const it = shelf.find((x) => x.id === id); if (it && exists(it.path)) shell.showItemInFolder(it.path); });
  ipcMain.on('shelf-drag', (e, id) => {
    const it = shelf.find((x) => x.id === id);
    if (!it || !exists(it.path)) return;
    let icon = null;
    try { const c = iconCache.get(it.path); if (c) icon = nativeImage.createFromDataURL(c); } catch (_) {}
    if (!icon || icon.isEmpty()) icon = core.hooks.trayImage();
    if (core.hooks.beginOutDrag) core.hooks.beginOutDrag(); // đóng băng theo dõi chuột trong lúc kéo (xem main.js)
    try { e.sender.startDrag({ file: it.path, icon }); } catch (err) { core.log('shelf drag:', err.message); }
  });
}

module.exports = { start, clear, settingsView, registerIpc };
