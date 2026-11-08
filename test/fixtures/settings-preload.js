// Preload giả cho cửa sổ Cài đặt (renderer/settings.html) trong test/ui-smoke.js: trạng thái cố định,
// ghi lại mọi lệnh set / act vào window.__calls.
const state = {
  version: '0.0.0-test', packaged: true, autostart: true, shown: true,
  displays: [{ id: 1, name: 'Màn hình 1 (2560×1440) · chính' }, { id: 2, name: 'Màn hình 2 (1920×1080)' }], display: 1,
  hideMode: 'window', hideDelay: 5, fullBar: true,
  hotkey: 'Control+Shift+Space', hotkeyOk: true, hotkeyAuto: true,
  clipMax: 50, clipPersist: true, clipCount: 12, clipPinned: 1,
  wxAuto: true, wxAutoFailed: false, wxAutoPlace: { id: 'auto', name: 'Hà Nội', temp: 22 },
  wxPlaces: [{ id: 'p1', name: 'Đà Nẵng', sub: 'Việt Nam', temp: 26, lat: 16, lon: 108 }], wxMain: 'p1', wxMax: 8,
  shelfShots: true, shelfCount: 3,
  defaultTab: 'music', tabsHidden: ['sys'], tabReset: 60, tempUnit: 'C', clipPaused: false,
  notify: { download: true, shot: true, device: true, battery: true, update: true },
  upd: { state: 'latest', version: '', percent: 0, err: '' },
};
const calls = [];
let gotoCb = null;
window.__calls = calls;
window.__goto = (s) => gotoCb && gotoCb(s);
window.settings = {
  get: async () => state,
  set: async (k, v) => { calls.push(['set', k, v]); return state; },
  act: async (a) => { calls.push(['act', a]); return true; },
  geo: async () => [{ name: 'Huế', sub: 'Việt Nam', lat: 16.4, lon: 107.6 }],
  onState: () => {},
  onGoto: (cb) => { gotoCb = cb; },
};
