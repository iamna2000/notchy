// Kiểm thử giao diện (cửa sổ ẩn, không đụng tới cài đặt / dữ liệu thật): mở viên thuốc và cửa sổ Cài đặt với
// dữ liệu giả, đi qua các trang / mục, bắt mọi lỗi JavaScript và kiểm tra vài phần tử quan trọng.
// Chạy: npm run test:ui   (thoát với mã 1 nếu có lỗi)
const { app, BrowserWindow } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const failures = [];
const fail = (m) => { failures.push(m); console.log('  ✗', m); };
const ok = (m) => console.log('  ✓', m);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(file, preload, isolated) {
  const w = new BrowserWindow({
    width: 820, height: 600, show: false,
    webPreferences: { preload: path.join(FIX, preload), contextIsolation: isolated, sandbox: false, offscreen: true },
  });
  const errors = [];
  w.webContents.on('console-message', (_e, level, msg) => { if (level >= 3) errors.push(msg); });
  w.webContents.on('preload-error', (_e, p, err) => errors.push('preload: ' + err.message));
  // settings.html đổi #mục ngay khi mở (history.replaceState) làm lệnh chờ tải bị hủy (ERR_FAILED / ERR_ABORTED)
  // dù trang vẫn chạy bình thường: bỏ qua lỗi đó, chờ thêm rồi kiểm tra trang đã có nội dung
  await w.loadFile(path.join(ROOT, 'renderer', file)).catch((e) => { if (!/ERR_(FAILED|ABORTED)/.test(e.message)) throw e; });
  await wait(700);
  const run = (js) => w.webContents.executeJavaScript(js);
  return { w, run, errors };
}

const D = (date, code, hi, lo) => ({ date, code, hi, lo, fhi: null, flo: null, rain: 0, pop: 10, wind: 10, gust: 20, uv: 5 });
const place = (id, name, temp) => ({
  id, name, city: name, temp, code: 2, day: true, feels: temp, hum: 70, wind: 8, hi: temp + 3, lo: temp - 5, at: Date.now(),
  daily: Array.from({ length: 7 }, (_, i) => D(`2026-11-${String(9 + i).padStart(2, '0')}`, [1, 2, 3, 61, 95, 1, 0][i], temp + 3, temp - 5)),
});

async function testPill() {
  console.log('Viên thuốc');
  const { w, run, errors } = await open('index.html', 'pill-preload.js', false);
  const cb = (name, v) => run(`window.__cbs.${name}(${JSON.stringify(v)});0`);
  await cb('onPrefs', { defaultTab: 'music', tabsHidden: ['sys'], tabReset: 60, notify: {}, tempUnit: 'C', clipPaused: true });
  const places = [place('auto', 'Hà Nội', 22), place('p1', 'Đà Nẵng', 26)];
  await cb('onWeather', { ...places[0], places, mainId: 'auto' });
  await cb('onMedia', { type: 'media', active: true, key: 'k', title: 'Bài thử', artist: 'Ca sĩ', app: 'Spotify', status: 'Playing', pos: 10, dur: 200, upd: Date.now(), rate: 1, live: false });
  await cb('onClip', [{ id: 'c1', text: 'xin chào', pin: false, ts: 1 }, { id: 'c2', text: 'https://example.com', pin: true, ts: 2 }]);
  await cb('onShelf', [{ id: 's1', name: 'a.png', dir: 'C:/', icon: '', size: 1000, thumb: '' }]);
  await run("window.__di.S.hover = true; window.__di.S.open = true; window.__di.applyLayout();0");
  for (const tab of ['music', 'weather', 'calendar', 'clip', 'shelf', 'sys']) {
    await run(`window.__di.setTab(${JSON.stringify(tab)});0`);
    await wait(150);
  }
  const hiddenTabs = await run("[...document.querySelectorAll('.tb')].filter(b=>b.hidden).map(b=>b.dataset.tab).join(',')");
  hiddenTabs === 'sys' ? ok('ẩn tab theo cài đặt') : fail('ẩn tab: ' + hiddenTabs);
  await run("window.__di.setTab('weather');0");
  const chips = await run("document.querySelectorAll('.wx-pl:not(.add)').length");
  chips === 2 ? ok('hàng chip 2 địa điểm') : fail('chip địa điểm: ' + chips);
  const tips = await run("document.querySelectorAll('.wx-tip').length");
  tips >= 1 && tips <= 3 ? ok(`lưu ý thời tiết (${tips})`) : fail('lưu ý thời tiết: ' + tips);
  await cb('onPrefs', { tempUnit: 'F' });
  const tF = await run("document.querySelector('.wx-t').textContent");
  tF === '72°' ? ok('đổi °F (22°C -> 72°F)') : fail('°F: ' + tF);
  await run("window.__di.setTab('clip');0");
  const paused = await run("!!document.querySelector('.clip-paused')");
  paused ? ok('dải "tạm dừng ghi" bảng tạm') : fail('thiếu dải tạm dừng bảng tạm');
  // Kệ tạm: đang chọn mở rộng mà chỉ có 1 tệp (vẫn hiện một hàng), rồi 6 tệp (lưới): ô ảnh phải nằm gọn trong viên thuốc
  const shelfItem = (i) => ({ id: 's' + i, name: i + '.png', dir: 'C:/', icon: '', size: 1000, thumb: '' });
  await run("window.__di.S.shelfOpen = true;0");
  for (const n of [1, 6]) {
    await cb('onShelf', Array.from({ length: n }, (_, i) => shelfItem(i)));
    await run("window.__di.setTab('shelf');0");
    await wait(700); // chờ viên thuốc co giãn xong
    const fit = await run(`(() => { const isl = document.getElementById('island').getBoundingClientRect();
      const items = [...document.querySelectorAll('#shelfList .sh-item')].slice(0, 5);
      return items.length && items.every((it) => it.getBoundingClientRect().bottom <= isl.bottom + 0.5); })()`);
    fit ? ok(`kệ tạm ${n} tệp (chế độ mở rộng) không bị cắt`) : fail(`kệ tạm ${n} tệp bị cắt ô ảnh`);
  }
  await run("window.__di.S.shelfOpen = false;0");
  // Thông báo ngắn: cái thứ hai phải chờ tới lượt (không đè cái đầu), huy hiệu +1, trùng lặp thì bỏ
  await run(`(() => { const d = window.__di; d.S.hover = false; d.S.hoverRaw = false; d.S.open = false;
    d.showNotice({ kind: 'download', title: 'Đã tải xong', sub: 'a.zip' });
    d.showNotice({ kind: 'download', title: 'Đã tải xong', sub: 'b.zip' });
    d.showNotice({ kind: 'download', title: 'Đã tải xong', sub: 'b.zip' }); })();0`);
  const q1 = await run("[window.__di.S.notice.sub, window.__di.noticeQueue.length, document.getElementById('nMore').textContent].join('|')");
  q1 === 'a.zip|1|+1' ? ok('hàng đợi thông báo (+1, bỏ trùng)') : fail('hàng đợi thông báo: ' + q1);
  await run('window.__di.endNotice();0');
  const q2 = await run("[window.__di.S.notice && window.__di.S.notice.sub, window.__di.noticeQueue.length].join('|')");
  q2 === 'b.zip|0' ? ok('thông báo kế tiếp hiện sau khi cái đầu hết giờ') : fail('thông báo kế tiếp: ' + q2);
  await run('window.__di.endNotice();0');
  // Chuông nhắc: Báo lại 5 phút -> tắt chuông, lưu lịch, hiện xác nhận; tới giờ thì đổ chuông lại
  await run("window.__di.startRing({ kind: 'note', title: 'Họp', sub: 'Ghi chú · 09:00' });0");
  const snoozeBtn = await run("!!document.querySelector('#ringView [data-act=ring-snooze]')");
  snoozeBtn ? ok('nút Báo lại trên chuông') : fail('thiếu nút Báo lại');
  await run('window.__di.snoozeRing();0');
  const sz = await run("[!!window.__di.S.ring, window.__di.S.snooze.length, window.__di.S.notice && window.__di.S.notice.kind].join('|')");
  sz === 'false|1|snooze' ? ok('báo lại: tắt chuông, lưu lịch, hiện xác nhận') : fail('báo lại: ' + sz);
  await run('window.__di.endNotice(); window.__di.S.snooze[0].at = Date.now() - 1000; window.__di.checkSnooze();0');
  const rr = await run("window.__di.S.ring ? window.__di.S.ring.title + '|' + window.__di.S.ring.sub + '|' + window.__di.S.snooze.length : 'none'");
  rr === 'Họp|Báo lại · Ghi chú · 09:00|0' ? ok('tới giờ báo lại thì đổ chuông') : fail('đổ chuông báo lại: ' + rr);
  await run('window.__di.stopRing(); window.__di.endNotice();0');
  // Chờ ý định: lướt qua (< 150 ms) không mở gì; dừng lại thì mở
  await run('window.__di.S.hover = false; window.__di.S.open = false;0');
  await cb('onHover', true); await wait(60); await cb('onHover', false); await wait(150);
  const flick = await run('window.__di.S.hover');
  flick === false ? ok('lướt chuột qua không mở viên thuốc') : fail('lướt qua vẫn mở');
  await cb('onHover', true);
  const early = await run('window.__di.S.hover');
  await wait(220);
  const late = await run('window.__di.S.hover');
  early === false && late === true ? ok('dừng chuột 150 ms thì mở') : fail(`chờ ý định: ngay=${early} sau=${late}`);
  await cb('onHover', false); await wait(500);
  // Nút Cài đặt trên thanh tab
  await run("window.__di.S.hover = true; window.__di.S.open = true; window.__di.applyLayout(); document.getElementById('tbSet').click();0");
  const setCall = await run("JSON.stringify(window.__calls.filter(c => c[0] === 'openSettings').pop() || null)");
  setCall === '["openSettings",""]' ? ok('bánh răng mở Cài đặt') : fail('bánh răng: ' + setCall);
  // Có bản mới: nút Cập nhật hiện trên thanh tab, bấm thì gửi lệnh cài
  const updHidden0 = await run("document.getElementById('tbUpd').hidden");
  await cb('onUpdate', { version: '9.9.9', notes: 'Sửa lỗi nhạc' });
  await run("document.getElementById('tbUpd').click();0");
  const updOk = await run("!document.getElementById('tbUpd').hidden && window.__calls.some(c => c[0] === 'installUpdate')");
  updHidden0 && updOk ? ok('nút Cập nhật khi có bản mới') : fail('nút Cập nhật: ' + updHidden0 + '/' + updOk);
  await cb('onUpdate', null);
  const tabOn = await run("getComputedStyle(document.querySelector('.tb.on')).backgroundColor");
  tabOn !== 'rgba(0, 0, 0, 0)' ? ok('tab đang chọn có nền') : fail('tab đang chọn không có nền');
  // Lịch: khung soạn ghi chú (nội dung · bánh xe giờ · liên kết · nhắc trước), sửa ghi chú, đổ chuông nhắc trước
  await run("window.__di.setTab('calendar'); window.__di.S.calMonth = false; window.__di.S.notes = {}; window.__di.act('cal-today');0");
  await run("window.__di.act('nc-open');0");
  await wait(700);
  const ncFit = await run(`(() => { const isl = document.getElementById('island').getBoundingClientRect();
    const r = document.getElementById('ncRem').getBoundingClientRect();
    return document.querySelector('.view[data-view=calendar]').classList.contains('composing') && r.bottom <= isl.bottom - 4 && r.height > 30; })()`);
  ncFit ? ok('khung soạn ghi chú mở, nằm gọn trong viên thuốc') : fail('khung soạn ghi chú bị cắt hoặc không mở');
  // Đặt 21:30 bằng bánh xe, nhắc trước 15 phút, có liên kết
  await run(`(() => { const d = window.__di; document.getElementById('ncText').value = 'Họp nhóm';
    document.querySelector('#dH .di[data-i="21"]').click(); document.querySelector('#dM .di[data-i="6"]').click();
    document.getElementById('ncLink').value = 'example.com/review';
    d.act('nc-rem'); d.act('nc-rem'); d.act('nc-save'); })();0`);
  const n1 = await run("JSON.stringify(Object.values(window.__di.S.notes).flat()[0] || null)");
  const want = '{"t":"Họp nhóm","at":"21:30","pre":15,"link":"https://example.com/review"}';
  const got = n1 ? JSON.stringify((({ t, at, pre, link }) => ({ t, at, pre, link }))(JSON.parse(n1))) : 'null';
  got === want ? ok('lưu ghi chú: giờ từ bánh xe, nhắc trước 15 phút, liên kết') : fail('lưu ghi chú: ' + got);
  const closed = await run("!document.querySelector('.view[data-view=calendar]').classList.contains('composing') && !!document.querySelector('#notes .ev[data-act=note-edit] .lk')");
  closed ? ok('đóng khung soạn, thẻ ghi chú có nút liên kết') : fail('sau khi lưu: khung không đóng / thiếu nút liên kết');
  // Sửa: mở lại đúng nội dung, đổi giờ, không nhân đôi ghi chú
  await run("window.__di.act('note-edit', document.querySelector('#notes .ev[data-act=note-edit]'));0");
  const edit = await run("document.getElementById('ncText').value + '|' + window.__di.drumTime() + '|' + document.getElementById('ncRemTxt').textContent");
  await run("document.querySelector('#dH .di[data-i=\"22\"]').click(); window.__di.act('nc-save');0");
  const after = await run("JSON.stringify(Object.values(window.__di.S.notes).flat().map(n => n.at))");
  edit === 'Họp nhóm|21:30|Trước 15 phút' && after === '["22:30"]' ? ok('sửa ghi chú (mở đúng nội dung, đổi giờ, không nhân đôi)') : fail('sửa ghi chú: ' + edit + ' / ' + after);
  // Nhắc trước 15 phút: đổ chuông lúc 22:15 của ngày đó, kèm nút mở liên kết
  await run(`(() => { const d = window.__di, t = new Date(); t.setHours(22, 15, 0, 0);
    const realNow = Date.now; Date.now = () => t.getTime() + 5000; d.setLastTick(t.getTime() - 60000); d.checkNotes(); Date.now = realNow; })();0`);
  const rang = await run("(window.__di.S.ring ? window.__di.S.ring.title + '|' + window.__di.S.ring.sub : 'none') + '|' + !document.getElementById('ringLink').hidden");
  rang === 'Họp nhóm|22:30 · còn 15 phút|true' ? ok('đổ chuông nhắc trước 15 phút, có nút mở liên kết') : fail('đổ chuông nhắc trước: ' + rang);
  await run("window.__di.stopRing(); window.__di.endNotice(); window.__di.S.notes = {};0");
  // Kích thước viên thuốc: phóng cả khối bằng CSS zoom; về Vừa thì bỏ zoom
  await cb('onPrefs', { pillScale: 1.3 });
  const z13 = await run("document.querySelector('.stage').style.zoom");
  await cb('onPrefs', { pillScale: 1 });
  const z1 = await run("document.querySelector('.stage').style.zoom");
  z13 === '1.3' && z1 === '' ? ok('kích thước viên thuốc (zoom 1.3, về Vừa)') : fail('kích thước viên thuốc: ' + z13 + ' / ' + z1);
  // Chữ chạy tên bài: nhích theo nhịp main gửi (màn 200 Hz -> 66,7 lần/giây), không còn 32 lần/giây
  await cb('onPrefs', { pillScale: 1, mqRate: 200 / 3 });
  const mqRate = await run(`(() => { const m = document.querySelector('#compact .mq.run'); if (!m) return 'không chạy';
    return (Number(m.style.getPropertyValue('--steps')) / parseFloat(m.style.getPropertyValue('--dur'))).toFixed(1); })()`);
  Math.abs(Number(mqRate) - 66.7) < 0.5 ? ok('chữ chạy nhích 66,7 lần/giây trên màn 200 Hz') : fail('nhịp chữ chạy: ' + mqRate);
  // Cửa sổ nuốt cú nhấn: nhả chuột mà không có cú nhấn (lần di chuột cuối không giữ nút) -> vẫn mở bảng, báo tạo lại cửa sổ.
  // Cú bấm bình thường (có pointerdown) thì không báo.
  const stuck = await run(`(async () => { const d = window.__di, el = document.querySelector('#compact .c-center') || document.getElementById('compact');
    const fire = (t, o) => el.dispatchEvent(new PointerEvent(t, Object.assign({ bubbles: true, button: 0, pointerType: 'mouse' }, o)));
    const n = () => window.__calls.filter((c) => c[0] === 'inputStuck').length;
    d.S.hover = true; d.S.open = false; d.applyLayout();
    const n0 = n(); fire('pointermove', { buttons: 0 }); fire('pointerdown', { buttons: 1 }); fire('pointerup', { buttons: 0 });
    const normal = n() - n0;
    d.S.open = false; d.applyLayout();
    fire('pointermove', { buttons: 0 }); fire('pointerup', { buttons: 0 });
    await new Promise((r) => setTimeout(r, 50));
    return [normal, n() - n0, d.S.open].join('|'); })()`);
  stuck === '0|1|true' ? ok('cửa sổ nuốt cú nhấn: vẫn mở bảng, báo tạo lại cửa sổ') : fail('nuốt cú nhấn: ' + stuck);
  await run("window.__di.S.open = false; window.__di.S.hover = false; window.__di.applyLayout();0");
  await cb('onKbOpen', true);
  const kb = await run('window.__di.S.open && window.__di.S.hover');
  kb ? ok('mở bằng phím tắt') : fail('phím tắt không mở viên thuốc');
  await cb('onWeather', { places: [], needLoc: true, at: Date.now() });
  await run("window.__di.setTab('weather');0");
  const pick = await run("!!document.querySelector('.wx-pick')");
  pick ? ok('nút "Chọn địa điểm" khi không đoán được vị trí') : fail('thiếu nút Chọn địa điểm');
  errors.length ? errors.forEach((e) => fail('lỗi JS viên thuốc: ' + e)) : ok('không có lỗi JavaScript');
  w.destroy();
}

async function testSettings() {
  console.log('Cửa sổ Cài đặt');
  const { w, run, errors } = await open('settings.html', 'settings-preload.js', false);
  for (const sec of ['general', 'hide', 'weather', 'notify', 'data', 'about']) {
    await run(`window.__goto(${JSON.stringify(sec)});0`);
    await wait(80);
    const on = await run(`(document.querySelector('.sec.on')||{}).dataset?.sec || ''`);
    if (on !== sec) fail(`mục ${sec} không mở (đang ${on})`);
  }
  ok('mở được 6 mục');
  const tabs = await run("[...document.querySelectorAll('#tabsPick input')].map(c=>c.checked?1:0).join('')");
  tabs === '111110' ? ok('ô chọn tab khớp trạng thái') : fail('ô chọn tab: ' + tabs);
  const rows = await run("document.querySelectorAll('#wxList .place').length");
  rows === 2 ? ok('danh sách địa điểm (vị trí hiện tại + 1)') : fail('địa điểm: ' + rows);
  // Đổi vài cài đặt: kiểm tra lệnh gửi đi đúng khóa / giá trị
  await run(`(function(){
    const c = document.querySelector('#tabsPick input[value=sys]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true }));
    const r = document.querySelector('input[name=hide][value=tabs]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true }));
    const sel = document.querySelector('select[data-key=tempUnit]'); sel.value = 'F'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    const sz = document.querySelector('#sizePick input[value="1.15"]'); sz.checked = true; sz.dispatchEvent(new Event('change', { bubbles: true }));
  })();0`);
  await wait(100);
  const calls = JSON.stringify(await run('window.__calls'));
  for (const want of ['["set","tabsHidden",[]]', '["set","hideMode","tabs"]', '["set","tempUnit","F"]', '["set","pillScale",1.15]']) {
    calls.includes(want) ? ok('gửi ' + want) : fail('thiếu lệnh ' + want + ' trong ' + calls);
  }
  errors.length ? errors.forEach((e) => fail('lỗi JS Cài đặt: ' + e)) : ok('không có lỗi JavaScript');
  w.destroy();
}

app.on('window-all-closed', () => {}); // đóng cửa sổ viên thuốc xong vẫn chạy tiếp phần Cài đặt
app.whenReady().then(async () => {
  try { await testPill(); await testSettings(); } catch (e) { fail('kiểm thử dừng giữa chừng: ' + (e && e.stack || e)); }
  console.log(failures.length ? `\n${failures.length} lỗi` : '\nTất cả đều ổn');
  app.exit(failures.length ? 1 : 0);
});
