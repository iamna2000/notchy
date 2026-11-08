// Preload giả cho viên thuốc (renderer/index.html) trong test/ui-smoke.js: thay window.api thật bằng bản ghi lại
// callback (window.__cbs) và lệnh gửi đi (window.__calls). Chạy với contextIsolation: false.
const cbs = {};
const calls = [];
window.__DI_TEST = true;
window.__cbs = cbs;
window.__calls = calls;
window.api = new Proxy({}, {
  get: (_t, k) => {
    k = String(k);
    if (k.startsWith('on')) return (cb) => { cbs[k] = cb; };
    if (k === 'pathOf') return () => '';
    return (...a) => { calls.push([k, ...a]); };
  },
});
