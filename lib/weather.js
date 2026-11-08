// Thời tiết (viên thuốc thu gọn khi không phát gì + tab Thời tiết). Open-Meteo, miễn phí, không cần khóa.
// Nhiều địa điểm: "Vị trí của bạn" (đoán theo IP, bật/tắt được) + các thành phố người dùng thêm trong Cài đặt.
// Một địa điểm chính hiện ở viên thuốc thu gọn; trang Thời tiết chuyển qua lại giữa các địa điểm.
// Không đoán được vị trí theo IP mà chưa thêm địa điểm nào: báo needLoc để giao diện mời chọn địa điểm.
const { ipcMain } = require('electron');
const core = require('./core');
const P = require('./prefs');

const weather = { data: null, timer: null, failLogged: false, autoFailed: false, seq: 0 };

// Cài đặt thời tiết đã chuẩn hóa (chuyển dữ liệu cũ nếu có)
function wxSettings() {
  const s = core.loadSettings();
  if (P.migrateWeather(s)) core.saveSettings(s);
  return P.weatherCfgFrom(s);
}
// Vị trí theo IP (lưu 1 ngày). Thử ipwho.is rồi ipapi.co; cả hai lỗi thì null
async function ipLocation() {
  const s = core.loadSettings();
  if (s.weatherLoc && Date.now() - s.weatherLoc.at < 86400000) return s.weatherLoc;
  const tries = [
    async () => {
      const j = await (await fetch('https://ipwho.is/?fields=success,city,latitude,longitude', { signal: AbortSignal.timeout(8000) })).json();
      return j.success && Number.isFinite(j.latitude) ? { lat: j.latitude, lon: j.longitude, city: j.city || '' } : null;
    },
    async () => {
      const j = await (await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(8000) })).json();
      return Number.isFinite(j.latitude) ? { lat: j.latitude, lon: j.longitude, city: j.city || '' } : null;
    },
  ];
  for (const t of tries) {
    try {
      const loc = await t();
      if (loc) { const s2 = core.loadSettings(); s2.weatherLoc = { ...loc, at: Date.now() }; core.saveSettings(s2); return s2.weatherLoc; }
    } catch (_) {}
  }
  return s.weatherLoc || null; // dùng tạm vị trí cũ (quá 1 ngày) nếu có
}
const DAILY_VARS = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min',
  'precipitation_sum', 'precipitation_probability_max', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'uv_index_max'];
async function fetchForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m'
    + `&daily=${DAILY_VARS.join(',')}&timezone=auto&forecast_days=7`;
  const j = await (await fetch(url, { signal: AbortSignal.timeout(10000) })).json();
  return parseForecast(j);
}
// Tách riêng để kiểm thử: dữ liệu Open-Meteo -> dạng giao diện dùng
function parseForecast(j) {
  const c = j && j.current, d = (j && j.daily) || {};
  if (!c || !Number.isFinite(c.temperature_2m)) throw new Error('dữ liệu thời tiết không hợp lệ');
  const num = (a, i) => (Array.isArray(a) && Number.isFinite(a[i]) ? a[i] : null);
  const daily = (d.time || []).map((date, i) => ({
    date, code: num(d.weather_code, i), hi: num(d.temperature_2m_max, i), lo: num(d.temperature_2m_min, i),
    fhi: num(d.apparent_temperature_max, i), flo: num(d.apparent_temperature_min, i),
    rain: num(d.precipitation_sum, i), pop: num(d.precipitation_probability_max, i),
    wind: num(d.wind_speed_10m_max, i), gust: num(d.wind_gusts_10m_max, i), uv: num(d.uv_index_max, i),
  }));
  return {
    temp: c.temperature_2m, code: c.weather_code, day: !!c.is_day,
    feels: Number.isFinite(c.apparent_temperature) ? c.apparent_temperature : null,
    hum: Number.isFinite(c.relative_humidity_2m) ? c.relative_humidity_2m : null,
    wind: Number.isFinite(c.wind_speed_10m) ? c.wind_speed_10m : null,
    hi: daily.length ? daily[0].hi : null, lo: daily.length ? daily[0].lo : null,
    daily, at: Date.now(),
  };
}
async function refreshWeather() {
  clearTimeout(weather.timer); weather.timer = null;
  const seq = ++weather.seq; // đổi cài đặt giữa chừng: lượt cũ bỏ kết quả, chỉ lượt mới nhất được gửi
  let next = 15 * 60000;
  const cfg = wxSettings();
  const targets = [];
  if (cfg.auto) {
    const loc = await ipLocation();
    weather.autoFailed = !loc;
    if (loc) targets.push({ id: 'auto', name: loc.city || 'Vị trí của bạn', auto: true, lat: loc.lat, lon: loc.lon });
  } else weather.autoFailed = false;
  for (const p of cfg.places) targets.push({ id: p.id, name: p.name, sub: p.sub || '', lat: p.lat, lon: p.lon });

  const prev = new Map(((weather.data && weather.data.places) || []).map((p) => [p.id, p]));
  const results = await Promise.all(targets.map(async (t) => {
    try { return { id: t.id, name: t.name, sub: t.sub || '', auto: !!t.auto, city: t.name, ...(await fetchForecast(t.lat, t.lon)) }; }
    catch (e) {
      if (!weather.failLogged) { core.log('weather:', t.name, e.message); weather.failLogged = true; } // mất mạng: chỉ ghi 1 lần
      const old = prev.get(t.id); // giữ dữ liệu cũ của địa điểm này nếu có
      return old ? { ...old, name: t.name, city: t.name } : null;
    }
  }));
  if (seq !== weather.seq) return;
  const places = results.filter(Boolean);
  if (places.length < targets.length) next = 5 * 60000;
  else weather.failLogged = false;
  const mainP = places.find((p) => p.id === cfg.main) || places[0] || null;
  // Dữ liệu gửi giao diện: địa điểm chính nằm ngay ở gốc (viên thuốc thu gọn dùng), kèm danh sách mọi địa điểm
  weather.data = mainP ? { ...mainP, places, mainId: mainP.id } : { places: [], needLoc: !targets.length, at: Date.now() };
  core.send('weather', weather.data);
  core.hooks.pushSettings();
  weather.timer = setTimeout(refreshWeather, next);
}

// Phần cài đặt thời tiết cho cửa sổ Cài đặt (nhiệt độ hiện tại đi kèm từng địa điểm)
function settingsView() {
  const cfg = wxSettings();
  const live = new Map(((weather.data && weather.data.places) || []).map((p) => [p.id, p]));
  const withTemp = (p) => { const d = live.get(p.id); return { ...p, temp: d ? d.temp : null, code: d ? d.code : null }; };
  return {
    wxAuto: cfg.auto, wxAutoFailed: weather.autoFailed,
    wxAutoPlace: cfg.auto && live.get('auto') ? withTemp({ id: 'auto', name: live.get('auto').name }) : null,
    wxPlaces: cfg.places.map(withTemp), wxMain: (weather.data && weather.data.mainId) || cfg.main, wxMax: P.MAX_PLACES,
  };
}
// Thay đổi từ cửa sổ Cài đặt; trả true nếu khóa thuộc về thời tiết
function applySetting(key, val) {
  const cfg = wxSettings();
  const s = core.loadSettings();
  switch (key) {
    case 'wxAuto': s.weatherAuto = !!val; break;
    case 'wxAdd': {
      const list = P.addPlace(cfg.places, val);
      if (!list) return true;
      s.weatherPlaces = list;
      // địa điểm đầu tiên khi không có vị trí tự động: làm địa điểm chính
      if (!cfg.places.length && (!cfg.auto || weather.autoFailed)) s.weatherMain = list[list.length - 1].id;
      break;
    }
    case 'wxDel':
      s.weatherPlaces = cfg.places.filter((p) => p.id !== val);
      if (s.weatherMain === val) delete s.weatherMain;
      break;
    case 'wxMain': s.weatherMain = String(val); break;
    case 'wxMove': {
      const list = val ? P.movePlace(cfg.places, val.id, val.dir) : null;
      if (!list) return true;
      s.weatherPlaces = list;
      break;
    }
    default: return false;
  }
  core.saveSettings(s);
  refreshWeather();
  return true;
}
// Tìm thành phố (Open-Meteo Geocoding)
async function geoSearch(q) {
  q = String(q || '').trim().slice(0, 80);
  if (q.length < 2) return [];
  try {
    const url = 'https://geocoding-api.open-meteo.com/v1/search?count=6&language=vi&format=json&name=' + encodeURIComponent(q);
    const j = await (await fetch(url, { signal: AbortSignal.timeout(8000) })).json();
    return (j.results || []).map((r) => ({
      name: r.name, lat: r.latitude, lon: r.longitude,
      sub: [r.admin1, r.country].filter(Boolean).join(', '),
    }));
  } catch (e) { core.log('geo:', e.message); return null; }
}

function registerIpc() {
  ipcMain.on('weather-get', () => core.send('weather', weather.data));
  ipcMain.handle('settings:geo', (_e, q) => geoSearch(q));
}

module.exports = { refreshWeather, settingsView, applySetting, registerIpc, parseForecast };
