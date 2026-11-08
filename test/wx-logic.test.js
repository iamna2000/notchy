// Logic thời tiết (renderer/wx-logic.js + lib/weather.js parseForecast). Chạy: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const WxLogic = require('../renderer/wx-logic');

const day = (date, o = {}) => ({ date, code: 1, hi: 30, lo: 24, fhi: null, flo: null, rain: 0, pop: 0, wind: 10, gust: 20, uv: 5, ...o });
const week = (over = {}) => Array.from({ length: 7 }, (_, i) => day(`2026-11-${String(9 + i).padStart(2, '0')}`, over[i] || {}));
const morning = () => new Date('2026-11-09T09:00');
const W = (unit = 'C', now = morning) => WxLogic.create({ unit: () => unit, now });

test('tên thời tiết theo mã WMO', () => {
  const { WX_NAME } = W();
  assert.equal(WX_NAME(0), 'Trời quang');
  assert.equal(WX_NAME(2), 'Ít mây');
  assert.equal(WX_NAME(45), 'Sương mù');
  assert.equal(WX_NAME(53), 'Mưa phùn');
  assert.equal(WX_NAME(63), 'Mưa');
  assert.equal(WX_NAME(81), 'Mưa rào');
  assert.equal(WX_NAME(75), 'Tuyết');
  assert.equal(WX_NAME(95), 'Dông');
});

test('mức cảnh báo theo ngưỡng KTTV', () => {
  const { wxDayLevel } = W();
  assert.equal(wxDayLevel(day('2026-11-09', { hi: 35 })), 1, 'nắng nóng');
  assert.equal(wxDayLevel(day('2026-11-09', { hi: 37 })), 2, 'nắng nóng gay gắt');
  assert.equal(wxDayLevel(day('2026-11-09', { hi: 17, lo: 13 })), 1, 'rét đậm: TB 15°');
  assert.equal(wxDayLevel(day('2026-11-09', { hi: 15, lo: 11 })), 2, 'rét hại: TB 13°');
  assert.equal(wxDayLevel(day('2026-11-09', { rain: 25 })), 1);
  assert.equal(wxDayLevel(day('2026-11-09', { gust: 80 })), 2);
  assert.equal(wxDayLevel(day('2026-11-09', { hi: null, lo: null })), 0, 'thiếu số liệu không bị coi là rét');
  assert.equal(wxDayLevel(day('2026-11-09')), 0);
});

test('tuần yên ổn: chỉ có mặc gì + thời tiết ổn định', () => {
  const tips = W().wxTips(week());
  assert.deepEqual(tips.map((t) => t.k), ['wear', 'ok']);
  assert.match(tips[0].title, /hôm nay/);
});

test('cảnh báo đỏ lên trước mặc gì, tối đa 3 dòng', () => {
  const tips = W().wxTips(week({ 0: { hi: 38 }, 1: { rain: 30 }, 2: { gust: 90 } }));
  assert.ok(tips.length <= 3);
  assert.equal(tips[0].k, 'heat');
  assert.equal(tips[0].lv, 2);
  assert.match(tips[0].title, /Nắng nóng gay gắt hôm nay · cao nhất 38°/);
  assert.ok(tips.some((t) => t.k === 'wear'));
});

test('nhiệt độ đổi đột ngột được báo, đổi sang °F đúng', () => {
  const D = week({ 3: { hi: 20, lo: 12 } }); // TB 27 -> 16: giảm 11°
  const c = W('C').wxTips(D).find((t) => t.k === 'jump');
  assert.match(c.title, /Trời chuyển lạnh .* giảm 11°/);
  const f = W('F').wxTips(D).find((t) => t.k === 'jump');
  assert.match(f.title, /giảm 20°/, 'chênh lệch 11°C = 19,8°F');
  assert.match(f.text, /Nhiệt độ 54–68°/, '12–20°C = 54–68°F');
});

test('sau 19h gợi ý mặc gì cho ngày mai', () => {
  const tips = W('C', () => new Date('2026-11-09T20:00')).wxTips(week());
  assert.match(tips[0].title, /Mặc gì ngày mai/);
});

test('mặc gì: mang ô khi có mưa, thêm áo khi chênh nhiệt lớn', () => {
  const { wxWear } = W();
  assert.match(wxWear(day('x', { hi: 31, pop: 70 })), /mang ô/);
  assert.match(wxWear(day('x', { hi: 26, lo: 15 })), /sáng tối 15°, thêm áo khoác/);
  assert.equal(wxWear(day('x', { hi: null })), 'Chưa đủ số liệu nhiệt độ.');
});

test('parseForecast: dữ liệu Open-Meteo -> dạng giao diện', () => {
  const { parseForecast } = require('../lib/weather');
  const j = {
    current: { temperature_2m: 22.4, apparent_temperature: 23, relative_humidity_2m: 92, weather_code: 53, is_day: 0, wind_speed_10m: 18 },
    daily: { time: ['2026-11-09', '2026-11-10'], weather_code: [53, 3], temperature_2m_max: [23, 25], temperature_2m_min: [17, null],
      precipitation_probability_max: [80, 10] },
  };
  const w = parseForecast(j);
  assert.equal(w.temp, 22.4);
  assert.equal(w.day, false);
  assert.equal(w.hi, 23);
  assert.equal(w.daily.length, 2);
  assert.equal(w.daily[1].lo, null, 'thiếu số liệu -> null');
  assert.equal(w.daily[0].uv, null, 'thiếu cả mảng -> null');
  assert.throws(() => parseForecast({}), /không hợp lệ/);
});
