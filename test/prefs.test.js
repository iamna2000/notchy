// Chuẩn hóa cài đặt (lib/prefs.js). Chạy: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../lib/prefs');

test('tự ẩn: chế độ cũ được chuyển sang 3 chế độ mới', () => {
  assert.deepEqual(P.normalizeHide({ hideMode: 'smart' }), { mode: 'window', delay: 5, fullBar: true, changed: true });
  assert.deepEqual(P.normalizeHide({ hideMode: 'covered' }), { mode: 'window', delay: 0, fullBar: true, changed: true });
  assert.equal(P.normalizeHide({ hideMode: 'idle', idleHide: 30 }).mode, 'window');
  assert.equal(P.normalizeHide({ hideMode: 'tabs', hideDelay: 5 }).changed, false);
  assert.equal(P.normalizeHide({}).mode, 'window', 'mặc định');
  assert.equal(P.normalizeHide({ hideMode: 'window', hideDelay: 7 }).delay, 5, 'độ trễ lạ -> 5 giây');
  assert.equal(P.normalizeHide({ fullBar: false }).fullBar, false);
});

test('phím tắt: chưa chọn thì thử lần lượt, đã chọn thì chỉ tổ hợp đó, tắt thì không đăng ký', () => {
  assert.deepEqual(P.hotkeyTries({}), ['Control+Alt+Space', 'Control+Shift+Space', 'Alt+Shift+N']);
  assert.deepEqual(P.hotkeyTries({ hotkey: 'Alt+Shift+N' }), ['Alt+Shift+N']);
  assert.deepEqual(P.hotkeyTries({ hotkey: '' }), []);
  assert.equal(P.hotkeyTries({ hotkey: 'Ctrl+X' }).length, 3, 'giá trị lạ coi như chưa chọn');
});

test('bảng tạm: cấu hình và cắt bớt giữ mục ghim', () => {
  assert.deepEqual(P.clipCfgFrom({}), { max: 50, paused: false, persist: true });
  assert.deepEqual(P.clipCfgFrom({ clipMax: 20, clipPaused: true, clipPersist: false }), { max: 20, paused: true, persist: false });
  assert.equal(P.clipCfgFrom({ clipMax: 33 }).max, 50);
  const list = [{ id: 1 }, { id: 2, pin: true }, { id: 3 }, { id: 4 }, { id: 5, pin: true }];
  assert.deepEqual(P.trimClipList(list, 2).map((x) => x.id), [1, 2, 3, 5]);
});

test('giao diện: tab ẩn, trang mặc định luôn là tab đang hiện', () => {
  const p = P.rendererPrefsFrom({ tabsHidden: ['music', 'sys', 'xyz'], defaultTab: 'music' });
  assert.deepEqual(p.tabsHidden, ['music', 'sys']);
  assert.equal(p.defaultTab, 'weather', 'Nhạc bị ẩn -> trang mặc định là tab hiện đầu tiên');
  assert.deepEqual(P.rendererPrefsFrom({ tabsHidden: P.TABS }).tabsHidden, [], 'ẩn hết 6 tab không hợp lệ');
  const d = P.rendererPrefsFrom({});
  assert.equal(d.defaultTab, 'music');
  assert.equal(d.tabReset, 60);
  assert.equal(d.tempUnit, 'C');
  assert.equal(d.notify.download, true);
  assert.equal(P.rendererPrefsFrom({ notify: { device: false } }).notify.device, false);
  assert.equal(P.rendererPrefsFrom({ tempUnit: 'F', tabReset: 123 }).tempUnit, 'F');
  assert.equal(P.rendererPrefsFrom({ tabReset: 123 }).tabReset, 60);
});

test('thời tiết: chuyển weatherCity cũ thành danh sách địa điểm', () => {
  const s = { weather: false, weatherCity: { name: 'Đà Nẵng', lat: 16.06, lon: 108.22 } };
  assert.equal(P.migrateWeather(s, 1000), true);
  assert.equal(s.weatherCity, undefined);
  assert.equal('weather' in s, false, 'bỏ công tắc Hiện thời tiết');
  assert.equal(s.weatherPlaces.length, 1);
  assert.equal(s.weatherMain, s.weatherPlaces[0].id);
  assert.equal(P.migrateWeather(s), false, 'chạy lại không đổi gì');
  const cfg = P.weatherCfgFrom({ weatherAuto: false, weatherPlaces: [{ id: 'a', lat: 1, lon: 2 }, { id: 'b', lat: 'x' }] });
  assert.equal(cfg.auto, false);
  assert.deepEqual(cfg.places.map((p) => p.id), ['a'], 'bỏ địa điểm thiếu tọa độ');
  assert.equal(cfg.main, 'auto');
});

test('thời tiết: thêm / đổi chỗ địa điểm', () => {
  let list = [];
  list = P.addPlace(list, { name: 'Hà Nội', lat: 21.03, lon: 105.85 }, 1);
  list = P.addPlace(list, { name: 'Huế', lat: 16.46, lon: 107.59 }, 2);
  assert.equal(list.length, 2);
  assert.equal(P.addPlace(list, { name: 'Hà Nội 2', lat: 21.031, lon: 105.851 }), null, 'trùng vị trí');
  assert.equal(P.addPlace(list, { name: 'x' }), null, 'thiếu tọa độ');
  const full = Array.from({ length: P.MAX_PLACES }, (_, i) => ({ id: 'p' + i, lat: i, lon: i }));
  assert.equal(P.addPlace(full, { lat: 50, lon: 50 }), null, 'đủ số địa điểm tối đa');
  assert.deepEqual(P.movePlace(list, list[1].id, -1).map((p) => p.name), ['Huế', 'Hà Nội']);
  assert.equal(P.movePlace(list, list[0].id, -1), null, 'đầu danh sách không lên được');
  assert.equal(P.movePlace(list, 'khong-co', 1), null);
});

test('khôi phục mặc định giữ dữ liệu, báo lỗi không lộ dữ liệu riêng tư', () => {
  const s = { hideMode: 'tabs', hotkey: 'Alt+Shift+N', shelf: [{ id: 's', path: 'C:/a.png' }], notes: { x: 1 },
    weatherPlaces: [{ id: 'p', lat: 1, lon: 2 }], weatherLoc: { lat: 1, lon: 2 } };
  const r = P.resetPrefs({ ...s });
  assert.equal(r.hideMode, undefined);
  assert.equal(r.hotkey, undefined);
  assert.ok(r.shelf && r.notes && r.weatherPlaces, 'dữ liệu còn nguyên');
  const safe = P.safeSettings(s);
  assert.equal(safe.hideMode, 'tabs');
  assert.equal(safe.shelf, undefined);
  assert.equal(safe.weatherLoc, undefined);
  assert.equal(safe.weatherPlaces, 1, 'chỉ ghi số lượng địa điểm');
});

test('kích thước viên thuốc: chỉ nhận 4 mức, mặc định Vừa', () => {
  assert.equal(P.pillScale({}), 1);
  assert.equal(P.pillScale({ pillScale: 1.15 }), 1.15);
  assert.equal(P.pillScale({ pillScale: '1.3' }), 1.3, 'chuỗi số từ ô chọn');
  assert.equal(P.pillScale({ pillScale: 2 }), 1, 'giá trị lạ -> Vừa');
  assert.equal(P.rendererPrefsFrom({ pillScale: 0.9 }).pillScale, 0.9);
  assert.ok(P.PREF_KEYS.includes('pillScale'), 'khôi phục mặc định thì về Vừa');
});

test('mở app lần nữa khi đang chạy: không tự mở Cài đặt', () => {
  const app = 'C:\app';
  assert.deepEqual(P.secondInstance(['electron.exe', app, P.AUTOSTART_ARG]), { showPill: false, settings: null }, 'lúc bật máy: không làm gì');
  assert.deepEqual(P.secondInstance(['electron.exe', app]), { showPill: true, settings: null }, 'mở lại bằng tay: chỉ hiện viên thuốc');
  assert.deepEqual(P.secondInstance(['notchy.exe', '--settings=about']), { showPill: true, settings: 'about' }, 'yêu cầu rõ thì mở');
  assert.deepEqual(P.secondInstance(undefined), { showPill: true, settings: null });
});

test('khởi động cùng Windows: mục khởi động trùng lệnh mang tên cũ là thừa', () => {
  const items = [{ name: 'com.na.notchy' }, { name: 'DynamicIsland.Windows' }, { name: 'electron.app.Electron' }];
  assert.deepEqual(P.staleLoginItems(items, 'com.na.notchy').map((x) => x.name), ['DynamicIsland.Windows', 'electron.app.Electron']);
  assert.deepEqual(P.staleLoginItems([{ name: 'com.na.notchy' }], 'com.na.notchy'), []);
  assert.deepEqual(P.staleLoginItems(undefined, 'com.na.notchy'), []);
});

test('chữ chạy: nhích ít nhất 60 lần/giây, đều theo tần số quét', () => {
  assert.ok(Math.abs(P.mqStepRate(200) - 200 / 3) < 1e-9, '200 Hz: mỗi bước giữ đúng 3 khung');
  assert.equal(P.mqStepRate(144), 72);
  assert.equal(P.mqStepRate(165), 82.5);
  assert.equal(P.mqStepRate(120), 60);
  assert.equal(P.mqStepRate(60), 60);
  assert.equal(P.mqStepRate(59.94), 59.94);
  assert.equal(P.mqStepRate(0), 60, 'không biết tần số');
  assert.equal(P.mqStepRate(undefined), 60);
  for (const hz of [60, 75, 90, 100, 120, 144, 165, 175, 200, 240, 360]) assert.ok(P.mqStepRate(hz) >= 60, hz + ' Hz');
});
