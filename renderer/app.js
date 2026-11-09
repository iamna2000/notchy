(() => {
  'use strict';

  const api = window.api || new Proxy({}, { get: () => () => {} });
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const store = {
    get(k, d) { try { const v = localStorage.getItem('di.' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('di.' + k, JSON.stringify(v)); } catch (_) {} },
  };

  /* ================= Biểu tượng ================= */
  const L = (inner, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 1.9}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const F = (inner) => `<svg viewBox="0 0 24 24" fill="currentColor">${inner}</svg>`;
  const ICON = {
    music: F('<path d="M16.5 3.2 9.6 4.6a1 1 0 0 0-.8 1v9.1a3.2 3.2 0 1 0 2 3V8.6l4.7-1v5.1a3.2 3.2 0 1 0 2 3V4.2a1 1 0 0 0-1-1z"/>'),
    weather: L('<path d="M8.6 3.2v1.4M3.4 8.4H2M4.9 4.7l1 1M12.3 4.7l-1 1"/><path d="M5.7 11.2a3.2 3.2 0 1 1 6-2.1"/><path d="M8.8 20h8.1a3.3 3.3 0 0 0 .5-6.55 4.4 4.4 0 0 0-8.5-.95A3.75 3.75 0 0 0 8.8 20z"/>', 1.8),
    clip: F('<path d="M9.2 3a2 2 0 0 0-1.9 1.4H6.8A2.8 2.8 0 0 0 4 7.2v11A2.8 2.8 0 0 0 6.8 21h10.4a2.8 2.8 0 0 0 2.8-2.8v-11a2.8 2.8 0 0 0-2.8-2.8h-.5A2 2 0 0 0 14.8 3zm0 1.6h5.6a.4.4 0 0 1 .4.4v.6a.4.4 0 0 1-.4.4H9.2a.4.4 0 0 1-.4-.4V5a.4.4 0 0 1 .4-.4z"/>'),
    gauge: L('<path d="M4.6 17.5a8.6 8.6 0 1 1 14.8 0"/><path d="M12 13.2l3.6-4.4"/><circle cx="12" cy="13.6" r="1.4" fill="currentColor" stroke="none"/>', 2),
    play: F('<path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z"/>'),
    pause: F('<rect x="6.2" y="4.8" width="4.2" height="14.4" rx="1.3"/><rect x="13.6" y="4.8" width="4.2" height="14.4" rx="1.3"/>'),
    next: F('<path d="M3.6 6.6v10.8a1 1 0 0 0 1.55.84l7.2-4.7v3.86a1 1 0 0 0 1.55.84l7.6-4.9a1 1 0 0 0 0-1.68l-7.6-4.9a1 1 0 0 0-1.55.84v3.86l-7.2-4.7a1 1 0 0 0-1.55.84z"/>'),
    prev: F('<path d="M20.4 6.6v10.8a1 1 0 0 1-1.55.84l-7.2-4.7v3.86a1 1 0 0 1-1.55.84l-7.6-4.9a1 1 0 0 1 0-1.68l7.6-4.9a1 1 0 0 1 1.55.84v3.86l7.2-4.7a1 1 0 0 1 1.55.84z"/>'),
    shuffle: L('<path d="M3 7h3c2 0 3.2 1 4.3 2.7l3.4 5.6c1.1 1.7 2.3 2.7 4.3 2.7h3M3 17h3c1.3 0 2.3-.4 3.1-1.2M13.8 8.7C14.7 7.6 15.8 7 17.2 7H21M18.4 4.4 21 7l-2.6 2.6M18.4 14.4 21 17l-2.6 2.6"/>', 2),
    airplay: L('<path d="M8 17.5H6.5A2.5 2.5 0 0 1 4 15V7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V15a2.5 2.5 0 0 1-2.5 2.5H16"/><path d="m12 14.2 4.4 5.8H7.6z"/>', 2),
    spkLow: L('<path d="M4 9.8h3l4-3.3v11l-4-3.3H4z" fill="currentColor"/>', 1.8), // thân loa vẽ y hệt spkHigh để cùng tỉ lệ
    spkHigh: L('<path d="M4 9.8h3l4-3.3v11l-4-3.3H4z" fill="currentColor"/><path d="M14.6 9.2a4 4 0 0 1 0 5.6M17 6.8a7.4 7.4 0 0 1 0 10.4"/>', 1.8),
    spkMute: L('<path d="M4 9.8h3l4-3.3v11l-4-3.3H4z" fill="currentColor"/><path d="m15 9.5 5 5M20 9.5l-5 5"/>', 1.8),
    monitor: L('<rect x="3.5" y="4.5" width="17" height="11" rx="2"/><path d="M9 20h6M12 15.5V20"/>', 1.8),
    headphones: L('<path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3"/><rect x="3.5" y="14.5" width="4" height="6" rx="1.8"/><rect x="16.5" y="14.5" width="4" height="6" rx="1.8"/>', 1.8),
    speaker: L('<rect x="6" y="3.5" width="12" height="17" rx="3"/><circle cx="12" cy="14.5" r="3"/><circle cx="12" cy="8" r="1"/>', 1.8),
    gear: L('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/>', 1.8),
    search: L('<circle cx="11" cy="11" r="6.2"/><path d="m20 20-4.4-4.4"/>', 2),
    xCircle: F('<path d="M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8zm3.4 12.2a.9.9 0 0 1-1.3 1.3L12 14l-2.1 2.1a.9.9 0 0 1-1.3-1.3L10.7 12.7 8.6 10.6a.9.9 0 0 1 1.3-1.3L12 11.4l2.1-2.1a.9.9 0 0 1 1.3 1.3l-2.1 2.1z" fill-rule="evenodd"/>'),
    minusCircle: F('<path d="M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8zM7.8 11.1h8.4a.9.9 0 0 1 0 1.8H7.8a.9.9 0 0 1 0-1.8z" fill-rule="evenodd"/>'),
    mail: L('<rect x="3.5" y="6" width="17" height="12" rx="2.4"/><path d="m4.5 8 7.5 5.2L19.5 8"/>', 2.2),
    link: L('<circle cx="12" cy="12" r="8.4"/><path d="m15.4 8.6-2 5.2-4.8 1.6 2-5.2z"/>', 2),
    note: L('<path d="M7 8h10M7 12h10M7 16h6"/>', 2.4),
    bookmark: L('<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-4.2L6 20V5.5a1 1 0 0 1 1-1z"/>', 2),
    bookmarkF: F('<path d="M7 3.8h10a1.5 1.5 0 0 1 1.5 1.5v14.6a.6.6 0 0 1-.95.5L12 16.5l-5.55 3.9a.6.6 0 0 1-.95-.5V5.3A1.5 1.5 0 0 1 7 3.8z"/>'),
    x: L('<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>', 2),
    check: L('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.2),
    plus: L('<path d="M12 5v14M5 12h14"/>', 2),
    left: L('<path d="m14.5 6-6 6 6 6"/>', 2),
    right: L('<path d="m9.5 6 6 6-6 6"/>', 2),
    up: L('<path d="m6 14.5 6-6 6 6"/>', 2),
    down: L('<path d="m6 9.5 6 6 6-6"/>', 2),
    lock: L('<rect x="5" y="10.5" width="14" height="10" rx="2.4"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>', 2),
    expand: L('<path d="M12 4.5v10M7.5 10 12 14.5 16.5 10M5.5 19h13"/>', 2),
    collapse: L('<path d="M12 19.5v-10M7.5 14 12 9.5l4.5 4.5M5.5 5h13"/>', 2),
    calendar: L('<rect x="3.8" y="5.2" width="16.4" height="15" rx="3.2"/><path d="M3.8 10.2h16.4M8.4 3.2v4M15.6 3.2v4"/>', 1.8),
    clock: F('<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm.8 4.6v4.2l2.9 1.7a.8.8 0 0 1-.8 1.4l-3.3-1.9a.8.8 0 0 1-.4-.7V7.6a.8.8 0 0 1 1.6 0z" fill-rule="evenodd"/>'),
    bell: L('<path d="M6 16.6h12l-1.6-2.2v-4.2a4.4 4.4 0 0 0-8.8 0v4.2z"/><path d="M10 19.6a2 2 0 0 0 4 0"/>'),
    shelf: L('<path d="M3.5 8.2a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>', 1.8),
    file: L('<path d="M7 3.5h6.5L18 8v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/><path d="M13.5 3.5V8H18"/>', 1.7),
    bolt: F('<path d="M13.4 2.6 5.6 13.2a.7.7 0 0 0 .56 1.1h4.1l-1 6.5a.5.5 0 0 0 .9.36l7.8-10.6a.7.7 0 0 0-.56-1.12h-4.1l1-6.5a.5.5 0 0 0-.9-.34z"/>'),
    battery: L('<rect x="2.8" y="7.5" width="16" height="9" rx="2.2"/><path d="M21.2 10.5v3"/><path d="M5.6 10.6v2.8" stroke-width="2.2"/>', 1.8),
    download: L('<path d="M12 4v10.5M7.8 10.8 12 15l4.2-4.2M5 19.2h14"/>', 2),
  };

  /* ================= Hằng số & trạng thái ================= */
  const WD_FULL = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const WD_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
  const TOPBAR = 46;

  const today0 = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const ymd = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const S = {
    hover: false, hoverRaw: false, peek: false, hidden: false, typing: false,
    tab: 'music', // trang mặc định; rời viên thuốc quá TAB_RESET thì tự quay về (xem api.onHover)
    ring: null,
    media: { active: false }, mediaError: '', drag: null, outOpen: false,
    sys: { vol: -1, mute: false, devices: [], audio: true },
    weather: null,
    notes: store.get('notes', {}),
    sel: today0(), calMonth: store.get('calMonth', false),
    clip: [], clipQ: '', shelf: [], notice: null,
    wxOpen: store.get('wxOpen', false), // Thời tiết: false = gọn (1 lưu ý, dải 7 ngày nhỏ), true = đầy đủ
    shelfOpen: store.get('shelfOpen', false), // Kệ tạm: false = một hàng cuộn ngang, true = lưới 5 cột (tối đa 3 hàng rồi cuộn dọc)
  };

  /* ================= Bố cục / hoạt ảnh viên thuốc ================= */
  const island = $('#island');
  const compactEl = $('#compact');
  let layoutKey = '';
  const SH_COLS = 5, SH_ROW = 70; // lưới Kệ tạm khi mở rộng (khớp CSS .shelf-list.grid)
  let clipH = 0; // chiều cao nội dung tab Bảng tạm: viên thuốc dài theo số mục (tối đa ~6 mục rồi cuộn)
  let wxH = 0; // chiều cao nội dung tab Thời tiết (đo sau khi vẽ) để viên thuốc mở vừa khít
  const wxHs = { full: 0, compact: 0 }; // đo sẵn cả hai chế độ để đổi qua lại không phải đo giữa lúc đang chuyển động
  let closeTimer = null, peekTimer = null;
  // Cửa sổ Cài đặt gửi sang: trang mặc định, thời gian rời viên thuốc thì quay về trang đó (giây, 0 = không), bật/tắt từng loại thông báo
  S.prefs = { defaultTab: 'music', tabReset: 60, notify: {}, tabsHidden: [], tempUnit: 'C', clipPaused: false };
  let prefsInit = false;
  api.onPrefs((p) => {
    if (!p) return;
    const unitChanged = p.tempUnit !== S.prefs.tempUnit, pauseChanged = p.clipPaused !== S.prefs.clipPaused;
    S.prefs = Object.assign(S.prefs, p);
    // Ẩn bớt tab trên thanh icon; đang xem tab vừa bị ẩn thì về trang mặc định
    const hid = S.prefs.tabsHidden || [];
    $$('.tb').forEach((b) => { b.hidden = hid.includes(b.dataset.tab); });
    if (prefsInit && hid.includes(S.tab)) setTab(S.prefs.defaultTab);
    if (unitChanged) { compactSig = ''; renderCompact(); renderWeather(); }
    if (pauseChanged) renderClip();
    // Lần đầu (mở app): vào thẳng trang mặc định
    if (!prefsInit) { prefsInit = true; if (S.tab !== S.prefs.defaultTab && !S.hover) setTab(S.prefs.defaultTab); }
  });
  let leftAt = 0;          // lúc viên thuốc thu gọn lần cuối

  const hasMusic = () => !!(S.media.active && S.media.title && (S.media.status === 'Playing' || S.media.status === 'Paused'));
  // Viên thuốc thu gọn chỉ hiện nhạc khi đang phát, hoặc vừa tạm dừng < 5 giây (bấm tạm dừng rồi phát lại ngay
  // không làm viên thuốc nhảy qua lại). Dừng lâu hơn thì về ngày · giờ · thời tiết; bảng nhạc vẫn giữ bài đang dừng.
  // Đang rê chuột trên viên thuốc nhạc (vừa bấm tạm dừng ở đó) thì giữ nguyên, không đổi dưới con trỏ.
  const PAUSE_KEEP = 5000;
  let lastPlayingAt = 0; // lần cuối thấy đang phát (mở app khi nhạc đã dừng sẵn thì = 0 -> hiện ngày giờ ngay)
  const compactMusic = () => hasMusic() && (S.media.status === 'Playing' || island.dataset.mode === 'hover'
    || (lastPlayingAt > 0 && Date.now() - lastPlayingAt < PAUSE_KEEP));
  const isPlaying = () => S.media.active && S.media.status === 'Playing';

  // Sóng âm ở viên thuốc (xem waveStart/syncWave bên dưới). Khai báo sớm vì applyLayout gọi syncWave.
  const BANDS = [[60, 250], [250, 1000], [1000, 4000], [4000, 12000]]; // trầm, trung trầm, trung cao, cao
  const BAND_GAIN = [0.9, 1.0, 1.25, 1.7];                            // dải cao vốn nhỏ hơn: nâng lên cho đều
  const WAVE_COLOR = '#c9b8ff'; // tím pastel: màu sóng âm khi không có ảnh bìa
  let waveColor = WAVE_COLOR;   // đổi theo tông màu ảnh bìa (setAccent -> setWaveColor)
  const wave = { slots: {}, stream: null, ctx: null, an: null, data: null, raf: 0, lvl: [0, 0, 0, 0], last: 0, starting: false, stopTimer: 0, failed: false };
  let winOff = false;
  // Chỗ vẽ sóng đang hiện: viên thuốc thu gọn, hoặc bảng nhạc khi mở rộng; null nếu không chỗ nào hiện
  function waveSlot() {
    const m = island.dataset.mode;
    const s = m === 'compact' ? wave.slots.c : (m === 'open' && S.tab === 'music') ? wave.slots.m : null;
    return s && s.g && s.cv.isConnected ? s : null;
  }
  // Chỉ nghe khi sóng đang thật sự hiện và đang phát, cửa sổ không ẩn
  const waveWanted = () => !winOff && isPlaying() && !!waveSlot();

  // Kệ tạm dạng lưới: chỉ khi người dùng chọn mở rộng VÀ có từ 4 tệp (ít hơn thì một hàng là đủ).
  // Chiều cao viên thuốc và class .grid phải dùng chung điều kiện này, lệch nhau là ô ảnh bị cắt.
  const shelfGrid = () => S.shelfOpen && S.shelf.length > 3;
  function viewH() {
    switch (S.tab) {
      case 'music': return hasMusic() ? (S.outOpen ? 316 : 226) + (S.media.override ? 30 : 0) : 168;
      case 'sys': return 302;
      case 'calendar': return S.calMonth ? 368 : 264 + Math.min(3, calEvents()) * 46;
      case 'weather': return 50 + (wxH || 330) + 16;
      case 'clip': return 50 + (clipH || 300) + 12;
      case 'shelf': {
        if (!shelfGrid()) return 210; // một hàng (kể cả khi đang chọn mở rộng mà kệ còn ít tệp)
        const rows = Math.min(3, Math.ceil(S.shelf.length / SH_COLS));
        return 114 + rows * SH_ROW + (rows - 1) * 8 + 4;
      }
      default: return 168;
    }
  }
  function target() {
    if (S.ring) return { mode: 'ring', w: 440, h: 186, r: 40, ear: 16 };
    // Đang có nhạc: rê chuột chỉ phóng to viên thuốc (nút tạm dừng), bấm vào mới mở bảng đầy đủ
    if (S.peek || S.typing || (S.hover && (S.open || !compactMusic()))) return { mode: 'open', w: 480, h: viewH(), r: 40, ear: 18 };
    if (S.hover) return { mode: 'hover', w: 400, h: 56, r: 26, ear: 12 };
    if (S.notice) return { mode: 'notice', w: 340, h: 60, r: 30, ear: 15 };
    // Không phát gì: rộng ra để chứa ngày · giờ · thời tiết
    let c = { w: wxFresh() ? 236 : 196, h: 34, r: 17, ear: 9 };
    if (compactMusic()) c = { w: 350, h: 42, r: 20, ear: 10 };
    // Khi ẩn: thanh Home kiểu iPhone (bo tròn hết, cách mép trên 3px; xem CSS)
    if (S.hidden) return { mode: 'hidden', w: 100, h: 4, r: 40, ear: 0 };
    return Object.assign(c, { mode: 'compact' });
  }
  function applyLayout() {
    const t = target();
    const key = [t.mode, t.w, t.h].join('|');
    if (key === layoutKey) return;
    layoutKey = key;
    island.dataset.mode = t.mode;
    island.style.width = t.w + 'px';
    island.style.height = t.h + 'px';
    // Thu thành vạch: bo lớn cả 4 góc (trình duyệt tự giới hạn theo kích thước, vạch 4px thành viên con nhộng).
    // Trước đây ép ngay về 2px nên lúc đang co từ bảng lớn trông như một khối vuông.
    island.style.borderRadius = t.mode === 'hidden' ? `${t.r}px` : `0 0 ${t.r}px ${t.r}px`;
    island.style.setProperty('--ear', t.ear + 'px');
    api.size(t.w, t.h);
    syncWave();
    syncStats();
  }
  function collapseSoon(ms) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (S.hoverRaw || S.typing || drag) return;
      S.hover = false; S.open = false; leftAt = Date.now();
      // Lần rê chuột sau mở lại bảng nhạc ở dạng gọn: đóng phần chọn thiết bị phát nếu còn mở
      if (S.outOpen) { S.outOpen = false; musicSig = ''; renderMusic(); }
      applyLayout();
      nextNotice(); // thông báo đến trong lúc đang dùng bảng: hiện bây giờ
    }, ms);
  }
  // Chờ ý định: viên thuốc nằm ngay trên thanh tab trình duyệt nên chuột lướt qua nó liên tục. Chỉ phản ứng khi
  // chuột ở yên trong vùng viên thuốc HOVER_INTENT ms; lướt qua (đi lên bấm tab) thì không bung bảng nữa.
  // Đang mở / vừa rời chưa kịp thu (S.hover còn true) thì phản ứng ngay, để rê ra vào mép bảng không bị khựng.
  const HOVER_INTENT = 150;
  let hoverTimer = null;
  function enterHover() {
    clearTimeout(hoverTimer); hoverTimer = null;
    if (S.hover) return;
    const reset = (S.prefs.tabReset || 0) * 1000, home = S.prefs.defaultTab || 'music';
    if (reset && leftAt && Date.now() - leftAt >= reset && S.tab !== home) setTab(home);
    leftAt = 0;
    // Rê vào đúng lúc đang báo "Đã thêm vào Kệ tạm": mở thẳng Kệ tạm để kéo ảnh đi luôn
    if (S.notice && S.notice.kind === 'shot') { if (S.tab !== 'shelf') setTab('shelf'); S.open = true; }
    S.hover = true; applyLayout(); requestSys();
  }
  api.onHover((v) => {
    S.hoverRaw = v;
    clearTimeout(closeTimer);
    clearTimeout(hoverTimer); hoverTimer = null;
    if (v) {
      if (S.hover) enterHover();
      else hoverTimer = setTimeout(enterHover, HOVER_INTENT);
    } else if (S.hover) collapseSoon(380);
    else nextNotice(); // lướt qua, chưa mở gì: thông báo đang chờ (nếu có) hiện tiếp
  });
  api.onHidden((v) => { S.hidden = !!v; applyLayout(); });
  // Phím tắt mở viên thuốc: mở bảng đầy đủ dù chuột không ở đó; Esc / bấm lại phím tắt để đóng.
  // Không rê chuột vào trong 10 giây thì tự đóng.
  let kbTimer;
  api.onKbOpen((v) => {
    clearTimeout(kbTimer);
    if (v) {
      clearTimeout(closeTimer);
      const reset = (S.prefs.tabReset || 0) * 1000, home = S.prefs.defaultTab || 'music';
      if (reset && leftAt && Date.now() - leftAt >= reset && S.tab !== home) setTab(home);
      leftAt = 0;
      S.hover = true; S.open = true; applyLayout(); requestSys();
      kbTimer = setTimeout(() => { if (!S.hoverRaw) api.kbClose(); }, 10000);
    } else if (!S.hoverRaw) collapseSoon(0);
  });
  api.onWinVis((v) => { winOff = !v; document.documentElement.classList.toggle('win-off', winOff); syncWave(); syncStats(); });
  api.onPeek(() => {
    S.peek = true; applyLayout();
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => { S.peek = false; applyLayout(); }, 3000);
  });

  /* ================= Tab ================= */
  const TB_ICON = { music: ICON.music, sys: ICON.gauge, weather: ICON.weather, clip: ICON.clip, shelf: ICON.shelf };
  $$('.tb').forEach((b) => { if (TB_ICON[b.dataset.tab]) b.innerHTML = TB_ICON[b.dataset.tab]; });
  $('#tbSet').innerHTML = ICON.gear;
  // Thứ tự tab trên thanh icon: trang mới trượt vào từ phía tab được bấm, trang cũ trượt ra phía ngược lại
  const TAB_ORDER = ['music', 'weather', 'calendar', 'clip', 'shelf', 'sys'];
  function setTab(id) {
    const dir = Math.sign(TAB_ORDER.indexOf(id) - TAB_ORDER.indexOf(S.tab));
    S.tab = id;
    $$('.tb').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
    const views = $$('.view');
    const incoming = views.find((v) => v.dataset.view === id && !v.classList.contains('on'));
    // Trang sắp hiện: đặt điểm xuất phát rồi đọc lại style (để chuyển động bắt đầu từ đúng phía), sau đó mới bật
    if (incoming && dir) { incoming.style.setProperty('--dir', dir); void getComputedStyle(incoming).transform; }
    views.forEach((v) => {
      const on = v.dataset.view === id;
      if (!on && v.classList.contains('on')) v.style.setProperty('--dir', -dir);
      v.classList.toggle('on', on);
    });
    renderTopDate();
    renderAll();
    syncWave();
    syncStats();
    applyLayout();
    requestSys(true);
  }
  function renderTopDate() {
    const n = new Date(), el = $('#tbDate');
    const t = S.tab === 'calendar' ? `${n.getDate()}.${n.getMonth() + 1}` : String(n.getDate());
    if (el.textContent !== t) el.textContent = t; // gọi mỗi giây
  }

  /* ================= Định dạng ================= */
  const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmtTrack = (sec) => { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600); return h > 0 ? `${h}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}` : `${Math.floor(sec / 60)}:${pad(sec % 60)}`; };
  function lunarOf(d) {
    const r = window.Lunar.solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear(), 7);
    return { d: r[0], m: r[1], y: r[2], leap: r[3] === 1 };
  }

  /* ================= Nhạc ================= */
  function setAccent(url) {
    if (!url) { island.style.removeProperty('--accent'); setWaveColor(WAVE_COLOR); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 16;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, 16, 16);
        const d = x.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, wsum = 0;
        for (let i = 0; i < d.length; i += 4) {
          const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
          const w = 0.15 + (mx - mn) / 255;
          r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; wsum += w;
        }
        r /= wsum; g /= wsum; b /= wsum;
        // đưa về sáng vừa đủ để đọc được trên nền đen
        const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
        let h = 0; const dl = mx - mn;
        if (dl > 0) { if (mx === r / 255) h = ((g - b) / 255 / dl) % 6; else if (mx === g / 255) h = (b - r) / 255 / dl + 2; else h = (r - g) / 255 / dl + 4; h *= 60; if (h < 0) h += 360; }
        const sRaw = dl / (1 - Math.abs(mx + mn - 1) || 1);
        const s = clamp(sRaw, 0.35, 0.75);
        island.style.setProperty('--accent', `hsl(${Math.round(h)} ${Math.round(s * 100)}% 68%)`);
        // Sóng âm: cùng tông ảnh bìa nhưng sáng/nhạt hơn (pastel); ảnh gần như không màu thì dùng xám sáng
        setWaveColor(sRaw < 0.08 ? '#e5e5ea' : `hsl(${Math.round(h)} ${Math.round(clamp(sRaw, 0.45, 0.85) * 100)}% 78%)`);
      } catch (_) {}
    };
    img.src = url;
  }
  function appName(raw) {
    const s = String(raw || '').split('!')[0].replace(/\.exe$/i, '');
    const map = [[/spotify/i, 'Spotify'], [/chrome/i, 'Google Chrome'], [/msedge|edge/i, 'Microsoft Edge'], [/firefox/i, 'Firefox'], [/zune|media ?player/i, 'Media Player'], [/vlc/i, 'VLC'], [/brave/i, 'Brave'], [/opera/i, 'Opera'], [/music\.ui|apple/i, 'Apple Music']];
    for (const [re, name] of map) if (re.test(s)) return name;
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
  // Vị trí hiện tại = vị trí ứng dụng báo + thời gian trôi qua kể từ lúc ứng dụng báo (LastUpdatedTime)
  function curPos() {
    const m = S.media;
    if (!m.active) return 0;
    if (S.drag && S.drag.k === 'seek') return S.drag.sec;
    let p = m.pos || 0;
    if (m.status === 'Playing') p += Math.max(0, (Date.now() - (m.base || Date.now())) / 1000) * (m.rate || 1);
    return m.dur > 0 ? clamp(p, 0, m.dur) : Math.max(p, 0);
  }

  api.onMedia((m) => {
    if (!m) return;
    if (m.type === 'media') {
      S.mediaError = '';
      if (!m.active) { S.media = { active: false }; setAccent(null); }
      else {
        const prev = S.media, same = prev.active && prev.key === m.key, now = Date.now();
        let pos = m.pos, base = m.upd > 0 ? m.upd : now, status = m.status, seekAt = 0;
        const cmdAt = same ? (prev.cmdAt || 0) : 0;
        if (same && S.drag && S.drag.k === 'seek') { pos = prev.pos; base = prev.base; seekAt = prev.seekAt || 0; }
        else if (same && prev.seekAt) {
          // Vừa tua: bỏ qua số liệu cũ ứng dụng chưa kịp cập nhật để thanh không giật lùi
          const fresh = m.upd > 0 ? m.upd >= prev.seekAt - 200 : now - prev.seekAt > 2500;
          if (!fresh && now - prev.seekAt < 8000) { pos = prev.pos; base = prev.base; seekAt = prev.seekAt; }
        }
        if (same && now - cmdAt < 900 && status !== prev.status) { status = prev.status; pos = prev.pos; base = prev.base; }
        const thumb = m.thumb !== undefined ? m.thumb : (same ? prev.thumb : '');
        S.media = { active: true, key: m.key, title: m.title, artist: m.artist, album: m.album, app: m.app, status, pos, base, dur: m.live ? 0 : m.dur, live: !!m.live, rate: m.rate || 1, shuffle: !!m.shuffle, seekAt, cmdAt, thumb,
          // Tab tắt tiếng giành chỗ nguồn của trình duyệt: đang hiện nguồn có tiếng, nút điều khiển bị khóa (ctl: tab giành chỗ)
          override: !!m.override, ctl: m.ctl || '' };
        if (status === 'Playing') lastPlayingAt = now; else if (!same) lastPlayingAt = 0;
        if (thumb !== (prev.thumb || '')) setAccent(thumb);
      }
    } else if (m.type === 'error') {
      S.mediaError = String(m.msg || '');
    }
    renderMusic(); renderCompact(); applyLayout();
  });

  let musicSig = '';
  function renderMusic() {
    const body = $('#musicBody');
    const m = S.media;
    const sig = JSON.stringify([m.active, m.key, m.status, (m.thumb || '').length, S.mediaError, m.dur > 0, !!m.live, !!m.shuffle, S.outOpen, !!m.override]);
    $('#musicOut').classList.toggle('on', S.outOpen && hasMusic());
    if (sig === musicSig) { updateProgress(); return; }
    musicSig = sig;
    if (!hasMusic()) {
      body.innerHTML = `<div class="empty">${ICON.music}<b>${S.mediaError ? 'Chưa kết nối được trình phát nhạc' : 'Chưa có nhạc đang phát'}</b><span>${S.mediaError ? 'Mở Spotify, YouTube hoặc trình phát nhạc bất kỳ và thử lại sau ít giây.' : 'Mở Spotify, YouTube hoặc trình phát nhạc bất kỳ rồi bấm phát, bài hát sẽ hiện ở đây.'}</span></div>`;
      $('#musicOut').innerHTML = '';
      return;
    }
    const hasDur = m.dur > 0;
    body.innerHTML = `
      <div class="m-row">
        <div class="art ${m.status === 'Paused' ? 'paused' : ''}" id="mArt" data-act="m-focus" title="Mở ${esc(appName(m.app) || 'trình phát')}">${m.thumb ? '' : ICON.music}</div>
        <div class="m-meta"><div class="m-title">${esc(m.title)}</div><div class="m-artist">${esc(m.artist || m.album || appName(m.app) || ' ')}</div></div>
        <canvas class="m-eq c-wave ${isPlaying() ? '' : 'idle'}" id="mWave"></canvas>
      </div>
      ${m.live
        ? '<div class="m-prog live"><span class="live-tag"><i></i>LIVE</span><div class="bar"><i></i></div></div>'
        : `<div class="m-prog"><span id="mPos">0:00</span><div class="bar" id="mBar"><i id="mFill"></i><b id="mKnob"></b></div><span id="mRem">${hasDur ? '-0:00' : '--:--'}</span></div>`}
      ${m.override ? `<div class="m-lock">${ICON.lock || ''}<span>Nút điều khiển đang bị ${esc(appName(m.app) || 'trình duyệt')} gán cho tab “${esc(m.ctl)}” (tắt tiếng). Bấm ảnh bìa để mở tab đang phát.</span></div>` : ''}
      <div class="m-ctrls ${m.override ? 'locked' : ''}">
        <button data-act="m-shuffle" class="${m.shuffle ? 'on' : 'dim'}" aria-label="Phát ngẫu nhiên">${ICON.shuffle}</button>
        <button data-act="m-prev" aria-label="Bài trước">${ICON.prev}</button>
        <button class="play" data-act="m-play" aria-label="Phát/Tạm dừng">${m.status === 'Playing' ? ICON.pause : ICON.play}</button>
        <button data-act="m-next" aria-label="Bài sau">${ICON.next}</button>
        <button data-act="m-out" class="${S.outOpen ? 'on' : ''}" aria-label="Thiết bị phát">${ICON.airplay}</button>
      </div>`;
    if (m.thumb) $('#mArt').style.backgroundImage = `url("${m.thumb}")`;
    waveCanvas('m', $('#mWave'));
    syncWave();
    if (isPlaying()) $$('.m-title, .m-artist', body).forEach((el) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const t = el.textContent, item = `<span class="mq-i">${esc(t)}</span>`;
      el.innerHTML = `<div class="mq run">${item}${item}</div>`;
      el.firstElementChild.style.setProperty('--dur', Math.max(6, el.firstElementChild.firstElementChild.offsetWidth / 32).toFixed(1) + 's');
    });
    renderOut();
    updateProgress();
  }
  // Chỉ ghi vào DOM khi giá trị hiển thị thực sự đổi: tick() gọi hàm này 10 lần/giây, mỗi lần ghi style/chữ
  // (dù giống hệt) đều bắt cửa sổ trong suốt vẽ lại. Thanh dài ~420px nên làm tròn 0,1% là đủ mượt.
  let progLast = '';
  function updateProgress() {
    const fill = $('#mFill');
    if (!fill || !hasMusic()) { progLast = ''; return; }
    const m = S.media, p = curPos(), pc = m.dur > 0 ? Math.round((p / m.dur) * 1000) / 10 : 0;
    const pos = fmtTrack(p), rem = m.dur > 0 ? '-' + fmtTrack(m.dur - p) : '--:--';
    const sig = pc + '|' + pos + '|' + rem;
    if (sig === progLast && fill.isConnected && fill.style.width) return;
    progLast = sig;
    fill.style.width = pc + '%';
    $('#mKnob').style.left = pc + '%';
    $('#mPos').textContent = pos;
    $('#mRem').textContent = rem;
  }

  /* ----- Âm lượng + thiết bị phát ----- */
  const devIcon = (n) => (/headphone|airpods|tai nghe|headset|buds|bluetooth/i.test(n) ? ICON.headphones : /monitor|display|hdmi|nvidia|displayport|\bdp\b|tv/i.test(n) ? ICON.monitor : ICON.speaker);
  function renderOut() {
    const el = $('#musicOut');
    if (!hasMusic()) return;
    const devs = S.sys.devices || [];
    const html = `
      <div class="out-vol">${ICON.spkLow}<div class="bar" data-vol="1"><i></i></div>${ICON.spkHigh}</div>
      <div class="out-chips">
        ${devs.map((d) => `<button class="out-chip ${d.def ? 'on' : ''}" data-act="dev" data-id="${esc(d.id)}" title="${esc(d.name)}">${devIcon(d.name)}<span>${esc(d.name)}</span></button>`).join('')}
      </div>`;
    // Danh sách được hỏi lại mỗi ~8 giây: chỉ dựng lại khi thực sự đổi, và giữ nguyên vị trí đã cuộn
    if (html !== outHtml || !el.firstElementChild) {
      const old = $('.out-chips', el), left = old ? old.scrollLeft : 0;
      outHtml = html;
      el.innerHTML = html;
      const chips = $('.out-chips', el);
      chips.scrollLeft = left;
      chipRO.observe(chips); // tính lại viền mờ khi bảng hiện ra (lúc dựng có thể đang ẩn, kích thước 0)
    }
    renderVol();
  }
  let outHtml = '';
  const chipRO = new ResizeObserver((es) => es.forEach((e) => updateChipFade(e.target)));
  // Viền mờ ở mép còn nội dung bị che, để biết là cuộn được
  function updateChipFade(c) {
    c.classList.toggle('fade-l', c.scrollLeft > 2);
    c.classList.toggle('fade-r', c.scrollLeft < c.scrollWidth - c.clientWidth - 2);
  }
  function renderVol() {
    const v = S.sys.vol, ok = v >= 0;
    const frac = ok ? (S.sys.mute ? 0 : v) : 0;
    const b = $('.bar[data-vol] i');
    if (b) b.style.width = frac * 100 + '%';
  }
  api.onSys((m) => {
    if (!m || (m.type !== 'sys' && m.type !== 'sys-error')) return;
    if (m.type === 'sys') {
      if (drag && drag.k === 'vol2') { const keep = S.sys.vol; Object.assign(S.sys, m); S.sys.vol = keep; }
      else Object.assign(S.sys, m);
      if (m.devices) { diffDevices(m.devices); renderOut(); }
      renderVol(); applyLayout();
    }
  });
  let sysLast = 0;
  function requestSys(force) {
    const need = S.tab === 'music' && S.outOpen;
    if (!need || !(S.hover || S.peek)) return;
    const now = Date.now();
    if (!force && now - sysLast < 2000) return;
    sysLast = now;
    api.sys('get');
    if (S.tab === 'music' || force) api.sys('devices');
  }
  const sendTimers = {};
  function sendThrottled(key, cmd) {
    sendTimers[key] = cmd;
    if (sendTimers[key + '_t']) return;
    sendTimers[key + '_t'] = setTimeout(() => { sendTimers[key + '_t'] = 0; api.sys(sendTimers[key]); }, 70);
  }
  function setVol(f) { S.sys.vol = clamp(f, 0, 1); S.sys.mute = false; renderVol(); sendThrottled('vol', 'vol:' + S.sys.vol.toFixed(2)); }

  /* ================= Thời tiết: icon (có hiệu ứng) ================= */
  // Icon nhiều màu kiểu thời tiết của Apple; chọn theo mã thời tiết WMO của Open-Meteo.
  // Các phần có class a-* chỉ chuyển động khi nằm trong khối .wxa (tab Thời tiết), xem CSS.
  const WX_SVG = (inner) => `<svg viewBox="0 0 24 24">${inner}</svg>`;
  const WX_CLOUD = (y = 0, fill = '#e5e5ea') => `<g class="a-cl"><path transform="translate(0 ${y})" fill="${fill}" d="M7.2 18.5h10.1a3.9 3.9 0 0 0 .5-7.77 5.3 5.3 0 0 0-10.2-1.1A4.45 4.45 0 0 0 7.2 18.5z"/></g>`;
  const WX_SUNRAYS = (cx, cy, r, len) => Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a); return `M${(cx + c * r).toFixed(2)} ${(cy + s * r).toFixed(2)}L${(cx + c * (r + len)).toFixed(2)} ${(cy + s * (r + len)).toFixed(2)}`; }).join('');
  const WX_SUN = (cx, cy, r, rr, len, w) => `<path class="a-ray" d="${WX_SUNRAYS(cx, cy, rr, len)}" stroke="#ffd60a" stroke-width="${w}" stroke-linecap="round"/><circle class="a-core" cx="${cx}" cy="${cy}" r="${r}" fill="#ffd60a"/>`;
  const WX_MOON = (d) => `<path class="a-moon" fill="#e8e4ff" d="${d}"/>`;
  const WX = {
    sun: WX_SVG(WX_SUN(12, 12, 4.6, 6.8, 2.6, 1.9)),
    moon: WX_SVG(WX_MOON('M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2z')),
    sunCloud: WX_SVG(`${WX_SUN(9, 8.6, 3.6, 5.3, 1.9, 1.6)}${WX_CLOUD(1.4)}`),
    moonCloud: WX_SVG(`${WX_MOON('M14.6 10.4A5.4 5.4 0 0 1 7.6 3.4a5.4 5.4 0 1 0 7 7z')}${WX_CLOUD(1.4)}`),
    cloud: WX_SVG(`<g class="a-cl2"><path fill="#8e8e93" d="M14.6 11.6h5.3a2.5 2.5 0 0 0 .3-4.98 3.4 3.4 0 0 0-6.55-.7 2.85 2.85 0 0 0 .95 5.68z"/></g>${WX_CLOUD(1.2)}`),
    fog: WX_SVG(`${WX_CLOUD(-3, '#c7c7cc')}<g stroke="#c7c7cc" stroke-width="1.8" stroke-linecap="round"><path class="a-fog" d="M5 18.2h14"/><path class="a-fog" d="M7.5 21h9"/></g>`),
    rain: WX_SVG(`${WX_CLOUD(-3.2)}<g stroke="#64d2ff" stroke-width="1.9" stroke-linecap="round"><path class="a-drop" d="M8.6 17.8l-1 2.6"/><path class="a-drop" d="M12.4 17.8l-1 2.6"/><path class="a-drop" d="M16.2 17.8l-1 2.6"/></g>`),
    storm: WX_SVG(`${WX_CLOUD(-3.2)}<path class="a-bolt" fill="#ffd60a" d="M12.6 15.2l-3.1 4.3h2.4l-1 3.3 3.6-4.6h-2.5l1.3-3z"/>`),
    snow: WX_SVG(`${WX_CLOUD(-3.2)}<g fill="#f2f2f7"><circle class="a-flake" cx="7.6" cy="19.4" r="1.45"/><circle class="a-flake" cx="12" cy="21.4" r="1.45"/><circle class="a-flake" cx="16.4" cy="19.4" r="1.45"/></g>`),
  };
  function wxIcon(code, day) {
    if (code === 0 || code === 1) return day ? WX.sun : WX.moon;
    if (code === 2) return day ? WX.sunCloud : WX.moonCloud;
    if (code === 3) return WX.cloud;
    if (code === 45 || code === 48) return WX.fog;
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return WX.snow;
    if (code >= 95) return WX.storm;
    if (code >= 51 && code <= 82) return WX.rain;
    return WX.cloud;
  }
  // Dữ liệu quá 2 giờ (mất mạng lâu) thì không hiện ở viên thuốc, tránh hiện thời tiết cũ
  const wxFresh = () => !!(S.weather && Date.now() - S.weather.at < 2 * 3600000);

  /* ================= Tab Thời tiết: hiện tại · lưu ý · 7 ngày ================= */
  const TIP_ICON = {
    wear: L('<path d="M9 4 4.5 6.4l1.7 3.6 1.8-.8V20h8V9.2l1.8.8 1.7-3.6L15 4a3 3 0 0 1-6 0z"/>', 1.8),
    temp: L('<path d="M10 13.8V5.2a2 2 0 0 1 4 0v8.6a3.6 3.6 0 1 1-4 0z"/><path d="M12 9.5v6"/>', 1.8),
    wind: L('<path d="M3 8.5h10.5A2.5 2.5 0 1 0 11 6M3 12.5h15a2.5 2.5 0 1 1-2.5 2.5M3 16.5h7"/>', 1.8),
    ok: L('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.2),
  };
  // Logic thời tiết (renderer/wx-logic.js, có test): tên, mức cảnh báo, mặc gì, lưu ý; đổi °C/°F theo Cài đặt
  const WXL = WxLogic.create({
    icons: { sun: WX.sun, rain: WX.rain, storm: WX.storm, fog: WX.fog, wear: TIP_ICON.wear, temp: TIP_ICON.temp, wind: TIP_ICON.wind, ok: TIP_ICON.ok },
    unit: () => S.prefs.tempUnit,
  });
  const { WX_NAME, VN_DOW, rnd, tU, wxDayName, wxDayLevel, wxTips } = WXL;

  function renderWeather() {
    const wrap = $('#wxWrap');
    if (!wrap) return;
    // Nhiều địa điểm: trang Thời tiết xem địa điểm đang chọn (mặc định là địa điểm chính), viên thuốc thu gọn luôn dùng địa điểm chính
    const all = (S.weather && S.weather.places) || [];
    const w = all.find((p) => p.id === S.wxPlace) || S.weather, D = w && Array.isArray(w.daily) ? w.daily.slice(0, 7) : [];
    if (!w || !D.length) {
      wrap.innerHTML = S.weather && S.weather.needLoc
        ? `<div class="empty wx-empty">${WX.cloud}<b>Không xác định được vị trí của bạn</b><span>Chọn một địa điểm để xem thời tiết.</span><button class="wx-pick" data-act="wx-pick">Chọn địa điểm</button></div>`
        : `<div class="empty wx-empty">${WX.cloud}<b>Chưa có dữ liệu thời tiết</b><span>Cần kết nối mạng. Notchy sẽ tự thử lại sau vài phút.</span></div>`;
    } else {
      const meta = [w.feels != null ? `Cảm giác ${rnd(tU(w.feels))}°` : '', w.hum != null ? `Ẩm ${rnd(w.hum)}%` : '', w.wind != null ? `Gió ${rnd(w.wind)} km/h` : ''].filter(Boolean).join(' · ');
      const now = `
        <div class="wx-now">
          <span class="wx-ic wxa">${wxIcon(w.code, w.day)}</span>
          <b class="wx-t">${rnd(tU(w.temp))}°</b>
          <div class="wx-cd"><b>${WX_NAME(w.code)}</b><span>Cao ${rnd(tU(w.hi))}° · Thấp ${rnd(tU(w.lo))}°</span><span>${meta}</span></div>
          <div class="wx-loc" data-act="wx-pick" title="Đổi / thêm địa điểm"><b>${esc(w.city || 'Vị trí của bạn')}</b><span>Cập nhật ${fmtClock(new Date(w.at))}</span></div>
        </div>`;
      const tips = wxTips(D).map((t) => `
        <div class="wx-tip lv-${t.lv}" title="${esc(t.title + '\n' + t.text)}"><span class="ti">${t.ico}</span>
          <div class="tx"><b>${esc(t.title)}</b><span>${esc(t.text)}</span></div></div>`);
      const week = D.map((d, i) => {
        const lv = wxDayLevel(d);
        const tip = [WX_NAME(d.code), `${rnd(tU(d.lo))}–${rnd(tU(d.hi))}°${S.prefs.tempUnit === 'F' ? 'F' : 'C'}`, d.pop != null ? `Khả năng mưa ${rnd(d.pop)}%` : '', d.rain ? `Lượng mưa ${d.rain.toFixed(1)} mm` : '', d.gust != null ? `Gió giật ${rnd(d.gust)} km/h` : '', d.uv != null ? `UV ${rnd(d.uv)}` : ''].filter(Boolean).join('\n');
        return `<div class="wx-d wxa ${i === 0 ? 'today' : ''} ${lv ? 'lv' + lv : ''}" title="${esc(tip)}">
          <span>${wxDayName(D, i)}</span>${wxIcon(d.code, true)}
          <b>${rnd(tU(d.hi))}°</b><small>${rnd(tU(d.lo))}°</small>
          <em class="${d.pop >= 20 ? '' : 'none'}">${rnd(d.pop)}%</em></div>`;
      }).join('');
      // Lưu ý đầu tiên (quan trọng nhất) luôn hiện; các lưu ý còn lại nằm trong .wx-more, mở ra khi phóng to
      const tl = tips;
      const btn = `<button class="cal-exp" data-act="wx-exp" id="wxExp" title="${S.wxOpen ? 'Thu gọn' : 'Xem đầy đủ'}">${S.wxOpen ? ICON.collapse : ICON.expand}</button>`;
      const WX_HERE = '<svg class="here" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11 21 3l-8 18-2-8z"/></svg>';
      // Hàng chọn địa điểm (từ 2 địa điểm) + nút thêm địa điểm (mở Cài đặt)
      const chips = all.length > 1 ? `<div class="wx-places">${all.map((p) => `<button class="wx-pl ${p.id === w.id ? 'on' : ''}" data-act="wx-place" data-id="${esc(p.id)}" title="${esc(p.name)}">${p.auto ? WX_HERE : ''}<span>${esc(p.name)}</span><b>${rnd(tU(p.temp))}°</b></button>`).join('')}<button class="wx-pl add" data-act="wx-pick" title="Thêm / sửa địa điểm">+</button></div>` : '';
      wrap.innerHTML = `${chips}${now}<div class="wx-tips">${tl[0] || ''}<div class="wx-more"><div>${tl.slice(1).join('')}</div></div></div>`
        + `<div class="wx-sec"><span>Dự báo 7 ngày</span>${btn}</div><div class="wx-week">${week}</div>`;
    }
    // Đo cả hai chế độ (tắt chuyển động trong lúc đo), rồi trả về chế độ đang chọn
    // Chip địa điểm đang xem luôn nằm trong vùng nhìn thấy
    const pl = wrap.querySelector('.wx-places'), on = pl && pl.querySelector('.wx-pl.on');
    if (on) pl.scrollLeft = Math.max(0, Math.min(on.offsetLeft - 8, on.offsetLeft + on.offsetWidth - pl.clientWidth + 40));
    wrap.classList.add('nt');
    wrap.classList.add('full'); wxHs.full = wrap.offsetHeight;
    wrap.classList.remove('full'); wxHs.compact = wrap.offsetHeight;
    wrap.classList.toggle('full', S.wxOpen);
    void wrap.offsetHeight;
    wrap.classList.remove('nt');
    wxH = S.wxOpen ? wxHs.full : wxHs.compact;
    applyLayout();
  }
  // Thu gọn / phóng to: chỉ đổi class, CSS lo phần chuyển động; viên thuốc co giãn theo chiều cao đã đo sẵn
  function toggleWx() {
    S.wxOpen = !S.wxOpen; store.set('wxOpen', S.wxOpen);
    const wrap = $('#wxWrap'), b = $('#wxExp');
    wrap.classList.toggle('full', S.wxOpen);
    if (b) { b.innerHTML = S.wxOpen ? ICON.collapse : ICON.expand; b.title = S.wxOpen ? 'Thu gọn' : 'Xem đầy đủ'; }
    wxH = S.wxOpen ? wxHs.full : wxHs.compact;
    applyLayout();
  }
  api.onWeather((w) => {
    S.weather = w || null;
    // Địa điểm đang xem bị xóa: quay về địa điểm chính
    if (S.wxPlace && !((w && w.places) || []).some((p) => p.id === S.wxPlace)) S.wxPlace = null;
    compactSig = ''; renderCompact(); renderWeather(); applyLayout();
  });
  api.weatherGet();

  /* ================= Thu gọn ================= */
  let compactSig = '';
  function renderCompact() {
    const now = new Date();
    const music = compactMusic(), extras = music;
    island.classList.toggle('playing', isPlaying()); // dùng cho vệt sáng khi ẩn
    compactEl.classList.toggle('extras', extras);
    compactEl.classList.toggle('music', music);
    const cc = $('#cCenter'), cl = $('#cLeft'), cr = $('#cRight');
    // Không phát gì: ngày (trái) · giờ (giữa) · thời tiết (phải)
    compactEl.classList.toggle('idle', !extras);
    if (!extras) {
      const clock = fmtClock(now);
      if (cc.textContent !== clock) cc.textContent = clock; // gọi mỗi giây: chỉ ghi khi đổi phút
      const w = wxFresh() ? S.weather : null;
      const date = `${VN_DOW[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}`;
      const sig = ['idle', date, w ? `${Math.round(w.temp)}|${w.code}|${w.day}` : ''].join('|');
      if (compactSig !== sig) {
        compactSig = sig;
        cl.innerHTML = `<span class="c-date">${date}</span>`;
        cr.innerHTML = w
          ? `<span class="c-wx" title="${esc([w.city, WX_NAME(w.code), w.hi != null ? `Cao ${Math.round(tU(w.hi))}° · Thấp ${Math.round(tU(w.lo))}°` : ''].filter(Boolean).join(' · '))}">${wxIcon(w.code, w.day)}<b>${Math.round(tU(w.temp))}°</b></span>`
          : '';
      }
      return;
    }
    const sig = [music, music ? (S.media.thumb || '').length : 0, isPlaying(), music ? S.media.title + S.media.artist : '', !!S.media.override].join('|');
    if (sig !== compactSig) {
      compactSig = sig;
      cl.innerHTML = '<div class="c-art" id="cArt"></div>';
      {
        const item = `<span class="mq-i"><b>${esc(S.media.title)}</b>${S.media.artist ? `<em>${esc(S.media.artist)}</em>` : ''}</span>`;
        cc.innerHTML = `<div class="c-mid"><div class="mq">${item}${item}</div></div>`;
        const mid = $('.c-mid', cc);
        mqFit(mid);
      }
      // Bên phải: sóng âm (thu gọn) và nút phát/tạm dừng (khi rê chuột) chồng lên nhau, đổi qua lại bằng CSS
      cr.innerHTML = `<canvas class="c-wave ${isPlaying() ? '' : 'idle'}" id="cWave"></canvas>`
          + `<button class="c-pp ${S.media.override ? 'locked' : ''}" data-act="m-play" aria-label="Phát/Tạm dừng">${isPlaying() ? ICON.pause : ICON.play}</button>`;
      waveCanvas('c', $('#cWave'));
      { const a = $('#cArt'); if (S.media.thumb) a.style.backgroundImage = `url("${S.media.thumb}")`; else a.innerHTML = ICON.music; }
    }
    syncWave();
  }

  // Chữ chạy liền mạch cho mọi độ dài tên. Mỗi bản sao được độn khoảng trống để rộng ít nhất MQ_MIN
  // (lớn hơn khung chữ cả lúc thu gọn ~260px lẫn lúc hover ~300px): chỗ nối vòng lặp luôn nằm ngoài khung.
  // Trước đây tên ngắn hơn khung làm chỗ nối lộ ra trong khung, trông như chữ bị giật rồi hiện lại.
  const MQ_MIN = 320, MQ_GAP = 44, MQ_SPEED = 32; // px, px, px/giây
  function mqFit(mid) {
    const mq = mid && mid.firstElementChild;
    if (!mq || !mq.isConnected) return;
    const items = [...mq.children];
    const run = isPlaying();
    mq.classList.toggle('run', run);
    if (!run) { items.forEach((it) => { it.style.paddingRight = ''; }); return; }
    const kids = items[0].children;
    const textW = kids[kids.length - 1].getBoundingClientRect().right - kids[0].getBoundingClientRect().left;
    const pad = Math.max(MQ_GAP, MQ_MIN - textW);
    items.forEach((it) => { it.style.paddingRight = pad + 'px'; });
    mq.style.setProperty('--dur', Math.max(6, (textW + pad) / MQ_SPEED).toFixed(1) + 's');
    // Dịch đúng từng 1px (steps) thay vì tính lại mỗi lần màn hình quét: màn 200 Hz trước đây phải ghép cửa sổ
    // 200 lần/giây chỉ để chữ nhích chưa tới 1px; giờ ~32 lần/giây, chữ vẫn trôi đều và sắc nét hơn.
    mq.style.setProperty('--steps', Math.max(1, Math.round(textW + pad)));
  }

  /* ----- Sóng âm thật: phân tích phổ âm thanh hệ thống (loopback) thành 4 dải tần ----- */
  async function waveStart() {
    if (wave.starting || wave.failed) return;
    wave.starting = true;
    try {
      if (!wave.stream) {
        wave.stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        wave.stream.getVideoTracks().forEach((t) => t.stop()); // chỉ cần âm thanh
        if (!wave.stream.getAudioTracks().length) throw new Error('không có luồng âm thanh');
        wave.ctx = new AudioContext({ latencyHint: 'playback' });
        wave.an = wave.ctx.createAnalyser();
        wave.an.fftSize = 1024;               // ~47 Hz mỗi ô ở 48 kHz
        wave.an.smoothingTimeConstant = 0.35;
        wave.an.minDecibels = -80; wave.an.maxDecibels = -18;
        wave.ctx.createMediaStreamSource(wave.stream).connect(wave.an); // không nối ra loa
        wave.data = new Uint8Array(wave.an.frequencyBinCount);
      }
      if (wave.ctx.state !== 'running') await wave.ctx.resume();
    } catch (e) {
      wave.failed = true; // không lấy được âm thanh: giữ các thanh đứng yên, không thử lại liên tục
      console.warn('wave:', e && e.message);
      waveRelease();
    }
    wave.starting = false;
    syncWave();
  }
  function waveRelease() {
    try { if (wave.stream) wave.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { if (wave.ctx) wave.ctx.close(); } catch (_) {}
    wave.stream = wave.ctx = wave.an = wave.data = null;
  }
  function syncWave() {
    const want = waveWanted();
    if (want) {
      clearTimeout(wave.stopTimer); wave.stopTimer = 0;
      if (!wave.ctx || wave.ctx.state !== 'running') { waveStart(); return; }
      if (!wave.raf) { wave.last = 0; wave.raf = setInterval(waveFrame, WAVE_FRAME_MS); }
    } else {
      if (wave.raf) { clearInterval(wave.raf); wave.raf = 0; }
      wave.lvl = [0, 0, 0, 0];
      Object.values(wave.slots).forEach((s) => waveDraw(s, [4, 4, 4, 4]));
      // Ngừng vẽ ngay; nhả hẳn luồng nếu không cần trong 30 giây. Không dùng ctx.suspend(): sau khi
      // resume, nguồn loopback chỉ trả về im lặng (đã gặp thực tế) nên lần sau phải lấy luồng mới.
      if (wave.stream && !wave.stopTimer) wave.stopTimer = setTimeout(() => { wave.stopTimer = 0; if (!waveWanted()) waveRelease(); }, 30000);
    }
  }
  // Vẽ ~30 lần/giây bằng hẹn giờ, KHÔNG dùng requestAnimationFrame: rAF chạy theo tần số quét (màn 200 Hz =
  // 200 lần/giây) và mỗi lần gọi đã bắt cả cửa sổ trong suốt chạy một nhịp vẽ, kể cả khi không vẽ gì.
  // 4 thanh nhỏ ở 30 lần/giây trông vẫn mượt (đã làm mượt theo thời gian).
  const WAVE_FRAME_MS = 1000 / 30;
  function waveFrame() {
    const ts = performance.now();
    const dt = wave.last ? Math.min(ts - wave.last, 100) : 33;
    wave.last = ts;
    const an = wave.an, d = wave.data;
    if (!an) return;
    an.getByteFrequencyData(d);
    const hz = wave.ctx.sampleRate / an.fftSize;
    const up = 1 - Math.exp(-dt / 25), down = 1 - Math.exp(-dt / 110); // lên nhanh (~25 ms), xuống êm (~110 ms)
    for (let i = 0; i < 4; i++) {
      const a = Math.max(1, Math.round(BANDS[i][0] / hz)), z = Math.min(d.length - 1, Math.round(BANDS[i][1] / hz));
      let s = 0;
      for (let k = a; k <= z; k++) s += d[k];
      const v = Math.min(1, (s / (z - a + 1) / 255) * BAND_GAIN[i]);
      const cur = wave.lvl[i];
      wave.lvl[i] = cur + (v - cur) * (v > cur ? up : down);
    }
    const s = waveSlot();
    if (s) waveDraw(s, wave.lvl.map((l) => 4 + l * 14));
  }
  // 4 thanh vẽ trên canvas nhỏ: không đụng tới style/layout của trang nên rẻ hơn nhiều so với đổi height của DOM.
  // Hai chỗ vẽ: 'c' ở viên thuốc thu gọn, 'm' ở bảng nhạc; mỗi lúc chỉ vẽ vào chỗ đang hiện.
  const WAVE_W = 19.5, WAVE_H = 18, BAR_W = 3, BAR_GAP = 2.5;
  // Đổi màu sóng âm (theo ảnh bìa) và vẽ lại ngay ở mọi chỗ vẽ
  function setWaveColor(c) {
    if (c === waveColor) return;
    waveColor = c;
    island.style.setProperty('--wave', c); // vệt sáng khi ẩn dùng chung màu
    Object.values(wave.slots).forEach((s) => {
      if (!s.g) return;
      s.g.fillStyle = c;
      const hs = s.hs ? s.hs.split(',').map(Number) : [4, 4, 4, 4];
      s.hs = '';
      waveDraw(s, hs);
    });
  }
  function waveCanvas(key, cv) {
    const s = wave.slots[key] = { cv, g: null, hs: '' };
    if (!cv) return;
    const r = window.devicePixelRatio || 1;
    cv.width = Math.ceil(WAVE_W * r); cv.height = Math.ceil(WAVE_H * r);
    s.g = cv.getContext('2d');
    s.g.setTransform(r, 0, 0, r, 0, 0);
    s.g.fillStyle = waveColor;
    waveDraw(s, [4, 4, 4, 4]);
  }
  function waveDraw(s, hs) {
    const g = s.g;
    if (!g || !s.cv.isConnected) return;
    const r = window.devicePixelRatio || 1;
    hs = hs.map((h) => Math.round(h * r * 2) / (r * 2)); // làm tròn nửa điểm ảnh thật
    const key = hs.join(',');
    if (key === s.hs) return; // không có gì đổi: không vẽ lại
    s.hs = key;
    g.clearRect(0, 0, WAVE_W, WAVE_H);
    g.beginPath();
    hs.forEach((h, i) => g.roundRect(i * (BAR_W + BAR_GAP), (WAVE_H - h) / 2, BAR_W, h, BAR_W / 2));
    g.fill();
  }

  /* ================= Hệ thống: CPU / RAM / GPU / Mạng ================= */
  // Main ghi nền liên tục (1 giờ gần nhất). Mở tab: nhận toàn bộ lịch sử (statsHist) rồi mỗi giây một mẫu (stats).
  // Biểu đồ vẽ theo thời gian thật của từng mẫu, chọn khoảng 1 phút / 10 phút / 1 giờ.
  const ST_KEEP = 3600 * 1000;
  const ST_RANGES = [[60, '1 phút'], [600, '10 phút'], [3600, '1 giờ']];
  const ST_TILES = [
    { k: 'cpu', name: 'CPU', color: '#64d2ff' },
    { k: 'ram', name: 'RAM', color: '#bf5af2' },
    { k: 'gpu', name: 'GPU', color: '#30d158' },
    { k: 'net', name: 'Mạng', color: '#ff9f0a' },
  ];
  const st = { want: false, range: [60, 600, 3600].includes(store.get('strange', 600)) ? store.get('strange', 600) : 600, h: null, last: null };
  function syncStats() {
    const want = !winOff && island.dataset.mode === 'open' && S.tab === 'sys';
    if (want === st.want) return;
    st.want = want;
    api.stats(want); // main gửi lại toàn bộ lịch sử khi mở
  }
  const fmtRate = (b) => (b == null ? '—' : b < 1048576 ? `${Math.round(b / 1024)} KB/s` : `${(b / 1048576).toFixed(b < 10485760 ? 1 : 0)} MB/s`);
  const fmtGB = (b, d) => (b / 1073741824).toFixed(d);
  function buildStats() {
    const g = $('#stGrid');
    if (g.childElementCount) return;
    g.innerHTML = `<div class="st-range">${ST_RANGES.map(([r, n]) => `<button data-act="st-range" data-r="${r}">${n}</button>`).join('')}</div>`
      + ST_TILES.map((t) => `
      <div class="st-tile" data-k="${t.k}" style="--c:${t.color}">
        <div class="st-name">${t.name}<span class="st-peak" id="st-${t.k}-p"></span></div>
        <div class="st-val" id="st-${t.k}-v">—</div>
        <div class="st-sub" id="st-${t.k}-s">&nbsp;</div>
        <canvas class="st-spark" id="st-${t.k}-c"></canvas>
      </div>`).join('');
    markRange();
  }
  function markRange() { $$('.st-range button').forEach((b) => b.classList.toggle('on', +b.dataset.r === st.range)); }
  // Điểm vẽ trong khoảng đang chọn. Nhiều mẫu hơn số cột điểm ảnh thì gộp theo cột, lấy giá trị CAO NHẤT
  // (để không mất các đỉnh tải). Hai mẫu cách nhau > 15 giây (app không chạy) thì ngắt nét.
  function sparkPoints(key, W, t0, span) {
    const h = st.h, out = [];
    let col = -1, cur = null;
    for (let i = 0; i < h.t.length; i++) {
      const t = h.t[i], v = h[key][i];
      if (t < t0 || v == null) continue;
      const c = Math.min(W - 1, Math.floor(((t - t0) / span) * W));
      if (c === col && cur) { if (v > cur.v) cur.v = v; cur.t = t; continue; }
      cur = { x: ((t - t0) / span) * W, v, t, gap: !!(out.length && t - out[out.length - 1].t > 15000) };
      out.push(cur); col = c;
    }
    return out;
  }
  function spark(k, key, color, t0, span, max) {
    const cv = $(`#st-${k}-c`);
    if (!cv) return;
    const r = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * r)) { cv.width = Math.round(W * r); cv.height = Math.round(H * r); }
    const g = cv.getContext('2d');
    g.setTransform(r, 0, 0, r, 0, 0);
    g.clearRect(0, 0, W, H);
    const pts = sparkPoints(key, Math.round(W), t0, span);
    if (pts.length < 2) return;
    const y = (v) => H - 1 - Math.min(1, v / max) * (H - 3);
    // Tách thành các đoạn liền (ngắt ở chỗ app không chạy)
    const segs = [];
    pts.forEach((p) => { if (!segs.length || p.gap) segs.push([]); segs[segs.length - 1].push(p); });
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '00');
    segs.forEach((s) => {
      if (s.length < 2) return;
      g.beginPath();
      s.forEach((p, i) => (i ? g.lineTo(p.x, y(p.v)) : g.moveTo(p.x, y(p.v))));
      g.strokeStyle = color; g.lineWidth = 1.5; g.lineJoin = 'round'; g.stroke();
      g.lineTo(s[s.length - 1].x, H); g.lineTo(s[0].x, H); g.closePath();
      g.fillStyle = grad; g.fill();
    });
  }
  function peakOf(key, t0) {
    const h = st.h; let m = null;
    for (let i = 0; i < h.t.length; i++) if (h.t[i] >= t0 && h[key][i] != null && (m == null || h[key][i] > m)) m = h[key][i];
    return m;
  }
  function drawStats() {
    if (!st.h || !st.h.t.length || !st.want) return;
    buildStats();
    const span = st.range * 1000, now = st.h.t[st.h.t.length - 1], t0 = now - span;
    const pc = (v) => (v == null ? '' : `đỉnh ${Math.round(v * 100)}%`);
    const netPeak = peakOf('down', t0);
    $('#st-cpu-p').textContent = pc(peakOf('cpu', t0));
    $('#st-ram-p').textContent = pc(peakOf('ram', t0));
    $('#st-gpu-p').textContent = pc(peakOf('gpu', t0));
    $('#st-net-p').textContent = netPeak == null ? '' : `đỉnh ${fmtRate(netPeak)}`;
    ST_TILES.forEach((t) => {
      const key = t.k === 'net' ? 'down' : t.k;
      spark(t.k, key, t.color, t0, span, t.k === 'net' ? Math.max(1048576, netPeak || 0) * 1.15 : 1); // thang mạng co giãn theo đỉnh
    });
  }
  function setTile(k, val, sub, hot) {
    const v = $(`#st-${k}-v`), s = $(`#st-${k}-s`);
    if (v.textContent !== val) v.textContent = val;
    if (s.textContent !== sub) s.textContent = sub;
    v.classList.toggle('hot', !!hot);
  }
  api.onStatsHist((h) => { if (h && h.t) { st.h = h; drawStats(); } });
  api.onStats((m) => {
    if (!m || !st.want) return;
    buildStats();
    // Thêm mẫu mới vào lịch sử (main gửi mẫu này sau khi đã gửi lịch sử)
    const h = st.h || (st.h = { t: [], cpu: [], ram: [], gpu: [], down: [], up: [] });
    const ram = m.ramTotal ? m.ramUsed / m.ramTotal : null, gp = m.gpu;
    if (!h.t.length || m.t > h.t[h.t.length - 1]) {
      h.t.push(m.t); h.cpu.push(m.cpu); h.ram.push(ram); h.gpu.push(gp ? gp.util / 100 : null); h.down.push(m.down); h.up.push(m.up);
      let cut = 0;
      while (cut < h.t.length && h.t[cut] < m.t - ST_KEEP) cut++;
      if (cut) Object.values(h).forEach((a) => a.splice(0, cut));
    }
    setTile('cpu', m.cpu == null ? '—' : Math.round(m.cpu * 100) + '%', `${m.cores} luồng`, m.cpu > 0.85);
    setTile('ram', ram == null ? '—' : Math.round(ram * 100) + '%', `${fmtGB(m.ramUsed, 1)} / ${fmtGB(m.ramTotal, 0)} GB`, ram > 0.85);
    if (gp) setTile('gpu', Math.round(gp.util) + '%', [gp.temp != null ? Math.round(gp.temp) + '°C' : '', `${(gp.memUsed / 1024).toFixed(1)}/${Math.round(gp.memTotal / 1024)} GB`, gp.power != null ? Math.round(gp.power) + ' W' : ''].filter(Boolean).join(' · '), gp.util > 85);
    else setTile('gpu', '—', 'Không đọc được GPU');
    setTile('net', '↓ ' + fmtRate(m.down), `↑ ${fmtRate(m.up)} · ${m.ping == null ? 'mất mạng?' : Math.round(m.ping) + ' ms'}`);
    drawStats();
  });

  /* ================= Lịch + ghi chú ================= */
  // Ngày lễ: [tên, lễ lớn (hiện ở "Ngày lễ sắp tới"), nghỉ lễ chính thức (vạch đỏ)]
  const HOL_SOLAR = {
    '1/1': ['Tết Dương lịch', 1, 1], '14/2': ['Valentine', 1, 0], '8/3': ['Quốc tế Phụ nữ', 1, 0],
    '30/4': ['Giải phóng miền Nam', 1, 1], '1/5': ['Quốc tế Lao động', 1, 1], '1/6': ['Quốc tế Thiếu nhi', 1, 0],
    '2/9': ['Quốc khánh', 1, 1], '20/10': ['Phụ nữ Việt Nam', 1, 0], '20/11': ['Nhà giáo Việt Nam', 1, 0],
    '24/12': ['Đêm Giáng sinh', 0, 0], '25/12': ['Giáng sinh', 1, 0],
  };
  const HOL_LUNAR = {
    '1/1': ['Tết Nguyên Đán', 1, 1], '2/1': ['Mùng 2 Tết', 0, 1], '3/1': ['Mùng 3 Tết', 0, 1],
    '15/1': ['Rằm tháng Giêng', 1, 0], '10/3': ['Giỗ Tổ Hùng Vương', 1, 1], '15/4': ['Phật Đản', 1, 0],
    '5/5': ['Tết Đoan Ngọ', 1, 0], '15/7': ['Vu Lan', 1, 0], '15/8': ['Tết Trung Thu', 1, 0], '23/12': ['Ông Táo chầu trời', 1, 0],
  };
  // Các ngày lễ của một ngày: [{ name, major, off, lunar }]
  function holidaysOf(d) {
    const l = lunarOf(d), out = [];
    const s = HOL_SOLAR[d.getDate() + '/' + (d.getMonth() + 1)];
    if (s) out.push({ name: s[0], major: !!s[1], off: !!s[2], lunar: false });
    const h = !l.leap && HOL_LUNAR[l.d + '/' + l.m];
    if (h) out.push({ name: h[0], major: !!h[1], off: !!h[2], lunar: true });
    return out;
  }
  const holidayOf = (d) => holidaysOf(d).map((h) => h.name).join(' · ');
  // Ngày lễ lớn trong 12 tháng tới (đổi lễ âm lịch ra dương lịch bằng cách quét từng ngày); tính lại mỗi ngày 1 lần
  let upcomingCache = { key: '', list: [] };
  function upcomingHolidays() {
    const t0 = today0(), key = ymd(t0);
    if (upcomingCache.key === key) return upcomingCache.list;
    const list = [];
    for (let i = 0; i < 400; i++) {
      const d = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + i);
      holidaysOf(d).forEach((h) => { if (h.major) list.push({ ...h, d, days: i }); });
    }
    upcomingCache = { key, list };
    return list;
  }
  const countdown = (n) => (n === 0 ? 'Hôm nay' : n === 1 ? 'Ngày mai' : `còn ${n} ngày`);
  const saveNotes = () => store.set('notes', S.notes);
  const notesOf = (d) => S.notes[ymd(d)] || [];
  function weekStart(d) { const o = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - o); }
  // Chấm dưới số ngày: đỏ = nghỉ lễ chính thức, xanh tím = ngày lễ khác, cam = có ghi chú
  const dotsOf = (d) => {
    const hs = holidaysOf(d), n = notesOf(d).length;
    return (hs.length ? `<i class="${hs.some((h) => h.off) ? 'hol' : 'hol2'}"></i>` : '') + (n ? '<i></i>' : '');
  };
  // ----- Hiệu ứng chuyển cảnh (chỉ transform + opacity, Web Animations; tắt nếu hệ thống giảm chuyển động) -----
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const EASE = 'cubic-bezier(.2, .8, .2, 1)';
  function anim(el, frames, ms = 280) {
    if (!el || reduceMotion.matches) return;
    try { el.animate(frames, { duration: ms, easing: EASE }); } catch (_) {}
  }
  const fadeUp = (el, dy = 5, ms = 260) => anim(el, [{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'none' }], ms);
  // Đổi chữ có hiệu ứng mờ dần (chỉ khi chữ thực sự đổi)
  function setTextAnim(el, text) {
    if (!el || el.textContent === text) return;
    el.textContent = text;
    fadeUp(el, 4, 240);
  }
  const lunarLabel = (l) => (l.d === 1 ? `${l.d}/${l.m}` : String(l.d)); // mùng 1 ghi cả tháng âm

  // Trạng thái lần vẽ trước: chỉ dựng lại khi đổi tuần / tháng / chế độ; chọn ngày khác thì chỉ đổi class
  let calLast = { key: '', mode: null, anchor: 0, sel: 0 };
  function cellClass(d, base, t0, sel, other) {
    return [base, other ? 'other' : '', d.getTime() === t0.getTime() ? 'today' : '', d.getTime() === sel.getTime() ? 'sel' : '',
      holidaysOf(d).some((h) => h.off) ? 'off' : '', d.getDay() === 0 || d.getDay() === 6 ? 'we' : ''].filter(Boolean).join(' ');
  }
  function renderCalendar() {
    const t0 = today0(), sel = S.sel, month = S.calMonth;
    const ws = weekStart(sel);
    const anchor = month ? new Date(sel.getFullYear(), sel.getMonth(), 1).getTime() : ws.getTime();
    const key = (month ? 'm' : 'w') + anchor + '|' + ymd(t0);
    setTextAnim($('#calTitle'), `Tháng ${sel.getMonth() + 1} năm ${sel.getFullYear()}`);
    $('#calExp').innerHTML = month ? ICON.collapse : ICON.expand;
    $('#calPrev').innerHTML = month ? ICON.up : ICON.left;
    $('#calNext').innerHTML = month ? ICON.down : ICON.right;
    const tb = $('#calTodayBtn'), showToday = sel.getTime() !== t0.getTime();
    if (showToday !== tb.classList.contains('show')) { tb.classList.toggle('show', showToday); if (showToday) anim(tb, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], 220); }
    $('.view[data-view="calendar"]').classList.toggle('month', month);

    const body = $('#calBody');
    if (key !== calLast.key) {
      // Dựng lại: đổi tuần / tháng / chế độ
      if (!month) {
        const days = Array.from({ length: 7 }, (_, i) => new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i));
        body.innerHTML = '<div class="cw">' + days.map((d) => {
          const l = lunarOf(d);
          return `<div class="${cellClass(d, 'cw-d', t0, sel)}" data-act="cal-pick" data-ts="${d.getTime()}">
            <span>${WD_SHORT[d.getDay()]}</span><b>${d.getDate()}</b><small class="lu ${l.d === 1 ? 'first' : ''}">${lunarLabel(l)}</small><em>${dotsOf(d)}</em>
          </div>`;
        }).join('') + '</div>';
      } else {
        const first = new Date(sel.getFullYear(), sel.getMonth(), 1), offset = (first.getDay() + 6) % 7;
        const rows = Math.ceil((offset + new Date(sel.getFullYear(), sel.getMonth() + 1, 0).getDate()) / 7);
        let cells = '';
        for (let i = 0; i < rows * 7; i++) {
          const d = new Date(first.getFullYear(), first.getMonth(), 1 - offset + i), l = lunarOf(d), hn = holidayOf(d);
          cells += `<div class="${cellClass(d, 'cm-d', t0, sel, d.getMonth() !== sel.getMonth())}" data-act="cal-pick" data-ts="${d.getTime()}" title="Âm lịch ${l.d}/${l.m}${l.leap ? ' nhuận' : ''}${hn ? ' · ' + esc(hn) : ''}"><b>${d.getDate()}</b><small class="lu ${l.d === 1 ? 'first' : ''}">${lunarLabel(l)}</small><em>${dotsOf(d)}</em></div>`;
        }
        const wd = MON_FIRST.map((d) => `<span class="${d === 0 || d === 6 ? 'we' : ''}">${WD_SHORT[d]}</span>`).join('');
        body.innerHTML = `<div class="cm"><div class="cm-left"><div class="cm-wd">${wd}</div><div class="cm-grid">${cells}</div></div><div class="cm-right" id="cmRight"></div></div>`;
      }
      // Hiệu ứng: đổi chế độ -> mờ chéo + phóng nhẹ; đổi tuần -> trượt ngang; đổi tháng -> trượt dọc (theo hướng)
      const dir = anchor > calLast.anchor ? 1 : -1;
      if (calLast.mode !== null && calLast.mode !== month) anim(body, [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], 320);
      else if (calLast.mode === month && !month) anim($('.cw', body), [{ opacity: 0, transform: `translateX(${dir * 28}px)` }, { opacity: 1, transform: 'none' }], 300);
      else if (calLast.mode === month && month) anim($('.cm-grid', body), [{ opacity: 0, transform: `translateY(${dir * 18}px)` }, { opacity: 1, transform: 'none' }], 300);
    } else {
      // Cùng tuần/tháng: chỉ đổi class (nền ô chuyển màu bằng CSS transition) và chấm sự kiện
      $$('.cw-d, .cm-d', body).forEach((c) => { // chỉ ô ngày (không đụng danh sách ngày lễ bên phải)
        const d = new Date(Number(c.dataset.ts));
        c.classList.toggle('sel', d.getTime() === sel.getTime());
        c.classList.toggle('today', d.getTime() === t0.getTime());
        const em = $('em', c), dots = dotsOf(d);
        if (em && em.innerHTML !== dots) em.innerHTML = dots;
      });
    }
    const selChanged = sel.getTime() !== calLast.sel;
    calLast = { key, mode: month, anchor, sel: sel.getTime() };

    if (!month) {
      const l = lunarOf(sel);
      const head = `<div>${WD_FULL[sel.getDay()]}, ${sel.getDate()} tháng ${sel.getMonth() + 1}</div><span>Âm lịch ${l.d}/${l.m}${l.leap ? ' nhuận' : ''} · ${window.Lunar.canChi(l.y)}</span>`;
      const dh = $('#dtHead');
      if (dh.innerHTML !== head) { dh.innerHTML = head; if (selChanged) fadeUp(dh); }
      renderNotes(selChanged);
    } else renderCalRight(selChanged);
  }
  // Bên phải chế độ tháng: ngày đang chọn (dương + âm lịch, sự kiện) rồi ngày lễ lớn sắp tới
  function renderCalRight(selChanged) {
    const box = $('#cmRight');
    if (!box) return;
    const sel = S.sel, l = lunarOf(sel);
    const items = [...holidaysOf(sel).map((h) => ({ t: h.name, s: h.lunar ? 'Lễ âm lịch' : 'Ngày lễ', c: h.off ? 'red' : 'blue' })),
      ...notesOf(sel).map((n) => ({ t: n.t, s: n.at || 'Ghi chú', c: 'orange' }))];
    const selHtml = `<div class="cm-sel"><div class="cm-sec">${WD_SHORT[sel.getDay()]} ${sel.getDate()}/${sel.getMonth() + 1}<span>Âm lịch ${l.d}/${l.m}${l.leap ? ' nhuận' : ''} · ${window.Lunar.canChi(l.y)}</span></div>`
      + items.map((x) => `<div class="hl ${x.c} static"><div class="hl-t"><b>${esc(x.t)}</b><span>${esc(x.s)}</span></div></div>`).join('') + '</div>';
    const up = upcomingHolidays().map((h) => `
      <div class="hl ${h.off ? 'red' : 'blue'}" data-act="cal-pick" data-ts="${h.d.getTime()}">
        <div class="hl-t"><b>${esc(h.name)}</b><span class="hl-sub"><span>${h.d.getDate()}/${h.d.getMonth() + 1} · ${WD_SHORT[h.d.getDay()]}${h.lunar ? ' · âm' : ''}</span><em class="${h.days <= 7 ? 'soon' : ''}">${countdown(h.days)}</em></span></div>
      </div>`).join('');
    const upHtml = `<div class="cm-sec">Ngày lễ sắp tới</div>${up}`;
    // Danh sách ngày lễ giữ nguyên (không nháy, giữ vị trí cuộn); chỉ thay phần ngày đang chọn
    let selBox = $('.cm-sel', box);
    if (!selBox || !box.dataset.up || box.dataset.up !== ymd(today0())) {
      box.innerHTML = selHtml + upHtml;
      box.dataset.up = ymd(today0());
      selBox = $('.cm-sel', box);
    } else if (selBox.outerHTML !== selHtml) {
      selBox.outerHTML = selHtml;
      selBox = $('.cm-sel', box);
    }
    if (selChanged) fadeUp(selBox);
  }
  // Sự kiện của ngày đang chọn (chế độ tuần): thẻ có vạch màu bên trái
  function renderNotes(animate) {
    const sel = S.sel, when = `${WD_FULL[sel.getDay()]}, ${sel.getDate()} tháng ${sel.getMonth() + 1}`;
    const hol = holidaysOf(sel).map((h) => `<div class="ev ${h.off ? 'red' : 'blue'}"><div class="ev-t"><b>${esc(h.name)}</b><span>${h.lunar ? 'Lễ âm lịch' : 'Ngày lễ'}</span></div></div>`).join('');
    const notes = notesOf(sel).map((n) => `<div class="ev orange"><div class="ev-t"><b>${esc(n.t)}</b><span>${n.at ? n.at + ' · ' : ''}${when}</span></div><button data-act="note-del" data-id="${n.id}" aria-label="Xóa">${ICON.x}</button></div>`).join('');
    const box = $('#notes'), html = hol + notes;
    if (box.innerHTML === html) return;
    box.innerHTML = html;
    // Thẻ hiện lần lượt (so le 40 ms)
    if (animate !== false) $$('.ev', box).forEach((e, i) => anim(e, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], 260 + i * 40));
  }
  // Số sự kiện hiện ở chế độ tuần (để tính chiều cao bảng)
  const calEvents = () => holidaysOf(S.sel).length + notesOf(S.sel).length;
  function addNote() {
    const inp = $('#noteIn'), at = $('#noteAt');
    const t = inp.value.trim();
    if (!t) return;
    const key = ymd(S.sel);
    (S.notes[key] = S.notes[key] || []).push({ id: 'n' + Date.now().toString(36), t, at: at.value || '' });
    S.notes[key].sort((a, b) => (a.at || '99:99').localeCompare(b.at || '99:99'));
    saveNotes();
    inp.value = ''; at.value = '';
    renderCalendar();
  }

  /* ================= Bảng tạm ================= */
  api.onClip((list) => { S.clip = Array.isArray(list) ? list : []; renderClip(); });
  const clipType = (t) => { const s = t.trim(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? 'mail' : /^(https?:\/\/|www\.)\S+$/i.test(s) ? 'link' : 'text'; };
  function renderClip() {
    const q = S.clipQ.trim().toLowerCase();
    const items = S.clip.filter((x) => !q || x.text.toLowerCase().includes(q));
    const short = (t) => esc(t.replace(/\s+/g, ' ').trim().slice(0, 160));
    $('#clipPins').innerHTML = items.filter((x) => x.pin).slice(0, 6).map((x) => `<button class="pin-chip" data-act="clip-copy" data-id="${x.id}"><span>${short(x.text)}</span></button>`).join('');
    const list = $('#clipList');
    // Tạm dừng ghi: dải báo trên đầu danh sách + nút bật lại
    const paused = S.prefs.clipPaused ? `<div class="clip-paused"><span>Đang tạm dừng ghi bảng tạm</span><button data-act="clip-pause">Bật lại</button></div>` : '';
    $('#clipPauseBtn').classList.toggle('on', !!S.prefs.clipPaused);
    $('#clipPauseBtn').title = S.prefs.clipPaused ? 'Bật lại ghi bảng tạm' : 'Tạm dừng ghi bảng tạm';
    if (!items.length) list.innerHTML = paused + `<div class="clip-empty">${q ? 'Không có kết quả' : 'Chưa có gì. Hãy sao chép một đoạn văn bản bất kỳ.'}</div>`;
    else {
    const tyIcon = { mail: ICON.mail, link: ICON.link, text: ICON.note };
    list.innerHTML = paused + items.map((x) => { const ty = clipType(x.text); return `
      <div class="c-item" data-act="clip-copy" data-id="${x.id}">
        <span class="ty ${ty}">${tyIcon[ty]}</span><span class="tx">${short(x.text)}</span>
        <span class="acts"><button class="${x.pin ? 'on' : ''}" data-act="clip-pin" data-id="${x.id}" title="Ghim">${x.pin ? ICON.bookmarkF : ICON.bookmark}</button><button data-act="clip-del" data-id="${x.id}" title="Xóa">${ICON.x}</button></span>
      </div>`; }).join('');
    }
    markClipSel();
    const h = list.offsetTop + list.offsetHeight;
    if (h > 0 && h !== clipH) { clipH = h; applyLayout(); }
  }
  // Chọn bằng bàn phím trong ô tìm kiếm: ↑/↓ di chuyển, Enter chép mục đang chọn (mặc định mục đầu tiên)
  let clipSel = 0;
  function markClipSel() {
    const items = $$('#clipList .c-item');
    clipSel = clamp(clipSel, 0, Math.max(0, items.length - 1));
    const kb = S.typing && document.activeElement && document.activeElement.id === 'clipQ';
    items.forEach((it, i) => it.classList.toggle('kb', kb && i === clipSel));
    const it = kb && items[clipSel], list = $('#clipList');
    if (it) { // tự cuộn (không dùng scrollIntoView: nó cuộn cả các khung cha overflow:hidden)
      if (it.offsetTop < list.scrollTop) list.scrollTop = it.offsetTop;
      else if (it.offsetTop + it.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = it.offsetTop + it.offsetHeight - list.clientHeight;
    }
  }

  /* ================= Kệ tạm (kéo thả tệp) ================= */
  api.onShelf((list) => { S.shelf = Array.isArray(list) ? list : []; renderShelf(); });
  function renderShelf() {
    const el = $('#shelfList');
    if (!el) return;
    const fmtSize = (b) => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
    const total = S.shelf.reduce((a, x) => a + (x.size || 0), 0);
    $('#shelfMeta').textContent = S.shelf.length ? `${S.shelf.length} · ${fmtSize(total)}` : '';
    const exp = $('#shelfExp');
    exp.style.display = S.shelf.length > 3 ? '' : 'none'; // ít tệp thì một hàng là đủ
    exp.innerHTML = S.shelfOpen ? ICON.collapse : ICON.expand;
    exp.title = S.shelfOpen ? 'Thu gọn thành một hàng' : 'Mở rộng thành lưới';
    el.classList.toggle('grid', shelfGrid());
    if (!S.shelf.length) {
      el.innerHTML = `<div class="shelf-drop">${ICON.shelf}<b>Kéo tệp vào đây để giữ tạm</b><span>Cần dùng thì kéo từ đây thả sang ứng dụng khác. Kệ chỉ nhớ đường dẫn, không sao chép hay xóa tệp thật.</span></div>`;
      return;
    }
    el.innerHTML = S.shelf.map((x) => `
      <div class="sh-item ${x.thumb ? 'has-th' : ''}" draggable="true" data-act="shelf-open" data-id="${esc(x.id)}" title="${esc(x.name)}&#10;${esc(x.dir)}">
        ${x.thumb ? `<img class="th" src="${esc(x.thumb)}" alt="" />` : x.icon ? `<img src="${esc(x.icon)}" alt="" />` : `<span class="fi">${ICON.file}</span>`}
        ${x.thumb ? '' : `<span class="nm">${esc(x.name)}</span>`}
        <button class="rm" data-act="shelf-del" data-id="${esc(x.id)}" aria-label="Bỏ khỏi kệ">${ICON.x}</button>
      </div>`).join('');
    el.scrollLeft = 0; updateChipFade(el);
  }
  const hasFiles = (ev) => !!(ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files'));
  let dragDepth = 0;
  const endDropUi = () => { dragDepth = 0; document.body.classList.remove('dropping'); };
  document.addEventListener('dragenter', (ev) => {
    if (!hasFiles(ev)) return;
    ev.preventDefault();
    dragDepth++;
    document.body.classList.add('dropping');
    if (S.tab !== 'shelf') setTab('shelf');
    // Kéo tệp tới: ý định đã rõ, không chờ. Đang phát nhạc thì rê vào chỉ phóng to: mở hẳn bảng để thả vào Kệ tạm
    if (S.hoverRaw && !S.hover) enterHover();
    if (!S.open) { S.open = true; applyLayout(); }
  });
  document.addEventListener('dragover', (ev) => { if (!hasFiles(ev)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; });
  document.addEventListener('dragleave', (ev) => { if (!hasFiles(ev)) return; if (--dragDepth <= 0) endDropUi(); });
  document.addEventListener('drop', (ev) => {
    if (!hasFiles(ev)) return;
    ev.preventDefault();
    endDropUi();
    const paths = Array.from(ev.dataTransfer.files || []).map((f) => api.pathOf(f)).filter(Boolean);
    if (paths.length) api.shelfAdd(paths);
  });
  // Kéo từ kệ ra ngoài: giao cho tiến trình chính khởi động kéo thả của hệ điều hành
  document.addEventListener('dragstart', (ev) => {
    const it = ev.target.closest && ev.target.closest('.sh-item');
    if (!it) return;
    ev.preventDefault();
    api.shelfDrag(it.dataset.id);
  });

  /* ================= Thông báo ngắn (sạc, pin yếu, tải xong, tai nghe) ================= */
  // Hàng đợi: thông báo đến khi đang hiện thông báo khác / đang đổ chuông / đang rê chuột trên bảng thì chờ
  // tới lượt (trước đây cái mới đè mất cái cũ, vd. chụp 2 ảnh liền nhau). Huy hiệu "+N" cho biết còn bao nhiêu.
  let noticeTimer = null;
  const noticeQueue = [];
  const NOTICE_MAX_Q = 5, NOTICE_MS = 4000, NOTICE_MS_BUSY = 2800; // còn hàng chờ thì mỗi cái hiện ngắn hơn
  const NOTICE_ICON = { charge: [ICON.bolt, '#30d158'], low: [ICON.battery, '#ff453a'], download: [ICON.download, '#0a84ff'], device: [ICON.headphones, '#ffffff'], shot: [ICON.shelf, '#bf5af2'], update: [ICON.download, '#30d158'], snooze: [ICON.bell, '#ff9f0a'] };
  const noticeKey = (n) => n.kind + '|' + (n.title || '') + '|' + (n.sub || '');
  function showNotice(n) {
    if (!n) return;
    // Loại thông báo bị tắt trong Cài đặt (sạc / pin yếu chung nhóm "pin")
    const group = n.kind === 'charge' || n.kind === 'low' ? 'battery' : n.kind;
    if (S.prefs.notify && S.prefs.notify[group] === false) return;
    if (S.ring || S.notice || S.hoverRaw) {
      const k = noticeKey(n);
      if ((S.notice && noticeKey(S.notice) === k) || noticeQueue.some((x) => noticeKey(x) === k)) return; // trùng
      noticeQueue.push(n);
      if (noticeQueue.length > NOTICE_MAX_Q) noticeQueue.shift(); // giữ các thông báo mới nhất
      renderNoticeMore();
      return;
    }
    displayNotice(n);
  }
  function renderNoticeMore() { $('#nMore').textContent = noticeQueue.length ? '+' + noticeQueue.length : ''; }
  function displayNotice(n) {
    const [ic, col] = NOTICE_ICON[n.kind] || NOTICE_ICON.device;
    // Ảnh chụp màn hình: hiện luôn ảnh thu nhỏ thay cho biểu tượng
    $('#nIcon').innerHTML = n.thumb && /^data:image\//.test(n.thumb) ? `<img src="${esc(n.thumb)}" alt="" />` : ic;
    $('#nIcon').style.setProperty('--nc', col);
    $('#nTitle').textContent = n.title || '';
    $('#nSub').textContent = n.sub || '';
    $('#noticeView').classList.toggle('act', n.kind === 'shot');
    renderNoticeMore();
    S.notice = n;
    api.notice();
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(endNotice, noticeQueue.length ? NOTICE_MS_BUSY : NOTICE_MS);
    applyLayout();
  }
  function endNotice() {
    clearTimeout(noticeTimer);
    S.notice = null;
    // Đang rê chuột / đổ chuông: giữ hàng chờ, hiện tiếp khi viên thuốc thu gọn lại (nextNotice)
    if (noticeQueue.length && !S.ring && !S.hoverRaw) { displayNotice(noticeQueue.shift()); return; }
    applyLayout();
  }
  function nextNotice() { if (!S.notice && !S.ring && !S.hoverRaw && noticeQueue.length) displayNotice(noticeQueue.shift()); }
  api.onToast((t) => showNotice(t));

  // Pin: báo khi cắm sạc, pin yếu (20%, 10%)
  (function watchBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then((b) => {
      let lastCharging = b.charging, warned = 100;
      const pct = () => Math.round(b.level * 100);
      // Chạy pin: bỏ blur ở các chuyển cảnh lớn (CSS .lite). Máy bàn không có pin luôn báo đang sạc -> không đổi gì.
      const lite = () => document.documentElement.classList.toggle('lite', !b.charging);
      lite();
      b.addEventListener('chargingchange', () => {
        lite();
        if (b.charging && !lastCharging) { showNotice({ kind: 'charge', title: 'Đang sạc', sub: `Pin ${pct()}%` }); warned = 100; }
        lastCharging = b.charging;
      });
      b.addEventListener('levelchange', () => {
        const p = pct();
        if (b.charging) { warned = 100; return; }
        if (p <= 10 && warned > 10) { warned = 10; showNotice({ kind: 'low', title: 'Pin sắp hết', sub: `Còn ${p}%, hãy cắm sạc` }); }
        else if (p <= 20 && warned > 20) { warned = 20; showNotice({ kind: 'low', title: 'Pin yếu', sub: `Còn ${p}%` }); }
        else if (p > 25) warned = 100;
      });
    }).catch(() => {});
  })();

  // Thiết bị âm thanh mới (tai nghe, loa Bluetooth...): so sánh danh sách thiết bị định kỳ
  let knownDevs = null, devPoll = 0;
  function diffDevices(list) {
    if (!Array.isArray(list) || !list.length) return;
    const ids = new Set(list.map((d) => d.id));
    if (knownDevs) {
      const fresh = list.filter((d) => !knownDevs.has(d.id));
      if (fresh.length) showNotice({ kind: 'device', title: 'Đã kết nối', sub: fresh[0].name });
    }
    knownDevs = ids;
  }

  /* ================= Chuông báo ================= */
  let audioCtx = null, soundIv = null, ringTimeout = null;
  function beepBurst() {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < 4; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = i % 2 ? 1175 : 988;
      const t = t0 + i * 0.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t); o.stop(t + 0.18);
    }
  }
  function startSound() {
    stopSound();
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (_) { return; }
    beepBurst();
    soundIv = setInterval(beepBurst, 1500);
  }
  function stopSound() { clearInterval(soundIv); soundIv = null; }
  function startRing(r) {
    S.ring = r;
    $('#ringTitle').textContent = r.title;
    $('#ringSub').textContent = r.sub || '';
    $('#ringIcon').innerHTML = ICON.bell;
    clearTimeout(ringTimeout);
    ringTimeout = setTimeout(() => stopRing(), 60000);
    api.alert(true);
    startSound();
    applyLayout();
  }
  function stopRing() {
    S.ring = null;
    clearTimeout(ringTimeout);
    stopSound();
    api.alert(false);
    applyLayout();
    nextNotice(); // thông báo ngắn bị giữ lại trong lúc đổ chuông: hiện tiếp
  }
  // Báo lại: lưu vào localStorage (tắt app / máy ngủ vẫn nhớ), checkNotes() đổ chuông lại khi tới giờ
  const SNOOZE_MIN = 5;
  S.snooze = store.get('snooze', []).filter((x) => x && x.at > Date.now() - 3600000);
  function snoozeRing() {
    const r = S.ring;
    if (!r) return;
    const at = Date.now() + SNOOZE_MIN * 60000;
    S.snooze.push({ at, title: r.title, sub: r.orig || r.sub || '' });
    store.set('snooze', S.snooze);
    // Xác nhận hiện ngay sau khi tắt chuông (trước các thông báo đang chờ)
    noticeQueue.unshift({ kind: 'snooze', title: 'Sẽ nhắc lại lúc ' + fmtClock(new Date(at)), sub: r.title });
    stopRing();
  }
  function checkSnooze() {
    if (!S.snooze.length || S.ring) return;
    const now = Date.now(), due = S.snooze.find((x) => x.at <= now);
    if (!due) return;
    S.snooze = S.snooze.filter((x) => x !== due);
    store.set('snooze', S.snooze);
    // Máy ngủ / tắt app quá giờ báo lại: vẫn nhắc (ghi "trễ") để không mất việc
    startRing({ kind: 'note', title: due.title, sub: (now - due.at > 120000 ? 'Báo lại (trễ) · ' : 'Báo lại · ') + due.sub, orig: due.sub });
  }

  /* ================= Nhắc ghi chú theo giờ (có bù khi máy ngủ dậy) ================= */
  let lastTick = Date.now();
  function checkNotes() {
    const now = Date.now();
    let from = Math.floor(lastTick / 60000) + 1;
    const to = Math.floor(now / 60000);
    if (to - from > 15) from = to - 15;
    for (let mn = from; mn <= to; mn++) {
      const d = new Date(mn * 60000), hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      for (const n of S.notes[ymd(d)] || []) if (n.at === hhmm) startRing({ kind: 'note', title: n.t, sub: 'Ghi chú · ' + hhmm });
    }
    lastTick = now;
  }

  /* ================= Vòng lặp chính ================= */
  let lastSec = -1;
  function tick() {
    const now = new Date();
    // Thanh tiến trình chỉ cập nhật khi bảng nhạc đang hiện (đóng bảng thì không có gì để vẽ)
    if (S.tab === 'music' && island.dataset.mode === 'open' && !winOff && !(S.drag && S.drag.k === 'seek')) updateProgress();
    if (now.getSeconds() !== lastSec) {
      lastSec = now.getSeconds();
      checkNotes(); checkSnooze(); renderCompact(); renderTopDate();
      if (S.hover || S.peek) requestSys();
      if (Date.now() - devPoll > 8000) { devPoll = Date.now(); api.sys('devices'); }
      applyLayout();
    }
  }
  function renderAll() {
    renderMusic(); renderCalendar(); renderWeather(); renderClip(); renderShelf(); renderCompact(); renderVol();
  }

  /* ================= Kéo thả (tua nhạc, âm lượng) ================= */
  let drag = null;
  const frac = (el, ev) => { const r = el.getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width, 0, 1); };
  function beginDrag(d, ev) {
    drag = d; S.drag = d.k === 'seek' ? d : null;
    try { d.el.setPointerCapture(ev.pointerId); } catch (_) {}
    api.hold(true);
    moveDrag(ev);
  }
  function moveDrag(ev) {
    const d = drag; if (!d) return;
    if (d.k === 'seek') { d.sec = frac(d.el, ev) * S.media.dur; updateProgress(); }
    else if (d.k === 'vol2') setVol(frac(d.el, ev));
  }
  function endDrag() {
    const d = drag; if (!d) return;
    drag = null; S.drag = null;
    api.hold(false);
    if (d.k === 'seek') {
      const sec = d.sec == null ? curPos() : d.sec;
      S.media.pos = sec; S.media.base = Date.now(); S.media.seekAt = Date.now();
      api.media('seek:' + sec.toFixed(1));
    }
    if (!S.hoverRaw) collapseSoon(500);
  }
  document.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const t = ev.target;
    let el;
    if ((el = t.closest('#mBar'))) { if (hasMusic() && S.media.dur > 0 && !S.media.override) beginDrag({ k: 'seek', el, sec: null }, ev); return; }
    if ((el = t.closest('.bar[data-vol]'))) { beginDrag({ k: 'vol2', el }, ev); return; }
  });
  document.addEventListener('pointermove', (ev) => { if (drag) moveDrag(ev); });
  ['pointerup', 'pointercancel'].forEach((e) => document.addEventListener(e, endDrag));

  /* ================= Sự kiện bấm ================= */
  function act(a, el) {
    const m = S.media;
    switch (a) {
      // Nhạc
      case 'm-play': if (m.override) break; if (m.status === 'Playing') lastPlayingAt = Date.now(); m.pos = curPos(); m.base = Date.now(); m.status = m.status === 'Playing' ? 'Paused' : 'Playing'; m.cmdAt = Date.now(); api.media('play_pause'); musicSig = ''; renderMusic(); renderCompact(); break;
      case 'm-focus': api.media('focus'); break;
      case 'st-range': st.range = +el.dataset.r; store.set('strange', st.range); markRange(); drawStats(); break;
      // Bấm ngay khi vừa chạm (chưa hết thời gian chờ ý định): bấm là ý định rõ ràng, mở luôn
      case 'c-open': if (!S.hover && S.hoverRaw) enterHover(); if (S.hover) { S.open = true; applyLayout(); requestSys(); } break;
      case 'm-next': if (!m.override) api.media('next'); break;
      case 'm-prev': if (!m.override) api.media('prev'); break;
      case 'm-shuffle': if (m.override) break; m.shuffle = !m.shuffle; api.media('shuffle'); musicSig = ''; renderMusic(); break;
      case 'm-out':
        S.outOpen = !S.outOpen; musicSig = ''; renderMusic(); applyLayout(); requestSys(true);
        // Mở ra thì cuộn để thấy thiết bị đang dùng
        // (tự tính thay vì scrollIntoView: cái đó có thể cuộn cả các khung cha overflow:hidden)
        if (S.outOpen) {
          const c = $('.out-chips'), on = c && $('.out-chip.on', c);
          if (on) { const cr = c.getBoundingClientRect(), r = on.getBoundingClientRect(); c.scrollLeft += (r.left + r.width / 2) - (cr.left + cr.width / 2); }
        }
        break;
      case 'dev': api.sys('dev:' + el.dataset.id); S.sys.devices.forEach((d) => { d.def = d.id === el.dataset.id; }); renderOut(); break;
      case 'open-sound': api.openSound(); break;
      case 'open-settings': api.openSettings(''); break;
      // Nước
      // Lịch
      case 'cal-prev': case 'cal-next': {
        const dir = a === 'cal-next' ? 1 : -1;
        if (!S.calMonth) S.sel = new Date(S.sel.getFullYear(), S.sel.getMonth(), S.sel.getDate() + 7 * dir);
        else { const n = new Date(S.sel.getFullYear(), S.sel.getMonth() + dir, 1), t0 = today0(); S.sel = (n.getFullYear() === t0.getFullYear() && n.getMonth() === t0.getMonth()) ? t0 : n; }
        renderCalendar(); break;
      }
      case 'cal-today': S.sel = today0(); renderCalendar(); break;
      case 'cal-toggle': S.calMonth = !S.calMonth; store.set('calMonth', S.calMonth); renderCalendar(); applyLayout(); break;
      case 'cal-pick': { const d = new Date(Number(el.dataset.ts)); S.sel = new Date(d.getFullYear(), d.getMonth(), d.getDate()); renderCalendar(); break; }
      case 'note-add': addNote(); break;
      case 'note-del': { const k = ymd(S.sel); S.notes[k] = (S.notes[k] || []).filter((x) => x.id !== el.dataset.id); if (!S.notes[k].length) delete S.notes[k]; saveNotes(); renderCalendar(); break; }
      // Kệ tạm
      case 'shelf-open': api.shelfOpen(el.dataset.id); break;
      case 'shelf-del': api.shelfDel(el.dataset.id); break;
      case 'shelf-clear': api.shelfClear(); break;
      // Bảng tạm
      case 'clip-copy': {
        api.clipCopy(el.dataset.id);
        // Phát sáng báo đã chép (chạy lại hiệu ứng nếu bấm liên tiếp)
        el.classList.remove('copied'); void el.offsetWidth; el.classList.add('copied');
        clearTimeout(el._cpT); el._cpT = setTimeout(() => el.classList.remove('copied'), 1300);
        break;
      }
      case 'clip-pin': api.clipPin(el.dataset.id); break;
      case 'clip-del': api.clipDel(el.dataset.id); break;
      case 'clip-clear': api.clipClear(); break;
      case 'wx-exp': toggleWx(); break;
      case 'wx-place': S.wxPlace = el.dataset.id; renderWeather(); break;
      case 'wx-pick': api.openSettings('weather'); break;
      case 'clip-pause': api.clipPause(!S.prefs.clipPaused); break;
      case 'shelf-exp': S.shelfOpen = !S.shelfOpen; store.set('shelfOpen', S.shelfOpen); renderShelf(); applyLayout(); break;
      case 'clip-q-clear': { const q = $('#clipQ'); q.value = ''; S.clipQ = ''; $('#clipQx').classList.remove('on'); renderClip(); break; }
      // Chuông
      case 'ring-stop': stopRing(); break;
      case 'ring-snooze': snoozeRing(); break;
    }
  }

  document.addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tb[data-tab]');
    if (tab) { setTab(tab.dataset.tab); return; }
    if (ev.target.closest('#mBar')) return;
    // Nút con trong hàng ưu tiên hơn hàng cha
    const inner = ev.target.closest('.acts button[data-act], .note button[data-act], .sh-item .rm[data-act]');
    const el = inner || ev.target.closest('[data-act]');
    if (el) act(el.dataset.act, el);
  });

  // Lăn chuột dọc để cuộn ngang: danh sách thiết bị phát, Kệ tạm
  document.addEventListener('wheel', (ev) => {
    const chips = ev.target.closest('.out-chips, .shelf-list:not(.grid), .wx-places');
    if (chips) {
      ev.preventDefault();
      const d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
      chips.scrollBy({ left: ev.deltaMode === 1 ? d * 40 : d, behavior: 'smooth' });
    }
  }, { passive: false });

  // Danh sách thiết bị phát: kéo để cuộn ngang (kéo xong thì không tính là bấm chọn)
  let chipDrag = null;
  document.addEventListener('pointerdown', (ev) => {
    const c = ev.target.closest('.out-chips');
    if (!c || ev.button !== 0) return;
    chipDrag = { c, x: ev.clientX, left: c.scrollLeft, moved: false, id: ev.pointerId };
  });
  document.addEventListener('pointermove', (ev) => {
    if (!chipDrag) return;
    const dx = ev.clientX - chipDrag.x;
    if (!chipDrag.moved && Math.abs(dx) > 4) {
      chipDrag.moved = true;
      try { chipDrag.c.setPointerCapture(chipDrag.id); } catch (_) {}
      chipDrag.c.classList.add('dragging');
      api.hold(true);
    }
    if (chipDrag.moved) chipDrag.c.scrollLeft = chipDrag.left - dx;
  });
  let chipNoClickUntil = 0;
  function endChipDrag() {
    if (!chipDrag) return;
    if (chipDrag.moved) {
      chipDrag.c.classList.remove('dragging');
      api.hold(false);
      chipNoClickUntil = Date.now() + 80; // cú click ngay sau khi thả không tính là chọn thiết bị
    }
    chipDrag = null;
  }
  ['pointerup', 'pointercancel'].forEach((e) => document.addEventListener(e, endChipDrag));
  document.addEventListener('click', (e) => {
    if (Date.now() < chipNoClickUntil) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener('scroll', (ev) => { if (ev.target.classList && (ev.target.classList.contains('out-chips') || ev.target.classList.contains('shelf-list'))) updateChipFade(ev.target); }, true);

  document.addEventListener('contextmenu', (ev) => { ev.preventDefault(); api.menu(); });

  /* ----- Gõ chữ: cho cửa sổ nhận bàn phím tạm thời ----- */
  // Cửa sổ viên thuốc tạo với focusable: false (không giành bàn phím của ứng dụng đang dùng). Khi đó bấm vào ô
  // nhập thì ô có focus trong trang nhưng sự kiện focusin KHÔNG chạy (cửa sổ chưa có focus), nên trước đây không
  // bao giờ xin được bàn phím: ô tìm kiếm Bảng tạm / ô ghi chú Lịch bấm vào không gõ được.
  // Giờ: nhấn chuột vào ô nhập là xin bàn phím ngay (main bật focusable + focus), rồi focus lại đúng ô đó khi
  // cửa sổ đã nhận focus. Không nhận được focus trong 1,5 giây (Windows chặn) thì trả lại như cũ.
  let typingTimer = null, pendingInput = null, typingGuard = null;
  function beginTyping() {
    clearTimeout(typingTimer);
    if (!S.typing) { S.typing = true; api.typing(true); applyLayout(); }
  }
  function endTyping() {
    clearTimeout(typingGuard); pendingInput = null;
    if (!S.typing) return;
    S.typing = false; api.typing(false);
    if (!S.hoverRaw) collapseSoon(300);
  }
  document.addEventListener('focusin', (ev) => { if (ev.target.matches('input')) beginTyping(); });
  document.addEventListener('pointerdown', (ev) => {
    const inp = ev.target.closest && ev.target.closest('input');
    if (!inp || ev.button !== 0) return;
    pendingInput = inp;
    beginTyping();
    if (document.hasFocus()) return;
    clearTimeout(typingGuard);
    typingGuard = setTimeout(() => { if (!document.hasFocus()) endTyping(); }, 1500);
  }, true);
  window.addEventListener('focus', () => {
    clearTimeout(typingGuard);
    const inp = pendingInput; pendingInput = null;
    if (inp && inp.isConnected && document.activeElement !== inp) inp.focus();
    else if (inp) beginTyping();
    if (inp && inp.id === 'clipQ') markClipSel();
  });
  // Bấm sang ứng dụng khác: cửa sổ mất focus, ô nhập có thể không nhận focusout -> tự kết thúc chế độ gõ
  window.addEventListener('blur', () => { setTimeout(() => { if (!document.hasFocus() && S.typing) endTyping(); }, 120); });
  document.addEventListener('focusout', (ev) => {
    if (!ev.target.matches('input')) return;
    typingTimer = setTimeout(() => {
      if (document.activeElement && document.activeElement.matches('input')) return;
      endTyping();
    }, 120);
  });
  document.addEventListener('keydown', (ev) => {
    const id = ev.target.id;
    if (id === 'clipQ' && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault();
      clipSel += ev.key === 'ArrowDown' ? 1 : -1;
      markClipSel();
      return;
    }
    if (ev.key === 'Enter' && ev.target.matches('input')) {
      if (id === 'noteIn' || id === 'noteAt') addNote();
      if (id === 'clipQ') {
        const it = $$('#clipList .c-item')[clipSel];
        if (it) act('clip-copy', it); // chép rồi trả bàn phím lại cho ứng dụng đang dùng để dán ngay
        ev.target.blur();
      }
    }
    if (ev.key === 'Escape' && ev.target.matches('input')) {
      // Ô tìm kiếm đang có chữ: Esc lần đầu xóa chữ, lần sau mới thoát
      if (id === 'clipQ' && ev.target.value) { act('clip-q-clear'); return; }
      ev.target.blur();
    }
  });
  $('#clipQ').addEventListener('input', (ev) => { S.clipQ = ev.target.value; clipSel = 0; $('#clipQx').classList.toggle('on', !!S.clipQ); renderClip(); });
  // Bấm vào ô tìm kiếm: hiện ngay mục đang chọn; rời ô thì bỏ đánh dấu
  $('#clipQ').addEventListener('focus', () => setTimeout(markClipSel, 0));
  $('#clipQ').addEventListener('blur', () => setTimeout(markClipSel, 150));

  /* ================= Khởi động ================= */
  $('#calIco').innerHTML = ICON.calendar;
  $('#calPrev').innerHTML = ICON.left;
  $('#calNext').innerHTML = ICON.right;
  $('#clipClearBtn').innerHTML = ICON.minusCircle;
  $('#clipPauseBtn').innerHTML = ICON.pause;
  $('#shelfClearBtn').innerHTML = ICON.minusCircle;
  $('#clipQx').innerHTML = ICON.xCircle;
  $('#noteAddBtn').innerHTML = ICON.plus;
  api.clipGet();
  api.shelfGet();
  setTab(S.tab);
  applyLayout();
  setInterval(tick, 100);

  if (window.__DI_TEST) window.__di = { S, startRing, stopRing, act, renderAll, applyLayout, setTab, renderCompact, renderMusic, renderOut, renderVol, setAccent, renderClip, renderShelf, showNotice, holidayOf, diffDevices, snoozeRing, endNotice, noticeQueue, checkSnooze };
})();
