// Cửa sổ Cài đặt (renderer/settings.html) + cài đặt giao diện gửi cho viên thuốc + khôi phục mặc định,
// tạo báo lỗi. Phần điều khiển viên thuốc (tự ẩn, phím tắt, ẩn/hiện, màn hình) do main.js
// cung cấp qua init(pill).
const { app, BrowserWindow, ipcMain, screen, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const core = require('./core');
const P = require('./prefs');
const weather = require('./weather');
const clip = require('./clip');
const shelf = require('./shelf');
const updater = require('./updater');

let pill = null;   // xem init()
let setWin = null;

function rendererPrefs() {
  let hz = 0;
  try { hz = pill ? pill.targetDisplay().displayFrequency : 0; } catch (_) {}
  return { ...P.rendererPrefsFrom(core.loadSettings()), mqRate: P.mqStepRate(hz) };
}
function sendPrefs() { core.send('prefs', rendererPrefs()); }

function settingsState() {
  const all = screen.getAllDisplays(), primary = screen.getPrimaryDisplay(), cur = pill.targetDisplay();
  const h = pill.hide(), hk = pill.hotkey();
  return {
    version: app.getVersion(), packaged: app.isPackaged,
    autostart: core.autostartEnabled(), shown: !pill.isUserHidden(),
    displays: all.map((d, i) => ({ id: d.id, name: pill.displayName(d, i) + (d.id === primary.id ? ' · chính' : '') })), display: cur.id,
    hideMode: h.mode, hideDelay: h.delay, fullBar: h.fullBar,
    hotkey: hk.hotkey, hotkeyOk: hk.ok, hotkeyAuto: hk.auto,
    ...clip.settingsView(),
    ...weather.settingsView(),
    ...shelf.settingsView(),
    ...rendererPrefs(),
    upd: updater.state(),
  };
}
function pushSettings() {
  if (setWin && !setWin.isDestroyed()) setWin.webContents.send('settings:state', settingsState());
}

// Theo chế độ sáng / tối của Windows (trang dùng prefers-color-scheme; nút đóng/thu nhỏ đổi màu theo)
function theme() {
  return nativeTheme.shouldUseDarkColors ? { color: '#0e0e10', symbolColor: '#d1d1d6' } : { color: '#f2f2f7', symbolColor: '#1c1c1e' };
}
function openSettings(section) {
  if (setWin && !setWin.isDestroyed()) {
    if (setWin.isMinimized()) setWin.restore();
    setWin.show(); setWin.focus();
    if (section) setWin.webContents.send('settings:goto', section);
    return;
  }
  const th = theme();
  setWin = new BrowserWindow({
    width: 820, height: 600, minWidth: 680, minHeight: 480, show: false,
    title: 'Cài đặt Notchy', backgroundColor: th.color, autoHideMenuBar: true,
    titleBarStyle: 'hidden', titleBarOverlay: { ...th, height: 40 },
    icon: path.join(core.ROOT, 'build', 'icon.png'),
    webPreferences: { preload: path.join(core.ROOT, 'settings-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  setWin.setMenu(null);
  setWin.loadFile(path.join(core.ROOT, 'renderer', 'settings.html'), section ? { hash: section } : undefined);
  setWin.once('ready-to-show', () => { if (setWin) setWin.show(); });
  setWin.on('closed', () => { setWin = null; });
}

// Thay đổi một cài đặt; các module tự xử lý khóa của mình (thời tiết, bảng tạm)
function applySetting(key, val) {
  if (weather.applySetting(key, val) || clip.applySetting(key, val)) return;
  const s = core.loadSettings();
  switch (key) {
    case 'autostart': core.setAutostart(!!val); break;
    case 'shown': pill.setUserHidden(!val); break;
    case 'display': {
      const d = screen.getAllDisplays().find((x) => x.id === Number(val));
      if (d) { s.display = { id: d.id, label: d.label || '' }; core.saveSettings(s); pill.placeWindow(); core.hooks.peekFor(2500); }
      break;
    }
    case 'hideMode': if (P.HIDE_MODES.includes(val)) pill.setHide(val); break;
    case 'hideDelay': if (P.HIDE_DELAYS.includes(Number(val))) pill.setHide('window', Number(val)); break;
    case 'fullBar': s.fullBar = !!val; core.saveSettings(s); pill.reloadHide(); break;
    case 'hotkey': if (P.HOTKEYS.includes(val)) { s.hotkey = val; core.saveSettings(s); pill.registerHotkey(); } break;
    case 'tabsHidden':
      if (Array.isArray(val)) {
        const h = val.filter((t) => P.TABS.includes(t));
        if (h.length < P.TABS.length) { s.tabsHidden = h; core.saveSettings(s); }
      }
      break;
    case 'tempUnit': s.tempUnit = val === 'F' ? 'F' : 'C'; core.saveSettings(s); break;
    case 'shelfShots': s.shelfShots = !!val; core.saveSettings(s); break;
    case 'defaultTab': if (P.TABS.includes(val)) { s.defaultTab = val; core.saveSettings(s); } break;
    case 'pillScale': if (P.PILL_SCALES.includes(Number(val))) { s.pillScale = Number(val); core.saveSettings(s); pill.applyScale(); } break;
    case 'tabReset': if (P.TAB_RESETS.includes(Number(val))) { s.tabReset = Number(val); core.saveSettings(s); } break;
    case 'notify':
      if (val && P.NOTIFY_KINDS.includes(val.kind)) { s.notify = { ...(s.notify || {}), [val.kind]: !!val.on }; core.saveSettings(s); }
      break;
  }
}

// Khôi phục cài đặt mặc định (giữ dữ liệu: ghi chú, bảng tạm, kệ tạm, địa điểm thời tiết)
function resetDefaults() {
  core.saveSettings(P.resetPrefs(core.loadSettings()));
  clip.resetCache();
  pill.setUserHidden(false); pill.reloadHide(); pill.registerHotkey(); pill.placeWindow();
  sendPrefs(); core.hooks.refreshTrayMenu();
  core.log('settings: khôi phục mặc định');
}
// Gửi báo lỗi: ghi một tệp văn bản ra Desktop (phiên bản, máy, cài đặt đã bỏ dữ liệu riêng tư, 400 dòng nhật ký cuối)
// rồi mở thư mục chứa tệp và trang báo lỗi trên GitHub để người dùng đính kèm. Không tự gửi gì đi.
function writeReport() {
  try {
    let logTail = '';
    try { logTail = fs.readFileSync(path.join(core.userDir(), 'log.txt'), 'utf8').split(/\r?\n/).slice(-400).join('\n'); } catch (_) {}
    const disp = screen.getAllDisplays().map((d) => `${d.size.width}x${d.size.height} @${d.scaleFactor}`).join(', ');
    const h = pill.hide(), dbg = pill.debug();
    const txt = [
      'Notchy - báo lỗi', new Date().toString(), '',
      `Phiên bản: ${app.getVersion()} (${app.isPackaged ? 'bản cài đặt' : 'chạy từ mã nguồn'})`,
      `Windows: ${os.release()} ${os.arch()} · Electron ${process.versions.electron}`,
      `Màn hình: ${disp}`, `RAM: ${Math.round(os.totalmem() / 1073741824)} GB · CPU: ${(os.cpus()[0] || {}).model || '?'}`,
      `Tự ẩn: ${h.mode}/${h.delay}s · che: ${dbg.covered} · tab: ${dbg.tabUnder} · toàn màn hình: ${dbg.fullUnder}/${dbg.fsHidden}`, '',
      'Cài đặt (đã bỏ dữ liệu riêng tư):', JSON.stringify(P.safeSettings(core.loadSettings()), null, 2), '',
      'Mô tả lỗi (bạn viết thêm ở đây):', '', '', '----- Nhật ký -----', logTail,
    ].join('\n');
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    const file = path.join(app.getPath('desktop'), `Notchy-bao-loi-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.txt`);
    fs.writeFileSync(file, '﻿' + txt, 'utf8');
    shell.showItemInFolder(file);
    shell.openExternal('https://github.com/iamna2000/notchy/issues/new');
    return file;
  } catch (e) { core.log('report:', e.message); return ''; }
}
function init(pillApi) {
  pill = pillApi;
  core.hooks.pushSettings = pushSettings;
  core.hooks.sendPrefs = sendPrefs;
  nativeTheme.on('updated', () => {
    if (!setWin || setWin.isDestroyed()) return;
    const th = theme();
    try { setWin.setTitleBarOverlay(th); setWin.setBackgroundColor(th.color); } catch (_) {}
  });
  ipcMain.handle('settings:get', () => settingsState());
  ipcMain.handle('settings:set', (_e, key, val) => {
    applySetting(key, val);
    sendPrefs(); core.hooks.refreshTrayMenu();
    return settingsState();
  });
  ipcMain.handle('settings:act', (_e, act) => {
    let ret = true;
    switch (act) {
      case 'checkUpdate': updater.check(); break;
      case 'installUpdate': updater.install(); break;
      case 'openLog': shell.showItemInFolder(path.join(core.userDir(), 'log.txt')); break;
      case 'openData': shell.openPath(core.userDir()); break;
      case 'repo': shell.openExternal('https://github.com/iamna2000/notchy'); break;
      case 'clipClear': clip.clearUnpinned(); break;
      case 'shelfClear': shelf.clear(); break;
      case 'peek': pill.setUserHidden(false); core.hooks.peek(); break;
      case 'restart': app.relaunch(); app.quit(); break;
      case 'reset': resetDefaults(); break;
      case 'report': ret = writeReport(); break;
      case 'quit': app.quit(); break;
    }
    setTimeout(pushSettings, 50);
    return ret;
  });
  ipcMain.on('open-settings', (_e, sec) => openSettings(typeof sec === 'string' ? sec : ''));
}

module.exports = { init, openSettings, sendPrefs, pushSettings };
