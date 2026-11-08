// Tự cập nhật (chỉ bản cài đặt; bản mới đăng ở GitHub Releases).
// Mở app và mỗi 4 giờ: kiểm tra bản mới, tải ngầm, báo trên viên thuốc. Cài khi người dùng chọn trong menu
// hoặc tự cài lúc thoát app / tắt máy.
const { app } = require('electron');
const core = require('./core');

const upd = { state: 'idle', version: '', percent: 0, err: '' }; // idle | checking | downloading | ready | latest | error
let updater = null;
const changed = () => core.hooks.refreshTrayMenu(); // menu chuột phải + cửa sổ Cài đặt

function setup() {
  if (!app.isPackaged) return;
  try { updater = require('electron-updater').autoUpdater; } catch (e) { core.log('updater:', e.message); return; }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = { info: (m) => core.log('update:', m), warn: (m) => core.log('update warn:', m), error: (m) => core.log('update error:', m), debug: () => {} };
  updater.on('checking-for-update', () => { upd.state = 'checking'; changed(); });
  updater.on('update-not-available', () => { upd.state = 'latest'; changed(); });
  updater.on('update-available', (i) => { upd.state = 'downloading'; upd.version = i.version; upd.percent = 0; changed(); });
  updater.on('download-progress', (pr) => { const p = Math.floor(pr.percent || 0); if (p - upd.percent >= 10) { upd.percent = p; changed(); } });
  updater.on('update-downloaded', (i) => {
    upd.state = 'ready'; upd.version = i.version; changed();
    core.send('toast', { kind: 'update', title: `Có bản mới ${i.version}`, sub: 'Chuột phải viên thuốc > Cập nhật, hoặc tự cài khi tắt máy' });
    core.hooks.peek();
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

module.exports = { setup, check, install, state: () => ({ ...upd }) };
