// Bảng tạm: theo dõi clipboard (văn bản), lưu lịch sử, ghim, tìm, chép lại.
// Cài đặt: clipMax (số mục nhớ, không tính mục ghim), clipPaused (tạm dừng ghi), clipPersist (lưu xuống đĩa).
const { ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const core = require('./core');
const P = require('./prefs');

const clipFile = () => path.join(core.userDir(), 'clip.json');
let list = [];
let dirty = false;
let lastText = '';
let cfgCache = null;
const cfg = () => cfgCache || (cfgCache = P.clipCfgFrom(core.loadSettings()));

function load() {
  try { const a = JSON.parse(fs.readFileSync(clipFile(), 'utf8')); if (Array.isArray(a)) list = a.filter((x) => x && typeof x.text === 'string'); } catch (_) {}
  lastText = list.length ? list[0].text : '';
}
function flush() {
  if (!dirty) return;
  dirty = false;
  // Không lưu xuống đĩa: chỉ giữ mục đã ghim trong tệp, lịch sử còn lại mất khi tắt app
  const out = cfg().persist ? list : list.filter((x) => x.pin);
  try { fs.writeFileSync(clipFile(), JSON.stringify(out)); } catch (e) { core.log('save clip:', e.message); }
}
function changed() { dirty = true; core.send('clip', list); }
function poll() {
  let text = '';
  try {
    // Trình quản lý mật khẩu đánh dấu nội dung nhạy cảm bằng định dạng này => bỏ qua
    if (clipboard.availableFormats().some((f) => /ExcludeClipboardContentFromMonitorProcessing/i.test(f))) return;
    text = clipboard.readText();
  } catch (_) { return; }
  if (!text || !text.trim() || text === lastText) return;
  lastText = text;
  if (cfg().paused) return; // tạm dừng ghi: vẫn cập nhật lastText để bật lại không ghi bù
  if (text.length > 5000) text = text.slice(0, 5000);
  const old = list.find((x) => x.text === text);
  list = list.filter((x) => x.text !== text);
  list.unshift({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, pin: old ? !!old.pin : false, ts: Date.now() });
  list = P.trimClipList(list, cfg().max);
  changed();
}
function clearUnpinned() { list = list.filter((x) => x.pin); changed(); }

// Đổi cài đặt bảng tạm (từ cửa sổ Cài đặt hoặc nút tạm dừng trên viên thuốc); trả true nếu khóa thuộc bảng tạm
function applySetting(key, val) {
  const s = core.loadSettings();
  switch (key) {
    case 'clipMax':
      if (!P.CLIP_MAXES.includes(Number(val))) return true;
      s.clipMax = Number(val); core.saveSettings(s); cfgCache = null;
      list = P.trimClipList(list, cfg().max); changed();
      return true;
    case 'clipPaused': s.clipPaused = !!val; core.saveSettings(s); cfgCache = null; return true;
    case 'clipPersist': s.clipPersist = !!val; core.saveSettings(s); cfgCache = null; dirty = true; flush(); return true;
    default: return false;
  }
}
function settingsView() {
  const c = cfg();
  return { clipMax: c.max, clipPersist: c.persist, clipCount: list.filter((x) => !x.pin).length, clipPinned: list.filter((x) => x.pin).length };
}
function start() {
  load();
  setInterval(poll, 700);
  setInterval(flush, 2000);
}

function registerIpc() {
  ipcMain.on('clip-get', () => core.send('clip', list));
  ipcMain.on('clip-pause', (_e, v) => { applySetting('clipPaused', !!v); core.hooks.sendPrefs(); core.hooks.pushSettings(); });
  // Bấm một mục: chỉ chép vào clipboard (không tự dán). Giữ nguyên thứ tự danh sách (lastText để vòng
  // theo dõi clipboard không coi đây là nội dung mới).
  ipcMain.on('clip-copy', (_e, id) => {
    const it = list.find((x) => x.id === id);
    if (!it) return;
    lastText = it.text;
    clipboard.writeText(it.text);
  });
  ipcMain.on('clip-pin', (_e, id) => { const it = list.find((x) => x.id === id); if (it) { it.pin = !it.pin; changed(); } });
  ipcMain.on('clip-del', (_e, id) => { list = list.filter((x) => x.id !== id); changed(); });
  ipcMain.on('clip-clear', clearUnpinned);
}

module.exports = { start, flush, clearUnpinned, applySetting, settingsView, resetCache: () => { cfgCache = null; }, registerIpc };
