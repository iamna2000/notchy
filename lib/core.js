// Phần dùng chung cho mọi module của tiến trình chính: thư mục dữ liệu, nhật ký, đọc/ghi cài đặt,
// gửi tin cho viên thuốc, và "hooks" để các module gọi chéo nhau mà không require vòng tròn
// (main.js gán các hàm như peekFor, refreshTrayMenu, pushSettings, sendPrefs lúc khởi động).
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..'); // thư mục app (chứa main.js, renderer/, scripts/, bin/...)
const userDir = () => app.getPath('userData');

function log(...a) {
  try {
    fs.appendFileSync(path.join(userDir(), 'log.txt'), `[${new Date().toISOString()}] ${a.join(' ')}\n`);
  } catch (_) {}
}

const settingsFile = () => path.join(userDir(), 'settings.json');
function loadSettings() {
  // Bỏ BOM ở đầu (Notepad/PowerShell có thể thêm vào): nếu không, JSON.parse lỗi, cài đặt coi như trống
  // và lần lưu tiếp theo sẽ ghi đè mất hết
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8').replace(/^﻿/, '')); } catch (_) { return {}; }
}
function saveSettings(s) {
  try { fs.writeFileSync(settingsFile(), JSON.stringify(s)); } catch (e) { log('save settings:', e.message); }
}

const core = {
  ROOT,
  win: null,         // cửa sổ viên thuốc (main.js gán)
  quitting: false,   // đang thoát app: các cầu nối không tự bật lại
  userDir, log, loadSettings, saveSettings,
  send(ch, v) { const w = core.win; if (w && !w.isDestroyed()) w.webContents.send(ch, v); },
  // Gán bởi main.js / các module; mặc định không làm gì để module dùng được cả khi chưa gán
  hooks: {
    peekFor: () => {},          // giữ viên thuốc hiện ms mili giây (thông báo)
    peek: () => {},             // nở viên thuốc ra một lúc
    refreshTrayMenu: () => {},
    pushSettings: () => {},     // cập nhật cửa sổ Cài đặt nếu đang mở
    sendPrefs: () => {},        // gửi lại cài đặt giao diện cho viên thuốc
    trayImage: () => null,
  },
};

// Khởi động cùng Windows: bản cài đặt chạy thẳng exe; bản chạy từ mã nguồn cần đường dẫn thư mục app
const loginArgs = () => (app.isPackaged ? [] : [app.getAppPath()]);
core.autostartEnabled = () => {
  try { return app.getLoginItemSettings({ path: process.execPath, args: loginArgs() }).openAtLogin; } catch (_) { return false; }
};
core.setAutostart = (on) => {
  try { app.setLoginItemSettings({ openAtLogin: on, path: process.execPath, args: loginArgs() }); } catch (e) { log('autostart:', e.message); }
  const s = loadSettings(); s.autostart = on; saveSettings(s);
};

module.exports = core;
