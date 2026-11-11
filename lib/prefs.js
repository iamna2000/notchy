// Chuẩn hóa cài đặt: hàm thuần (không đụng tới Electron hay tệp), nhận object cài đặt và trả kết quả,
// để kiểm thử được bằng node --test (xem test/prefs.test.js).

// ----- Tự ẩn -----
//   'off'     luôn hiện
//   'tabs'    chỉ ẩn khi viên thuốc đang che tab (Chrome/Edge/Brave/Cốc Cốc/Firefox/Explorer)
//   'window'  có cửa sổ nằm dưới viên thuốc thì ẩn, sau delay giây không dùng (0 = ngay); trên màn hình nền thì hiện
// Bản cũ: 'smart' = window + 5 giây, 'covered' = window + 0 giây, 'idle' (đã bỏ) -> window + 5 giây
const HIDE_MODES = ['off', 'tabs', 'window'];
const HIDE_DELAYS = [0, 5, 10];
function normalizeHide(s) {
  let m = s.hideMode, d = Number(s.hideDelay);
  if (m === 'smart' || m === 'idle') { m = 'window'; d = 5; }
  else if (m === 'covered') { m = 'window'; d = 0; }
  const mode = HIDE_MODES.includes(m) ? m : 'window';
  const delay = HIDE_DELAYS.includes(d) ? d : 5;
  return { mode, delay, fullBar: s.fullBar !== false, changed: s.hideMode !== mode || Number(s.hideDelay) !== delay || 'idleHide' in s };
}

// ----- Phím tắt mở viên thuốc ('' = tắt) -----
const HOTKEYS = ['Control+Alt+Space', 'Control+Shift+Space', 'Alt+Shift+N', ''];
// Danh sách tổ hợp cần thử: người dùng đã chọn thì chỉ tổ hợp đó; chưa chọn thì thử lần lượt
function hotkeyTries(s) {
  return HOTKEYS.includes(s.hotkey) ? (s.hotkey ? [s.hotkey] : []) : HOTKEYS.filter(Boolean);
}

// ----- Bảng tạm -----
const CLIP_MAXES = [20, 50, 100, 200];
function clipCfgFrom(s) {
  return { max: CLIP_MAXES.includes(s.clipMax) ? s.clipMax : 50, paused: !!s.clipPaused, persist: s.clipPersist !== false };
}
// Giữ mục đã ghim + max mục chưa ghim mới nhất (danh sách mới nhất ở đầu)
function trimClipList(list, max) {
  let n = 0;
  return list.filter((x) => x.pin || ++n <= max);
}

// ----- Giao diện viên thuốc -----
// Kích thước viên thuốc: hệ số phóng (chữ, icon, khoảng cách cùng tỉ lệ). Giá trị lạ -> 1 (Vừa)
const PILL_SCALES = [0.9, 1, 1.15, 1.3];
const pillScale = (s) => (PILL_SCALES.includes(Number(s.pillScale)) ? Number(s.pillScale) : 1);
const TABS = ['music', 'weather', 'calendar', 'clip', 'shelf', 'sys'];
const TAB_RESETS = [0, 60, 300, 900];
const NOTIFY_KINDS = ['download', 'shot', 'device', 'battery', 'update'];
function rendererPrefsFrom(s) {
  const notify = {};
  for (const k of NOTIFY_KINDS) notify[k] = !(s.notify && s.notify[k] === false);
  // Tab ẩn (luôn còn ít nhất 1 tab); trang mặc định phải là tab đang hiện
  const hidden = Array.isArray(s.tabsHidden) ? s.tabsHidden.filter((t) => TABS.includes(t)) : [];
  const tabsHidden = hidden.length < TABS.length ? [...new Set(hidden)] : [];
  const visible = TABS.filter((t) => !tabsHidden.includes(t));
  let defaultTab = TABS.includes(s.defaultTab) ? s.defaultTab : 'music';
  if (!visible.includes(defaultTab)) defaultTab = visible[0];
  return {
    defaultTab, tabsHidden,
    tabReset: TAB_RESETS.includes(s.tabReset) ? s.tabReset : 60,
    notify,
    tempUnit: s.tempUnit === 'F' ? 'F' : 'C',
    clipPaused: clipCfgFrom(s).paused,
    pillScale: pillScale(s),
  };
}

// ----- Thời tiết -----
const MAX_PLACES = 8;
// Chuyển dữ liệu cũ (weatherCity -> weatherPlaces; bỏ công tắc "Hiện thời tiết"). Sửa trực tiếp s, trả true nếu có đổi.
function migrateWeather(s, now = Date.now()) {
  let changed = false;
  if (s.weatherCity) {
    const c = s.weatherCity;
    s.weatherPlaces = Array.isArray(s.weatherPlaces) ? s.weatherPlaces : [];
    if (Number.isFinite(c.lat) && Number.isFinite(c.lon)) {
      const id = 'p' + now.toString(36);
      s.weatherPlaces.push({ id, name: c.name || 'Địa điểm', sub: '', lat: c.lat, lon: c.lon });
      s.weatherMain = id;
    }
    delete s.weatherCity; changed = true;
  }
  if ('weather' in s) { delete s.weather; changed = true; }
  return changed;
}
function weatherCfgFrom(s) {
  const places = (Array.isArray(s.weatherPlaces) ? s.weatherPlaces : [])
    .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon)).slice(0, MAX_PLACES);
  return { auto: s.weatherAuto !== false, places, main: s.weatherMain || 'auto' };
}
// Thêm địa điểm: trả danh sách mới, hoặc null nếu không hợp lệ / đã đủ / trùng (cách nhau dưới ~1 km)
function addPlace(places, p, now = Date.now()) {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || places.length >= MAX_PLACES) return null;
  if (places.some((x) => Math.abs(x.lat - p.lat) < 0.01 && Math.abs(x.lon - p.lon) < 0.01)) return null;
  const item = { id: 'p' + now.toString(36), name: String(p.name || 'Địa điểm').slice(0, 60), sub: String(p.sub || '').slice(0, 80), lat: p.lat, lon: p.lon };
  return [...places, item];
}
// Đổi chỗ địa điểm id lên (dir < 0) / xuống (dir > 0); không đổi được thì null
function movePlace(places, id, dir) {
  const list = [...places], i = list.findIndex((p) => p.id === id), j = i + (dir > 0 ? 1 : -1);
  if (i < 0 || j < 0 || j >= list.length) return null;
  [list[i], list[j]] = [list[j], list[i]];
  return list;
}

// ----- Khôi phục mặc định / báo lỗi -----
// Các khóa là "tùy chỉnh" (xóa khi khôi phục mặc định); còn lại là dữ liệu (ghi chú, kệ, địa điểm...)
const PREF_KEYS = ['hideMode', 'hideDelay', 'idleHide', 'fullBar', 'defaultTab', 'tabReset', 'notify', 'tabsHidden', 'hotkey',
  'clipMax', 'clipPaused', 'clipPersist', 'tempUnit', 'shelfShots', 'display', 'pillScale'];
function resetPrefs(s) {
  for (const k of PREF_KEYS) delete s[k];
  return s;
}
// Cài đặt đưa vào tệp báo lỗi: chỉ tùy chỉnh, không có dữ liệu riêng tư (kệ, ghi chú, tọa độ...)
function safeSettings(s) {
  const out = {};
  for (const k of PREF_KEYS.concat(['autostart', 'weatherAuto'])) if (k in s) out[k] = s[k];
  out.weatherPlaces = Array.isArray(s.weatherPlaces) ? s.weatherPlaces.length : 0;
  return out;
}

// ---------- Khởi động cùng Windows ----------
// Đối số riêng cho lần chạy lúc đăng nhập Windows, để bản chạy sau (second-instance) biết không phải người dùng mở.
const AUTOSTART_ARG = '--autostart';
// Một bản khác mở lên khi app đang chạy (menu Start, chay.bat, bản cài và bản mã nguồn cùng mở, lúc bật máy):
// showPill = hiện lại viên thuốc; settings = mục Cài đặt cần mở, null = không mở.
// Cài đặt chỉ mở khi được yêu cầu rõ (--settings=mục); trước đây mở lại app là bật Cài đặt, người dùng thấy
// bảng Cài đặt tự hiện lên dù không cần.
function secondInstance(argv) {
  const a = (argv || []).map(String);
  if (a.includes(AUTOSTART_ARG)) return { showPill: false, settings: null };
  const sec = a.find((x) => x.startsWith('--settings='));
  return { showPill: true, settings: sec ? sec.slice(11) : null };
}
// Mục khởi động trỏ tới đúng lệnh chạy app nhưng mang tên khác tên hiện tại (tên theo AppUserModelId cũ:
// electron.app.Electron, DynamicIsland.Windows) là thừa: mỗi mục làm app chạy thêm một lần lúc bật máy.
const staleLoginItems = (items, currentName) => (items || []).filter((it) => it && it.name && it.name !== currentName);

module.exports = {
  AUTOSTART_ARG, secondInstance, staleLoginItems,
  HIDE_MODES, HIDE_DELAYS, normalizeHide,
  HOTKEYS, hotkeyTries,
  CLIP_MAXES, clipCfgFrom, trimClipList,
  TABS, TAB_RESETS, NOTIFY_KINDS, rendererPrefsFrom, PILL_SCALES, pillScale,
  MAX_PLACES, migrateWeather, weatherCfgFrom, addPlace, movePlace,
  PREF_KEYS, resetPrefs, safeSettings,
};
