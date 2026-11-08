// Logic thời tiết của viên thuốc (không đụng tới giao diện): tên thời tiết, mức cảnh báo từng ngày,
// gợi ý mặc gì, chọn tối đa 3 lưu ý. Dùng được cả trong trang (window.WxLogic) lẫn Node (test/wx-logic.test.js).
// Dữ liệu luôn là °C (ngưỡng cảnh báo tính bằng °C); unit() chỉ đổi đơn vị lúc hiện chữ.
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.WxLogic = m;
})(this, function () {
  const VN_DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const WX_NAME = (c) => (c <= 1 ? 'Trời quang' : c === 2 ? 'Ít mây' : c === 3 ? 'Nhiều mây' : c === 45 || c === 48 ? 'Sương mù'
    : c >= 95 ? 'Dông' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'Tuyết' : c >= 80 ? 'Mưa rào' : c >= 61 ? 'Mưa' : c >= 51 ? 'Mưa phùn' : 'Nhiều mây');
  const rnd = (v) => (v == null ? '–' : Math.round(v));
  const dayOf = (d) => new Date(d.date + 'T00:00');
  const feelHi = (d) => (d.fhi != null ? d.fhi : d.hi);
  const feelLo = (d) => (d.flo != null ? d.flo : d.lo);
  // null <= 10 là true trong JS nên các phép so sánh "nhỏ hơn" phải kiểm tra thiếu số liệu trước
  const avgT = (d) => (d.hi != null && d.lo != null ? (d.hi + d.lo) / 2 : null);

  // opts: { icons: { sun, rain, storm, fog, wear, temp, wind, ok }, unit: () => 'C' | 'F', now: () => Date }
  function create(opts = {}) {
    const ic = opts.icons || {};
    const unit = opts.unit || (() => 'C');
    const now = opts.now || (() => new Date());
    const tU = (c) => (c == null || unit() !== 'F' ? c : c * 9 / 5 + 32); // nhiệt độ
    const tD = (d) => (unit() === 'F' ? d * 9 / 5 : d);                   // chênh lệch nhiệt độ

    function wxDayName(D, i, long) {
      if (i === 0) return long ? 'hôm nay' : 'Hôm nay';
      if (i === 1 && long) return 'ngày mai';
      const t = dayOf(D[i]);
      return long ? `${VN_DOW[t.getDay()]} ${t.getDate()}/${t.getMonth() + 1}` : VN_DOW[t.getDay()];
    }
    // Ngưỡng thời tiết cực đoan (mức 1: cam, mức 2: đỏ), theo dự báo từng ngày của Open-Meteo.
    // Nóng / rét theo cách gọi của Trung tâm Dự báo KTTV quốc gia: nắng nóng khi cao nhất ≥35°, gay gắt ≥37°;
    // rét đậm khi nhiệt độ trung bình ngày ≤15°, rét hại ≤13°
    const RULES = [
      { k: 'heat', ico: ic.sun, test: (d) => (d.hi >= 37 ? 2 : d.hi >= 35 ? 1 : 0), t: ['Nắng nóng', 'Nắng nóng gay gắt'],
        v: (ds) => `cao nhất ${rnd(tU(Math.max(...ds.map((d) => d.hi))))}°`, a: 'Tránh ra ngoài 11h–16h, uống nhiều nước, che chắn kỹ.' },
      { k: 'rain', ico: ic.rain, test: (d) => (d.rain >= 50 ? 2 : d.rain >= 20 ? 1 : 0), t: ['Mưa to', 'Mưa rất to'],
        v: (ds) => `tới ${rnd(Math.max(...ds.map((d) => d.rain)))} mm`, a: 'Mang áo mưa, tránh đường hay ngập và vùng dễ sạt lở.' },
      { k: 'wind', ico: ic.wind, test: (d) => (d.gust >= 75 ? 2 : d.gust >= 50 ? 1 : 0), t: ['Gió mạnh', 'Gió giật rất mạnh'],
        v: (ds) => `giật ${rnd(Math.max(...ds.map((d) => d.gust)))} km/h`, a: 'Đi xe máy cẩn thận, tránh cây to, biển quảng cáo.' },
      { k: 'storm', ico: ic.storm, test: (d) => (d.code >= 95 ? 1 : 0), t: ['Có dông sét', 'Có dông sét'], v: () => '',
        a: 'Không trú dưới cây cao, cột điện; tránh nơi đất trống.' },
      { k: 'cold', ico: ic.temp, test: (d) => (avgT(d) == null ? 0 : avgT(d) <= 13 ? 2 : avgT(d) <= 15 ? 1 : 0), t: ['Rét đậm', 'Rét hại'],
        v: (ds) => `thấp nhất ${rnd(tU(Math.min(...ds.map((d) => d.lo))))}°`, a: 'Giữ ấm cổ, ngực, chân; không sưởi than trong phòng kín.' },
      { k: 'uv', ico: ic.sun, test: (d) => (d.uv >= 11 ? 2 : d.uv >= 8 ? 1 : 0), t: ['Tia UV rất cao', 'Tia UV cực độ'],
        v: (ds) => `UV ${rnd(Math.max(...ds.map((d) => d.uv)))}`, a: 'Kem chống nắng, mũ rộng vành, kính râm, áo chống nắng.' },
      { k: 'fog', ico: ic.fog, test: (d) => (d.code === 45 || d.code === 48 ? 1 : 0), t: ['Sương mù', 'Sương mù'], v: () => '',
        a: 'Bật đèn xe, giảm tốc độ, giữ khoảng cách.' },
    ];
    const wxDayLevel = (d) => Math.max(0, ...RULES.map((r) => r.test(d)));
    function wxWear(d) {
      const hi = feelHi(d), lo = feelLo(d);
      if (hi == null) return 'Chưa đủ số liệu nhiệt độ.';
      let s = hi >= 35 ? 'Áo cộc tay mỏng sáng màu, mũ, kem chống nắng'
        : hi >= 29 ? 'Áo thun, sơ mi mỏng thoáng mát'
        : hi >= 23 ? 'Áo thun hoặc sơ mi dài tay mỏng'
        : hi >= 17 ? 'Áo khoác mỏng hoặc áo nỉ, quần dài'
        : hi >= 11 ? 'Áo len và áo khoác dày, giày kín'
        : 'Nhiều lớp: áo giữ nhiệt, áo phao, khăn, găng tay';
      if (d.pop >= 50 || d.rain >= 2) s += ' · mang ô hoặc áo mưa';
      if (lo != null && hi - lo >= 7 && lo < 22) s += ` · sáng tối ${rnd(tU(lo))}°, thêm áo khoác`;
      return s + '.';
    }
    // Lưu ý: tối đa 3 dòng. Luôn có "mặc gì" (hôm nay; sau 19h là ngày mai) + tối đa 2 điều quan trọng nhất trong:
    //   - hiện tượng cực đoan hôm nay / ngày mai (mọi mức),
    //   - những ngày sau trong tuần: chỉ hiện tượng nguy hiểm (mức đỏ) hoặc nhiệt độ đổi đột ngột so với hôm trước.
    function wxTips(D) {
      const name = (i) => wxDayName(D, i, true), cand = [];
      for (const r of RULES) {
        const near = [0, 1].filter((i) => D[i] && r.test(D[i]));
        if (near.length) {
          const lv = Math.max(...near.map((i) => r.test(D[i]))), v = r.v(near.map((i) => D[i]));
          cand.push({ k: r.k, lv, pri: lv * 10 + 4, ico: r.ico, title: `${r.t[lv - 1]} ${near.map(name).join(' và ')}${v ? ' · ' + v : ''}`, text: r.a });
          continue;
        }
        const far = D.map((d, i) => (i >= 2 && r.test(d) === 2 ? i : -1)).filter((i) => i >= 0);
        if (far.length) cand.push({ k: r.k, lv: 2, pri: 18, ico: r.ico, title: `${r.t[1]} ${name(far[0])}${far.length > 1 ? ' và các ngày sau' : ''} · ${r.v(far.map((i) => D[i]))}`.replace(/ · $/, ''), text: r.a });
      }
      // Nhiệt độ trung bình đổi từ 5° trở lên so với hôm trước: lấy ngày đổi mạnh nhất
      let jump = null;
      for (let i = 1; i < D.length; i++) {
        const a = avgT(D[i - 1]), b = avgT(D[i]);
        if (a == null || b == null) continue;
        const dt = b - a;
        if (Math.abs(dt) >= 5 && (!jump || Math.abs(dt) > Math.abs(jump.dt))) jump = { i, dt };
      }
      if (jump) {
        const d = D[jump.i], lv = Math.abs(jump.dt) >= 8 ? 2 : 1, down = jump.dt < 0;
        cand.push({ k: 'jump', lv, pri: lv * 10 + 2, ico: ic.temp,
          title: `${down ? 'Trời chuyển lạnh' : 'Nóng lên đột ngột'} ${name(jump.i)} · ${down ? 'giảm' : 'tăng'} ${rnd(tD(Math.abs(jump.dt)))}°`,
          text: `Nhiệt độ ${rnd(tU(d.lo))}–${rnd(tU(d.hi))}°. ${down ? 'Chuẩn bị áo ấm, giữ ấm khi ra ngoài.' : 'Mặc thoáng, uống đủ nước.'}` });
      }
      cand.sort((x, y) => y.pri - x.pri);
      const top = cand.slice(0, 2);
      const wi = now().getHours() >= 19 && D[1] ? 1 : 0;
      const wear = { k: 'wear', lv: 'wear', ico: ic.wear, title: `Mặc gì ${name(wi)}`, text: wxWear(D[wi]) };
      if (!top.length) return [wear, { k: 'ok', lv: 'ok', ico: ic.ok, title: 'Tuần này thời tiết ổn định', text: 'Không có nắng nóng, mưa to, gió mạnh hay rét đậm.' }];
      // Cảnh báo đỏ lên đầu, rồi mặc gì, rồi cảnh báo cam
      return [...top.filter((t) => t.lv === 2), wear, ...top.filter((t) => t.lv !== 2)];
    }
    return { WX_NAME, VN_DOW, rnd, tU, tD, wxDayName, wxDayLevel, wxWear, wxTips };
  }
  return { create, WX_NAME, rnd };
});
