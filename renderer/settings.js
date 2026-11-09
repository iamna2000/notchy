// Cửa sổ Cài đặt: đọc trạng thái từ main (settings:get / settings:state), mỗi thay đổi gửi ngay (settings:set)
(() => {
  const api = window.settings;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICONS = {
    general: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    hide: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9.5 7.5h5"/><path d="M8 13l4 3 4-3"/>'),
    weather: svg('<path d="M7 18a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19.5 11 3.5 3.5 0 0 1 18 18z"/>'),
    notify: svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
    data: svg('<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="M8 12h8M8 16h5"/>'),
    about: svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    download: svg('<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>'),
    shot: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="12" cy="12" r="3.2"/>'),
    headphones: svg('<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="6" rx="1.6"/><rect x="16.5" y="14" width="4.5" height="6" rx="1.6"/>'),
    battery: svg('<rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M22 11v2"/><path d="M11.5 9l-2 3h3l-2 3"/>'),
    update: svg('<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
    island: svg('<rect x="5" y="4" width="14" height="6" rx="3"/><path d="M3 20h18"/>'),
    // Icon tab: cùng hình với thanh icon trên viên thuốc
    't-music': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3.2 9.6 4.6a1 1 0 0 0-.8 1v9.1a3.2 3.2 0 1 0 2 3V8.6l4.7-1v5.1a3.2 3.2 0 1 0 2 3V4.2a1 1 0 0 0-1-1z"/></svg>',
    't-weather': svg('<path d="M8.6 3.2v1.4M3.4 8.4H2M4.9 4.7l1 1M12.3 4.7l-1 1"/><path d="M5.7 11.2a3.2 3.2 0 1 1 6-2.1"/><path d="M8.8 20h8.1a3.3 3.3 0 0 0 .5-6.55 4.4 4.4 0 0 0-8.5-.95A3.75 3.75 0 0 0 8.8 20z"/>'),
    't-calendar': svg('<rect x="3.8" y="5.2" width="16.4" height="15" rx="3.2"/><path d="M3.8 10.2h16.4M8.4 3.2v4M15.6 3.2v4"/>'),
    't-clip': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.2 3a2 2 0 0 0-1.9 1.4H6.8A2.8 2.8 0 0 0 4 7.2v11A2.8 2.8 0 0 0 6.8 21h10.4a2.8 2.8 0 0 0 2.8-2.8v-11a2.8 2.8 0 0 0-2.8-2.8h-.5A2 2 0 0 0 14.8 3zm0 1.6h5.6a.4.4 0 0 1 .4.4v.6a.4.4 0 0 1-.4.4H9.2a.4.4 0 0 1-.4-.4V5a.4.4 0 0 1 .4-.4z"/></svg>',
    't-shelf': svg('<path d="M3.5 8.2a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
    't-sys': svg('<path d="M4.6 17.5a8.6 8.6 0 1 1 14.8 0"/><path d="M12 13.2l3.6-4.4"/><circle cx="12" cy="13.6" r="1.4" fill="currentColor" stroke="none"/>'),
  };
  $$('[data-ic]').forEach((el) => { el.innerHTML = ICONS[el.dataset.ic] || ''; });

  let S = null;

  // ----- Chuyển mục -----
  const SECS = $$('.sec').map((s) => s.dataset.sec);
  function go(sec) {
    if (!SECS.includes(sec)) sec = 'general';
    $$('.side button').forEach((b) => b.classList.toggle('on', b.dataset.sec === sec));
    $$('.sec').forEach((s) => s.classList.toggle('on', s.dataset.sec === sec));
    $('#main').scrollTop = 0;
    try { history.replaceState(null, '', '#' + sec); } catch (_) {}
  }
  $('#side').addEventListener('click', (e) => { const b = e.target.closest('button[data-sec]'); if (b) go(b.dataset.sec); });
  api.onGoto(go);
  go(location.hash.slice(1));

  // ----- Báo nhỏ -----
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600);
  }

  // ----- Vẽ trạng thái -----
  function fmtCount(n, unit) { return n ? `${n} ${unit}` : `Không có ${unit} nào`; }
  function render(st) {
    S = st;
    // Công tắc / ô chọn gắn với một khóa
    $$('[data-key]').forEach((el) => {
      const v = st[el.dataset.key];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.tagName === 'SELECT' && el.id !== 'displaySel') el.value = String(v == null ? '' : v);
    });
    $$('[data-notify]').forEach((el) => { el.checked = !!(st.notify && st.notify[el.dataset.notify]); });

    // Màn hình
    const ds = $('#displaySel');
    ds.innerHTML = st.displays.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    ds.value = String(st.display);
    ds.disabled = st.displays.length < 2;
    $('#displayNote').textContent = st.displays.length < 2 ? 'Chỉ có một màn hình' : 'Viên thuốc nằm ở mép trên màn hình này';

    // Tự ẩn
    $$('#hideChoices input[name=hide]').forEach((r) => {
      r.checked = r.value === st.hideMode;
      r.closest('.choice').classList.toggle('sel', r.checked);
    });
    // Tab hiện trên viên thuốc
    const hid = st.tabsHidden || [];
    $$('#tabsPick input').forEach((c) => {
      c.checked = !hid.includes(c.value);
      c.closest('label').classList.toggle('home', c.value === st.defaultTab); // chấm xanh dưới trang mặc định
    });
    const hidNames = $$('#tabsPick input').filter((c) => !c.checked).map((c) => c.getAttribute('aria-label'));
    $('#tabsHint').textContent = 'Bấm icon để ẩn / hiện tab · chấm xanh là trang mặc định' + (hidNames.length ? ` · đang ẩn: ${hidNames.join(', ')}` : '');
    // Thời gian chờ chỉ dùng cho chế độ "Khi có cửa sổ bên dưới"
    $('#delaySel').disabled = st.hideMode !== 'window';
    // Phím tắt
    const keyName = (k) => (k ? k.replace('Control', 'Ctrl').split('+').join(' + ') : '');
    $('#hotkeyNote').textContent = !st.hotkey ? 'Đang tắt'
      : st.hotkeyOk ? 'Mở bảng đầy đủ không cần rê chuột; Esc hoặc nhấn lại để đóng'
      : 'Ứng dụng khác đang dùng tổ hợp này, hãy chọn tổ hợp khác';
    $('#hotkeyNote').classList.toggle('bad', !!st.hotkey && !st.hotkeyOk);

    renderWeather(st);

    // Bảng tạm / kệ
    $('#clipInfo').textContent = `${fmtCount(st.clipCount, 'mục')}${st.clipPinned ? ` · ${st.clipPinned} mục đã ghim` : ''} · nhớ tối đa ${st.clipMax} mục`;
    $('[data-act=clipClear]').disabled = !st.clipCount;
    $('#shelfInfo').textContent = fmtCount(st.shelfCount, 'tệp') + ' trên kệ';
    $('[data-act=shelfClear]').disabled = !st.shelfCount;

    renderUpdate(st);
  }

  // ----- Thời tiết: danh sách địa điểm -----
  const HERE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11 21 3l-8 18-2-8z"/></svg>';
  const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  const UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
  const DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  const DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const tempTxt = (t) => (t == null ? '' : `${Math.round(t)}°`);
  function renderWeather(st) {
    const main = st.wxMain;
    const autoOk = st.wxAuto && st.wxAutoPlace;
    const autoSub = !st.wxAuto ? 'Đang tắt' : st.wxAutoFailed ? 'Không xác định được qua mạng' : autoOk ? `${st.wxAutoPlace.name} · đoán theo địa chỉ IP` : 'Đang xác định…';
    const radio = (id, on, dis) => `<input type="radio" name="wxMain" value="${esc(id)}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''} title="Đặt làm địa điểm chính" />`;
    const rows = [`
      <div class="row place ${st.wxAutoFailed ? 'bad' : ''}">
        ${radio('auto', main === 'auto' && autoOk, !autoOk)}
        <i class="ico" style="--c:#0a84ff">${HERE}</i>
        <div class="txt"><b>Vị trí hiện tại${main === 'auto' && autoOk ? ' <em>Chính</em>' : ''}</b><span>${esc(autoSub)}</span></div>
        <span class="tmp">${autoOk ? tempTxt(st.wxAutoPlace.temp) : ''}</span>
        <input type="checkbox" class="sw" data-wx="auto" ${st.wxAuto ? 'checked' : ''} title="Dùng vị trí hiện tại" />
      </div>`];
    st.wxPlaces.forEach((p, i) => rows.push(`
      <div class="row place">
        ${radio(p.id, main === p.id)}
        <i class="ico" style="--c:#ff9f0a">${PIN}</i>
        <div class="txt"><b>${esc(p.name)}${main === p.id ? ' <em>Chính</em>' : ''}</b><span>${esc(p.sub || '')}</span></div>
        <span class="tmp">${tempTxt(p.temp)}</span>
        <div class="tools">
          <button class="ib" data-wxmove="${esc(p.id)}" data-dir="-1" ${i === 0 ? 'disabled' : ''} title="Lên">${UP}</button>
          <button class="ib" data-wxmove="${esc(p.id)}" data-dir="1" ${i === st.wxPlaces.length - 1 ? 'disabled' : ''} title="Xuống">${DOWN}</button>
          <button class="ib del" data-wxdel="${esc(p.id)}" title="Xóa">${DEL}</button>
        </div>
      </div>`));
    $('#wxList').innerHTML = rows.join('');
    $('#wxWarn').classList.toggle('on', !!st.wxAutoFailed && !st.wxPlaces.length);
    $('#wxMax').textContent = st.wxMax;
    const full = st.wxPlaces.length >= st.wxMax;
    $('#geoIn').disabled = full;
    $('#geoIn').placeholder = full ? 'Đã đủ số địa điểm tối đa' : 'Thêm địa điểm: nhập tên thành phố, ví dụ Đà Nẵng';
  }
  $('#wxList').addEventListener('click', (e) => {
    const mv = e.target.closest('[data-wxmove]'), del = e.target.closest('[data-wxdel]');
    if (mv) set('wxMove', { id: mv.dataset.wxmove, dir: Number(mv.dataset.dir) }, 'Đã đổi thứ tự');
    else if (del) set('wxDel', del.dataset.wxdel, 'Đã xóa địa điểm');
  });

  function renderUpdate(st) {
    const u = st.upd || {};
    $('#verLine').textContent = `Phiên bản ${st.version}` + (st.packaged ? '' : ' · chạy từ mã nguồn');
    $('#updDot').classList.toggle('on', u.state === 'ready');
    const box = $('#updBox');
    if (!st.packaged) {
      box.innerHTML = '<small>Tự cập nhật chỉ có ở bản cài đặt</small>';
      return;
    }
    const map = {
      ready: `<button class="btn primary" data-act="installUpdate">Cập nhật lên ${esc(u.version)}</button><small class="ok">Đã tải xong, Notchy sẽ khởi động lại</small>`,
      downloading: `<div class="prog"><i style="width:${u.percent || 0}%"></i></div><small>Đang tải bản ${esc(u.version)}… ${u.percent || 0}%</small>`,
      checking: '<button class="btn" disabled>Đang kiểm tra…</button>',
      latest: '<button class="btn" data-act="checkUpdate">Kiểm tra cập nhật</button><small class="ok">Đang là bản mới nhất</small>',
      error: `<button class="btn" data-act="checkUpdate">Thử lại</button><small class="err">Không kiểm tra được: ${esc(u.err || 'lỗi mạng')}</small>`,
    };
    box.innerHTML = map[u.state] || '<button class="btn" data-act="checkUpdate">Kiểm tra cập nhật</button><small>Notchy tự kiểm tra mỗi 4 giờ</small>';
  }

  // ----- Thay đổi -----
  async function set(key, val, msg) {
    const st = await api.set(key, val);
    render(st);
    toast(msg || 'Đã lưu');
  }
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.notify) return set('notify', { kind: el.dataset.notify, on: el.checked });
    if (el.name === 'hide') return set('hideMode', el.value);
    if (el.closest('#tabsPick')) {
      const off = $$('#tabsPick input').filter((c) => !c.checked).map((c) => c.value);
      if (off.length >= 6) { el.checked = true; toast('Cần giữ lại ít nhất 1 tab'); return; }
      return set('tabsHidden', off);
    }
    if (el.name === 'wxMain') return set('wxMain', el.value, 'Đã đổi địa điểm chính');
    if (el.dataset.wx === 'auto') return set('wxAuto', el.checked);
    if (!el.dataset.key) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.num !== undefined || el.dataset.key === 'display') v = Number(v);
    set(el.dataset.key, v);
  });
  const CONFIRM = {
    clipClear: 'Xóa toàn bộ lịch sử bảng tạm (giữ mục đã ghim)?',
    shelfClear: 'Bỏ hết tệp khỏi Kệ tạm? (không xóa tệp thật)',
    quit: 'Thoát Notchy?',
    reset: 'Khôi phục mọi cài đặt về mặc định? (ghi chú, bảng tạm, kệ tạm, địa điểm thời tiết được giữ)',
    report: 'Tạo tệp báo lỗi ra Desktop và mở trang báo lỗi trên GitHub?',
  };
  const DONE = { clipClear: 'Đã xóa lịch sử bảng tạm', shelfClear: 'Đã dọn kệ', checkUpdate: 'Đang kiểm tra cập nhật…', reset: 'Đã khôi phục mặc định', report: 'Đã tạo tệp báo lỗi trên Desktop' };
  document.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-goto]');
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      const a = b.dataset.act;
      if (CONFIRM[a] && !confirm(CONFIRM[a])) return;
      const r = await api.act(a);
      if (a === 'report' && !r) toast('Không tạo được tệp báo lỗi');
      else if (DONE[a]) toast(DONE[a]);
    }
    if (g) go(g.dataset.goto);
  });

  // ----- Tìm thành phố -----
  let geoT, geoSeq = 0;
  $('#geoIn').addEventListener('input', (e) => {
    clearTimeout(geoT);
    const q = e.target.value.trim();
    if (q.length < 2) { $('#geoList').innerHTML = ''; return; }
    geoT = setTimeout(async () => {
      const seq = ++geoSeq;
      $('#geoList').innerHTML = '<div class="geo-msg">Đang tìm…</div>';
      const res = await api.geo(q);
      if (seq !== geoSeq) return;
      if (res === null) { $('#geoList').innerHTML = '<div class="geo-msg">Không tìm được (kiểm tra mạng)</div>'; return; }
      if (!res.length) { $('#geoList').innerHTML = '<div class="geo-msg">Không thấy thành phố nào</div>'; return; }
      $('#geoList').innerHTML = res.map((r, i) => `<button class="geo-item" data-i="${i}"><span>${esc(r.name)}</span><small>${esc(r.sub)}</small></button>`).join('');
      $('#geoList').onclick = (ev) => {
        const it = ev.target.closest('.geo-item'); if (!it) return;
        const r = res[Number(it.dataset.i)];
        $('#geoIn').value = ''; $('#geoList').innerHTML = '';
        set('wxAdd', { name: r.name, sub: r.sub, lat: r.lat, lon: r.lon }, `Đã thêm ${r.name}`);
      };
    }, 350);
  });
  $('#geoIn').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.target.value = ''; $('#geoList').innerHTML = ''; }
    if (e.key === 'Enter') { const f = $('#geoList .geo-item'); if (f) f.click(); }
  });

  api.onState(render);
  api.get().then(render);
})();
