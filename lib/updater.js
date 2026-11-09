// Tự cập nhật (chỉ bản cài đặt; bản mới đăng ở GitHub Releases bằng phat-hanh.bat).
// Mở app và mỗi 4 giờ: kiểm tra bản mới, tải ngầm. Tải xong:
//   - thông báo trên viên thuốc (kèm dòng "có gì mới" lấy từ ghi chú phát hành), nhắc lại mỗi 6 giờ nếu chưa cập nhật
//   - nút "Cập nhật" màu xanh trên thanh tab của viên thuốc, mục trong menu chuột phải, chấm cam trong Cài đặt
// Cài khi người dùng bấm, hoặc tự cài lúc thoát app / tắt máy.
const { app } = require('electron');
const core = require('./core');

const upd = { state: 'idle', version: '', percent: 0, err: '', notes: '' }; // idle | checking | downloading | ready | latest | error
let updater = null;
let remindTimer = null;
const REMIND_MS = 6 * 3600 * 1000;

// Gửi trạng thái cho viên thuốc (nút Cập nhật) + menu chuột phải + cửa sổ Cài đặt
function changed() {
  core.hooks.refreshTrayMenu();
  core.send('update', upd.state === 'ready' ? { version: upd.version, notes: upd.notes } : null);
}

// Ghi chú phát hành từ GitHub: HTML hoặc danh sách theo từng bản -> một dòng chữ thường, tối đa 140 ký tự
function plainNotes(n) {
  if (Array.isArray(n)) n = n.map((x) => (x && x.note) || '').join(' · ');
  const s = String(n || '')
    .replace(/<\/(p|li|h\d)>/gi, ' · ').replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').replace(/(\s*·\s*){2,}/g, ' · ').replace(/(\s·\s*)+$/, '').replace(/^(\s*·\s)+/, '').trim();
  return s.length > 140 ? s.slice(0, 139).trimEnd() + '…' : s;
}
module.exports.plainNotes = plainNotes;

function remind() {
  if (upd.state !== 'ready') return;
  core.send('toast', { kind: 'update', title: `Có bản mới ${upd.version}`, sub: upd.notes || 'Bấm nút Cập nhật trên viên thuốc, hoặc tự cài khi tắt máy' });
  core.hooks.peek();
}

function setup() {
  if (!app.isPackaged) return;
  try { updater = require('electron-updater').autoUpdater; } catch (e) { core.log('updater:', e.message); return; }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = { info: (m) => core.log('update:', m), warn: (m) => core.log('update warn:', m), error: (m) => core.log('update error:', m), debug: () => {} };
  updater.on('checking-for-update', () => { upd.state = 'checking'; changed(); });
  updater.on('update-not-available', () => { upd.state = 'latest'; changed(); });
  updater.on('update-available', (i) => { upd.state = 'downloading'; upd.version = i.version; upd.percent = 0; upd.notes = plainNotes(i.releaseNotes); changed(); });
  updater.on('download-progress', (pr) => { const p = Math.floor(pr.percent || 0); if (p - upd.percent >= 10) { upd.percent = p; core.hooks.refreshTrayMenu(); } });
  updater.on('update-downloaded', (i) => {
    upd.state = 'ready'; upd.version = i.version;
    upd.notes = plainNotes(i.releaseNotes) || upd.notes;
    changed();
    remind();
    clearInterval(remindTimer);
    remindTimer = setInterval(remind, REMIND_MS); // lỡ mất thông báo đầu: nhắc lại
  });
  updater.on('error', (e) => { upd.state = 'error'; upd.err = String((e && e.message) || e).split(/\r?\n/)[0].trim(); core.log('update error:', upd.err); changed(); });
  setTimeout(check, 15000);
  setInterval(check, 4 * 3600 * 1000);
}
function check() {
  if (updater && upd.state !== 'downloading' && upd.state !== 'checking' && upd.state !== 'ready') updater.checkForUpdates().catch(() => {});
}
function install() {
  if (updater && upd.state === 'ready') { core.quitting = true; updater.quitAndInstall(true, true); }
}

Object.assign(module.exports, { setup, check, install, state: () => ({ ...upd }) });
