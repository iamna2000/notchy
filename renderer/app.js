(() => {
  'use strict';

  const api = window.api || new Proxy({}, { get: (_t, k) => (k === 'flags' ? () => Promise.resolve({}) : () => {}) });
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
    drop: F('<path d="M12 2.8c.3 0 .6.2.8.4 2.6 3.2 6.2 7.2 6.2 11.2a7 7 0 0 1-14 0c0-4 3.6-8 6.2-11.2.2-.2.5-.4.8-.4z"/>'),
    alarm: L('<circle cx="12" cy="13.2" r="7.2"/><path d="M12 9.2v4.2l2.6 1.6M4.4 6.2l2.8-2.6M19.6 6.2l-2.8-2.6"/>'),
    clip: F('<path d="M9.2 3a2 2 0 0 0-1.9 1.4H6.8A2.8 2.8 0 0 0 4 7.2v11A2.8 2.8 0 0 0 6.8 21h10.4a2.8 2.8 0 0 0 2.8-2.8v-11a2.8 2.8 0 0 0-2.8-2.8h-.5A2 2 0 0 0 14.8 3zm0 1.6h5.6a.4.4 0 0 1 .4.4v.6a.4.4 0 0 1-.4.4H9.2a.4.4 0 0 1-.4-.4V5a.4.4 0 0 1 .4-.4z"/>'),
    toggles: F('<path d="M7.5 3.5h9a4 4 0 0 1 0 8h-9a4 4 0 0 1 0-8zM16.5 5.6a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zM7.5 12.5h9a4 4 0 0 1 0 8h-9a4 4 0 0 1 0-8zM7.5 14.6a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z" fill-rule="evenodd"/>'),
    play: F('<path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z"/>'),
    pause: F('<rect x="6.2" y="4.8" width="4.2" height="14.4" rx="1.3"/><rect x="13.6" y="4.8" width="4.2" height="14.4" rx="1.3"/>'),
    next: F('<path d="M3.6 6.6v10.8a1 1 0 0 0 1.55.84l7.2-4.7v3.86a1 1 0 0 0 1.55.84l7.6-4.9a1 1 0 0 0 0-1.68l-7.6-4.9a1 1 0 0 0-1.55.84v3.86l-7.2-4.7a1 1 0 0 0-1.55.84z"/>'),
    prev: F('<path d="M20.4 6.6v10.8a1 1 0 0 1-1.55.84l-7.2-4.7v3.86a1 1 0 0 1-1.55.84l-7.6-4.9a1 1 0 0 1 0-1.68l7.6-4.9a1 1 0 0 1 1.55.84v3.86l7.2-4.7a1 1 0 0 1 1.55.84z"/>'),
    shuffle: L('<path d="M3 7h3c2 0 3.2 1 4.3 2.7l3.4 5.6c1.1 1.7 2.3 2.7 4.3 2.7h3M3 17h3c1.3 0 2.3-.4 3.1-1.2M13.8 8.7C14.7 7.6 15.8 7 17.2 7H21M18.4 4.4 21 7l-2.6 2.6M18.4 14.4 21 17l-2.6 2.6"/>', 2),
    airplay: L('<path d="M8 17.5H6.5A2.5 2.5 0 0 1 4 15V7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V15a2.5 2.5 0 0 1-2.5 2.5H16"/><path d="m12 14.2 4.4 5.8H7.6z"/>', 2),
    spkLow: F('<path d="M4 9.8h3l4-3.3v11l-4-3.3H4z"/>'),
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
    up: L('<path d="m6 14.5 6-6 6 6"/>'),
    down: L('<path d="m6 9.5 6 6 6-6"/>'),
    calendar: L('<rect x="3.8" y="5.2" width="16.4" height="15" rx="3.2"/><path d="M3.8 10.2h16.4M8.4 3.2v4M15.6 3.2v4"/>', 1.8),
    clock: F('<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm.8 4.6v4.2l2.9 1.7a.8.8 0 0 1-.8 1.4l-3.3-1.9a.8.8 0 0 1-.4-.7V7.6a.8.8 0 0 1 1.6 0z" fill-rule="evenodd"/>'),
    hourglass: L('<path d="M7 3.5h10M7 20.5h10M8 3.5v3.2c0 1.6 1 2.6 2.4 3.6L12 11.5l1.6-1.2C15 9.3 16 8.3 16 6.7V3.5M8 20.5v-3.2c0-1.6 1-2.6 2.4-3.6l1.6-1.2 1.6 1.2c1.4 1 2.4 2 2.4 3.6v3.2"/>', 1.8),
    stopwatch: L('<circle cx="12" cy="13.6" r="7"/><path d="m12 13.6 3-3M9.5 3h5M12 3v3.4"/>', 1.8),
    moon: F('<path d="M20.4 14.6A8.4 8.4 0 0 1 9.4 3.6a.6.6 0 0 0-.8-.7A9.2 9.2 0 1 0 21.1 15.4a.6.6 0 0 0-.7-.8z"/>'),
    coffee: L('<path d="M5 9h11v5.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14.5z"/><path d="M16 10.5h1.2a2.3 2.3 0 0 1 0 4.6H16M8.5 3.5v2M12 3.5v2"/>', 1.8),
    bell: L('<path d="M6 16.6h12l-1.6-2.2v-4.2a4.4 4.4 0 0 0-8.8 0v4.2z"/><path d="M10 19.6a2 2 0 0 0 4 0"/>'),
    reset: L('<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4.5v4h4"/>', 2),
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
  const TABS = ['music', 'water', 'calendar', 'alarm', 'clip', 'shelf', 'ctrl'];
  const EVERY = [0, 15, 20, 30, 45, 60, 90, 120];
  const SNOOZES = [5, 10, 15];
  const TOPBAR = 46;
  const PX_MIN = 8; // 1 phút = 8px trên thước hẹn giờ

  const today0 = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const ymd = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const oldTab = store.get('tab', 'music');
  const S = {
    hover: false, hoverRaw: false, peek: false, hidden: false, typing: false,
    tab: TABS.includes(oldTab) ? oldTab : (oldTab === 'timer' ? 'ctrl' : 'music'),
    ring: null,
    media: { active: false }, mediaError: '', drag: null, outOpen: false,
    sys: { vol: -1, mute: false, bri: -1, devices: [], audio: true },
    flags: { dnd: false, awake: false },
    alarms: store.get('alarms', []), editor: null, snoozes: [],
    notes: store.get('notes', {}),
    sel: today0(), calMonth: store.get('calMonth', false),
    water: Object.assign({ every: 0, from: 540, to: 1260, msg: 'Uống nước nào', snooze: 5 }, store.get('water', {})),
    waterNext: 0,
    clip: [], clipQ: '', shelf: [], notice: null,
    ctPanel: store.get('ctPanel', 'timer'),
    timer: { total: store.get('ttotal', 300), remaining: store.get('ttotal', 300), endTs: 0, running: false },
    sw: { running: false, start: 0, base: 0, laps: [] },
  };

  /* ================= Bố cục / hoạt ảnh viên thuốc ================= */
  const island = $('#island');
  const compactEl = $('#compact');
  let layoutKey = '';
  let closeTimer = null, peekTimer = null;

  const hasMusic = () => !!(S.media.active && S.media.title && (S.media.status === 'Playing' || S.media.status === 'Paused'));
  const isPlaying = () => S.media.active && S.media.status === 'Playing';

  function viewH() {
    switch (S.tab) {
      case 'music': return hasMusic() ? (S.outOpen ? 316 : 226) : 168;
      case 'water': return 198;
      case 'calendar': return S.calMonth ? 414 : 272;
      case 'alarm': return 312;
      case 'clip': return 352;
      case 'shelf': return 332;
      default: return (S.sys.bri >= 0 ? 304 : 262);
    }
  }
  function target() {
    if (S.ring) return { mode: 'ring', w: 440, h: 186, r: 40, ear: 16 };
    if (S.hover || S.peek || S.typing) return { mode: 'open', w: 480, h: viewH(), r: 40, ear: 18 };
    if (S.notice) return { mode: 'notice', w: 340, h: 60, r: 30, ear: 15 };
    let c = { w: 156, h: 34, r: 17, ear: 9 };
    if (hasMusic()) c = { w: 350, h: 42, r: 20, ear: 10 };
    else if (S.timer.running) c = { w: 210, h: 34, r: 17, ear: 9 };
    if (S.hidden) return { mode: 'hidden', w: 56, h: 4, r: 3, ear: 0 };
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
    island.style.borderRadius = `0 0 ${t.r}px ${t.r}px`;
    island.style.setProperty('--ear', t.ear + 'px');
    api.size(t.w, t.h);
  }
  function collapseSoon(ms) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { if (!S.hoverRaw && !S.typing && !drag) { S.hover = false; applyLayout(); } }, ms);
  }
  api.onHover((v) => {
    S.hoverRaw = v;
    clearTimeout(closeTimer);
    if (v) { S.hover = true; applyLayout(); requestSys(); }
    else collapseSoon(380);
  });
  api.onHidden((v) => { S.hidden = !!v; applyLayout(); });
  api.onWinVis((v) => document.documentElement.classList.toggle('win-off', !v));
  api.onPeek(() => {
    S.peek = true; applyLayout();
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => { S.peek = false; applyLayout(); }, 3000);
  });

  /* ================= Tab ================= */
  const TB_ICON = { music: ICON.music, water: ICON.drop, alarm: ICON.alarm, clip: ICON.clip, shelf: ICON.shelf, ctrl: ICON.toggles };
  $$('.tb').forEach((b) => { if (TB_ICON[b.dataset.tab]) b.innerHTML = TB_ICON[b.dataset.tab]; });
  function setTab(id, auto) {
    S.tab = id;
    if (!auto) store.set('tab', id);
    $$('.tb').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
    $$('.view').forEach((v) => v.classList.toggle('on', v.dataset.view === id));
    renderTopDate();
    renderAll();
    applyLayout();
    requestSys(true);
  }
  function renderTopDate() {
    const n = new Date();
    $('#tbDate').textContent = S.tab === 'calendar' ? `${n.getDate()}.${n.getMonth() + 1}` : String(n.getDate());
  }

  /* ================= Định dạng ================= */
  const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmtTrack = (sec) => { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600); return h > 0 ? `${h}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}` : `${Math.floor(sec / 60)}:${pad(sec % 60)}`; };
  const fmtTimer = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`; };
  const fmtSW = (ms) => {
    const cs = Math.floor(ms / 10) % 100, s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000) % 60, h = Math.floor(ms / 3600000);
    return (h > 0 ? `${h}:${pad(m)}` : pad(m)) + `:${pad(s)}.${pad(cs)}`;
  };
  const fmtMin = (mn) => `${pad(Math.floor(mn / 60))}:${pad(mn % 60)}`;
  function lunarOf(d) {
    const r = window.Lunar.solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear(), 7);
    return { d: r[0], m: r[1], y: r[2], leap: r[3] === 1 };
  }

  /* ================= Nhạc ================= */
  function setAccent(url) {
    if (!url) { island.style.removeProperty('--accent'); return; }
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
        const s = clamp(dl / (1 - Math.abs(mx + mn - 1) || 1), 0.35, 0.75);
        island.style.setProperty('--accent', `hsl(${Math.round(h)} ${Math.round(s * 100)}% 68%)`);
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
        S.media = { active: true, key: m.key, title: m.title, artist: m.artist, album: m.album, app: m.app, status, pos, base, dur: m.dur, rate: m.rate || 1, shuffle: !!m.shuffle, seekAt, cmdAt, thumb };
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
    const sig = JSON.stringify([m.active, m.key, m.status, (m.thumb || '').length, S.mediaError, m.dur > 0, !!m.shuffle, S.outOpen]);
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
        <div class="art ${m.status === 'Paused' ? 'paused' : ''}" id="mArt">${m.thumb ? '' : ICON.music}</div>
        <div class="m-meta"><div class="m-title">${esc(m.title)}</div><div class="m-artist">${esc(m.artist || m.album || appName(m.app) || ' ')}</div></div>
        <div class="m-eq eq ${isPlaying() ? 'on' : ''}"><i></i><i></i><i></i></div>
      </div>
      <div class="m-prog"><span id="mPos">0:00</span><div class="bar" id="mBar"><i id="mFill"></i><b id="mKnob"></b></div><span id="mRem">${hasDur ? '-0:00' : '--:--'}</span></div>
      <div class="m-ctrls">
        <button data-act="m-shuffle" class="${m.shuffle ? 'on' : 'dim'}" aria-label="Phát ngẫu nhiên">${ICON.shuffle}</button>
        <button data-act="m-prev" aria-label="Bài trước">${ICON.prev}</button>
        <button class="play" data-act="m-play" aria-label="Phát/Tạm dừng">${m.status === 'Playing' ? ICON.pause : ICON.play}</button>
        <button data-act="m-next" aria-label="Bài sau">${ICON.next}</button>
        <button data-act="m-out" class="${S.outOpen ? 'on' : ''}" aria-label="Thiết bị phát">${ICON.airplay}</button>
      </div>`;
    if (m.thumb) $('#mArt').style.backgroundImage = `url("${m.thumb}")`;
    if (isPlaying()) $$('.m-title, .m-artist', body).forEach((el) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const t = el.textContent, item = `<span class="mq-i">${esc(t)}</span>`;
      el.innerHTML = `<div class="mq run">${item}${item}</div>`;
      el.firstElementChild.style.setProperty('--dur', Math.max(6, el.firstElementChild.firstElementChild.offsetWidth / 32).toFixed(1) + 's');
    });
    renderOut();
    updateProgress();
  }
  function updateProgress() {
    const fill = $('#mFill');
    if (!fill || !hasMusic()) return;
    const m = S.media, p = curPos(), pc = m.dur > 0 ? (p / m.dur) * 100 : 0;
    fill.style.width = pc + '%';
    $('#mKnob').style.left = pc + '%';
    $('#mPos').textContent = fmtTrack(p);
    $('#mRem').textContent = m.dur > 0 ? '-' + fmtTrack(m.dur - p) : '--:--';
  }

  /* ----- Âm lượng + thiết bị phát ----- */
  const devIcon = (n) => (/headphone|airpods|tai nghe|headset|buds|bluetooth/i.test(n) ? ICON.headphones : /monitor|display|hdmi|nvidia|displayport|\bdp\b|tv/i.test(n) ? ICON.monitor : ICON.speaker);
  function renderOut() {
    const el = $('#musicOut');
    if (!hasMusic()) return;
    const devs = S.sys.devices || [];
    el.innerHTML = `
      <div class="out-vol">${ICON.spkLow}<div class="bar" data-vol="1"><i></i></div>${ICON.spkHigh}</div>
      <div class="out-chips">
        ${devs.map((d) => `<button class="out-chip ${d.def ? 'on' : ''}" data-act="dev" data-id="${esc(d.id)}" title="${esc(d.name)}">${devIcon(d.name)}<span>${esc(d.name)}</span></button>`).join('')}
        <button class="out-chip" data-act="open-sound">${ICON.gear}<span>Cài đặt</span></button>
      </div>`;
    renderVol();
  }
  function renderVol() {
    const v = S.sys.vol, ok = v >= 0;
    const frac = ok ? (S.sys.mute ? 0 : v) : 0;
    const sl = $('#slVol');
    if (sl) { setSl(sl, frac, ok ? (S.sys.mute ? 'Tắt tiếng' : Math.round(v * 100) + '%') : '--'); sl.classList.toggle('off', !ok); }
    const b = $('.bar[data-vol] i');
    if (b) b.style.width = frac * 100 + '%';
  }
  function renderBri() {
    const b = S.sys.bri, sl = $('#slBri');
    sl.style.display = b >= 0 ? '' : 'none';
    if (b >= 0) setSl(sl, b / 100, Math.round(b) + '%');
  }
  api.onSys((m) => {
    if (!m || (m.type !== 'sys' && m.type !== 'sys-error')) return;
    if (m.type === 'sys') {
      if (drag && (drag.k === 'sl' || drag.k === 'vol2')) { const keep = S.sys.vol, kb = S.sys.bri; Object.assign(S.sys, m); S.sys.vol = keep; S.sys.bri = kb; }
      else Object.assign(S.sys, m);
      if (m.devices) { diffDevices(m.devices); renderOut(); }
      renderVol(); renderBri(); applyLayout();
    }
  });
  let sysLast = 0;
  function requestSys(force) {
    const need = S.tab === 'ctrl' || (S.tab === 'music' && S.outOpen);
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
  function setBri(f) { S.sys.bri = Math.round(clamp(f, 0, 1) * 100); renderBri(); sendThrottled('bri', 'bri:' + Math.max(1, S.sys.bri)); }

  /* ----- Thanh trượt trắng/đen ----- */
  function buildSl(el, label) {
    el.innerHTML = `<div class="sl-base"><span>${label}</span><span class="v"></span></div><div class="sl-top"><span>${label}</span><span class="v"></span><i class="sl-grip"></i></div>`;
  }
  function setSl(el, frac, txt) {
    el.style.setProperty('--p', (clamp(frac, 0, 1) * 100).toFixed(1) + '%');
    el.querySelectorAll('.v').forEach((v) => { v.textContent = txt; });
  }

  /* ================= Thu gọn ================= */
  let compactSig = '';
  function renderCompact() {
    const now = new Date();
    const music = hasMusic(), tRun = S.timer.running, extras = music || tRun;
    compactEl.classList.toggle('extras', extras);
    compactEl.classList.toggle('music', music);
    const cc = $('#cCenter'), cl = $('#cLeft'), cr = $('#cRight');
    if (!extras) {
      cc.textContent = fmtClock(now);
      if (compactSig !== 'idle') { compactSig = 'idle'; cl.innerHTML = ''; cr.innerHTML = ''; }
      return;
    }
    const sig = [music, tRun, music ? (S.media.thumb || '').length : 0, isPlaying(), music ? S.media.title + S.media.artist : ''].join('|');
    if (sig !== compactSig) {
      compactSig = sig;
      cl.innerHTML = music ? '<div class="c-art" id="cArt"></div>' : `<span class="c-ico">${ICON.hourglass}</span>`;
      if (music) {
        const item = `<span class="mq-i"><b>${esc(S.media.title)}</b>${S.media.artist ? `<em>${esc(S.media.artist)}</em>` : ''}</span>`;
        cc.innerHTML = `<div class="c-mid"><div class="mq ${isPlaying() ? 'run' : ''}">${item}${item}</div></div>`;
        const mq = $('.mq', cc);
        mq.style.setProperty('--dur', Math.max(6, mq.firstElementChild.offsetWidth / 32).toFixed(1) + 's');
      } else cc.innerHTML = '';
      cr.innerHTML = tRun ? '<span class="c-timer" id="cTimer"></span>' : `<span class="c-pp">${isPlaying() ? ICON.pause : ICON.play}</span>`;
      if (music) { const a = $('#cArt'); if (S.media.thumb) a.style.backgroundImage = `url("${S.media.thumb}")`; else a.innerHTML = ICON.music; }
    }
    const t = $('#cTimer');
    if (t) t.textContent = fmtTimer(Math.ceil(timerRemaining()));
  }

  /* ================= Nhắc uống nước ================= */
  const saveWater = () => store.set('water', S.water);
  function scheduleWater() {
    const w = S.water;
    if (!w.every) { S.waterNext = 0; return; }
    S.waterNext = nextInWindow(Date.now() + w.every * 60000);
  }
  function nextInWindow(ts) {
    const w = S.water, d = new Date(ts), mn = d.getHours() * 60 + d.getMinutes();
    if (mn >= w.from && mn < w.to) return ts;
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(w.from / 60), w.from % 60, 0, 0);
    if (mn >= w.to) t.setDate(t.getDate() + 1);
    return t.getTime();
  }
  function renderWater() {
    const w = S.water, idx = Math.max(0, EVERY.indexOf(w.every));
    setSl($('#slEvery'), idx / (EVERY.length - 1), w.every ? `${w.every} phút` : 'Tắt');
    const s = Math.round(w.from / 30), e = Math.round(w.to / 30);
    const ticks = Array.from({ length: 48 }, (_, i) => `<i class="${i >= s && i < e ? 'in' : ''}"></i>`).join('');
    $('#wRange').innerHTML = `<span class="t">${fmtMin(w.from)}</span><div class="ticks2" id="wTicks">${ticks}</div><span class="t">${fmtMin(w.to)}</span>`;
    const msg = $('#wMsg');
    if (document.activeElement !== msg) msg.value = w.msg;
    $('#wSnooze').textContent = `Nhắc lại sau ${w.snooze}′`;
  }
  function saveWaterMsg() {
    const v = $('#wMsg').value.trim();
    S.water.msg = v || 'Uống nước nào';
    saveWater();
    const b = $('#wSave'); b.innerHTML = ICON.check; setTimeout(() => { b.innerHTML = ICON.check; }, 900);
  }
  function fireWater() {
    startRing({ kind: 'water', title: S.water.msg || 'Uống nước nào', sub: 'Đứng dậy vươn vai một chút nhé' });
    scheduleWater();
  }

  /* ================= Lịch + ghi chú ================= */
  const HOL_SOLAR = { '1/1': 'Tết Dương lịch', '14/2': 'Valentine', '8/3': 'Quốc tế Phụ nữ', '30/4': 'Giải phóng miền Nam', '1/5': 'Quốc tế Lao động', '1/6': 'Quốc tế Thiếu nhi', '2/9': 'Quốc khánh', '20/10': 'Phụ nữ Việt Nam', '20/11': 'Nhà giáo Việt Nam', '24/12': 'Đêm Giáng sinh', '25/12': 'Giáng sinh' };
  const HOL_LUNAR = { '1/1': 'Tết Nguyên Đán', '2/1': 'Mùng 2 Tết', '3/1': 'Mùng 3 Tết', '15/1': 'Rằm tháng Giêng', '10/3': 'Giỗ Tổ Hùng Vương', '15/4': 'Phật Đản', '5/5': 'Tết Đoan Ngọ', '15/7': 'Vu Lan', '15/8': 'Tết Trung Thu', '23/12': 'Ông Táo chầu trời' };
  function holidayOf(d) {
    const l = lunarOf(d);
    return [HOL_SOLAR[d.getDate() + '/' + (d.getMonth() + 1)], !l.leap && HOL_LUNAR[l.d + '/' + l.m]].filter(Boolean).join(' · ');
  }
  const saveNotes = () => store.set('notes', S.notes);
  const notesOf = (d) => S.notes[ymd(d)] || [];
  function weekStart(d) { const o = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - o); }
  function renderCalendar() {
    const t0 = today0(), sel = S.sel;
    $('#calTitle').textContent = `Tháng ${sel.getMonth() + 1} năm ${sel.getFullYear()}`;
    let html = '';
    const cell = (d, cls, tag) => {
      const l = lunarOf(d), n = notesOf(d).length, hl = holidayOf(d);
      return `<div class="${tag} ${cls}" data-act="cal-pick" data-ts="${d.getTime()}"><b>${d.getDate()}</b><small class="${l.d === 1 ? 'first' : ''}">${l.d === 1 ? l.d + '/' + l.m : l.d}</small>${n ? '<i class="dot"></i>' : hl ? '<i class="dot hol"></i>' : ''}</div>`;
    };
    let weekDays = [];
    if (!S.calMonth) {
      const ws = weekStart(sel);
      weekDays = Array.from({ length: 7 }, (_, i) => new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i));
      html = '<div class="cal-week">' + weekDays.map((d) => cell(d, [d.getTime() === t0.getTime() ? 'today' : '', d.getTime() === sel.getTime() ? 'sel' : ''].join(' '), 'wc')).join('') + '</div>';
    } else {
      const first = new Date(sel.getFullYear(), sel.getMonth(), 1), offset = (first.getDay() + 6) % 7;
      let cells = '';
      for (let i = 0; i < 42; i++) {
        const d = new Date(first.getFullYear(), first.getMonth(), 1 - offset + i);
        cells += cell(d, [d.getMonth() !== sel.getMonth() ? 'other' : '', d.getTime() === t0.getTime() ? 'today' : '', d.getTime() === sel.getTime() ? 'sel' : ''].join(' '), 'mc');
      }
      html = `<div class="cal-grid">${cells}</div>`;
    }
    $('#calBody').innerHTML = html;
    const todayIdx = !S.calMonth ? weekDays.findIndex((d) => d.getTime() === t0.getTime()) : -1;
    $('#calWdRow').innerHTML = MON_FIRST.map((d, i) => `<span class="${i === todayIdx ? 'today' : ''}">${WD_SHORT[d]}</span>`).join('');
    const l = lunarOf(sel);
    $('#dtHead').innerHTML = `<div>${WD_FULL[sel.getDay()]}, ${sel.getDate()} tháng ${sel.getMonth() + 1}</div><span>Âm lịch ${l.d}/${l.m}${l.leap ? ' nhuận' : ''} · ${window.Lunar.canChi(l.y)}</span>`;
    renderNotes();
  }
  function renderNotes() {
    const list = notesOf(S.sel);
    const hl = holidayOf(S.sel);
    $('#notes').innerHTML = (hl ? `<div class="note hol"><span class="tm">Lễ</span><span class="tx">${esc(hl)}</span></div>` : '') + list.map((n) => `<div class="note">${n.at ? `<span class="tm">${n.at}</span>` : ''}<span class="tx">${esc(n.t)}</span><button data-act="note-del" data-id="${n.id}" aria-label="Xóa">${ICON.x}</button></div>`).join('');
  }
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

  /* ================= Báo thức ================= */
  const saveAlarms = () => store.set('alarms', S.alarms);
  function repeatText(days) {
    const set = new Set(days);
    if (!set.size) return 'Một lần';
    if (set.size === 7) return 'Hằng ngày';
    if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Các ngày trong tuần';
    if (set.size === 2 && set.has(0) && set.has(6)) return 'Cuối tuần';
    return MON_FIRST.filter((d) => set.has(d)).map((d) => WD_SHORT[d]).join(' ');
  }
  function renderAlarms() {
    const list = $('#alarmList');
    const sorted = [...S.alarms].sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
    list.innerHTML = !sorted.length ? `<div class="list-empty">${ICON.alarm}<span>Chưa có báo thức nào</span></div>` : sorted.map((a) => `
      <div class="a-row ${a.on ? '' : 'off'}" data-act="a-edit" data-id="${a.id}">
        <div><div class="a-time">${pad(a.h)}:${pad(a.m)}</div><div class="a-sub">${repeatText(a.days)}</div></div>
        <div class="sw ${a.on ? 'on' : ''}" data-act="a-toggle" data-id="${a.id}"></div>
      </div>`).join('');
    renderEditor();
  }
  function renderEditor() {
    const el = $('#alarmEditor'), e = S.editor;
    el.classList.toggle('on', !!e);
    if (!e) return;
    el.innerHTML = `
      <div class="pick">
        <div class="col" data-col="h"><button data-rep data-act="e-h+">${ICON.up}</button><div class="v">${pad(e.h)}</div><button data-rep data-act="e-h-">${ICON.down}</button></div>
        <div class="colon">:</div>
        <div class="col" data-col="m"><button data-rep data-act="e-m+">${ICON.up}</button><div class="v">${pad(e.m)}</div><button data-rep data-act="e-m-">${ICON.down}</button></div>
      </div>
      <div class="days">${MON_FIRST.map((d) => `<button class="day ${e.days.includes(d) ? 'on' : ''}" data-act="e-day" data-d="${d}">${WD_SHORT[d]}</button>`).join('')}</div>
      <div class="e-actions">
        ${e.id ? '<button class="pbtn danger" data-act="e-del">Xóa</button>' : '<span></span>'}
        <div class="right"><button class="pbtn gray" data-act="e-cancel">Hủy</button><button class="pbtn accent" data-act="e-save">Lưu</button></div>
      </div>`;
  }
  const wrap = (v, max) => ((v % max) + max) % max;

  /* ================= Bảng tạm ================= */
  api.onClip((list) => { S.clip = Array.isArray(list) ? list : []; renderClip(); });
  const clipType = (t) => { const s = t.trim(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? 'mail' : /^(https?:\/\/|www\.)\S+$/i.test(s) ? 'link' : 'text'; };
  function renderClip() {
    const q = S.clipQ.trim().toLowerCase();
    const items = S.clip.filter((x) => !q || x.text.toLowerCase().includes(q));
    const short = (t) => esc(t.replace(/\s+/g, ' ').trim().slice(0, 160));
    $('#clipPins').innerHTML = items.filter((x) => x.pin).slice(0, 6).map((x) => `<button class="pin-chip" data-act="clip-paste" data-id="${x.id}"><span>${short(x.text)}</span></button>`).join('');
    const list = $('#clipList');
    if (!items.length) { list.innerHTML = `<div class="clip-empty">${q ? 'Không có kết quả' : 'Chưa có gì. Hãy sao chép một đoạn văn bản bất kỳ.'}</div>`; return; }
    const tyIcon = { mail: ICON.mail, link: ICON.link, text: ICON.note };
    list.innerHTML = items.map((x) => { const ty = clipType(x.text); return `
      <div class="c-item" data-act="clip-paste" data-id="${x.id}">
        <span class="ty ${ty}">${tyIcon[ty]}</span><span class="tx">${short(x.text)}</span>
        <span class="acts"><button class="${x.pin ? 'on' : ''}" data-act="clip-pin" data-id="${x.id}" title="Ghim">${x.pin ? ICON.bookmarkF : ICON.bookmark}</button><button data-act="clip-del" data-id="${x.id}" title="Xóa">${ICON.x}</button></span>
      </div>`; }).join('');
  }

  /* ================= Kệ tạm (kéo thả tệp) ================= */
  api.onShelf((list) => { S.shelf = Array.isArray(list) ? list : []; renderShelf(); });
  function renderShelf() {
    const el = $('#shelfList');
    if (!el) return;
    if (!S.shelf.length) {
      el.innerHTML = `<div class="shelf-drop">${ICON.shelf}<b>Kéo tệp vào đây để giữ tạm</b><span>Cần dùng thì kéo từ đây thả sang ứng dụng khác. Kệ chỉ nhớ đường dẫn, không sao chép hay xóa tệp thật.</span></div>`;
      return;
    }
    el.innerHTML = S.shelf.map((x) => `
      <div class="sh-item" draggable="true" data-act="shelf-open" data-id="${esc(x.id)}" title="${esc(x.name)}&#10;${esc(x.dir)}">
        ${x.icon ? `<img src="${esc(x.icon)}" alt="" />` : `<span class="fi">${ICON.file}</span>`}
        <span class="nm">${esc(x.name)}</span>
        <button class="rm" data-act="shelf-del" data-id="${esc(x.id)}" aria-label="Bỏ khỏi kệ">${ICON.x}</button>
      </div>`).join('');
  }
  const hasFiles = (ev) => !!(ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files'));
  let dragDepth = 0;
  const endDropUi = () => { dragDepth = 0; document.body.classList.remove('dropping'); };
  document.addEventListener('dragenter', (ev) => {
    if (!hasFiles(ev)) return;
    ev.preventDefault();
    dragDepth++;
    document.body.classList.add('dropping');
    if (S.tab !== 'shelf') setTab('shelf', true);
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
  let noticeTimer = null;
  const NOTICE_ICON = { charge: [ICON.bolt, '#30d158'], low: [ICON.battery, '#ff453a'], download: [ICON.download, '#0a84ff'], device: [ICON.headphones, '#ffffff'] };
  function showNotice(n) {
    if (!n || S.ring) return;
    const [ic, col] = NOTICE_ICON[n.kind] || NOTICE_ICON.device;
    $('#nIcon').innerHTML = ic;
    $('#nIcon').style.setProperty('--nc', col);
    $('#nTitle').textContent = n.title || '';
    $('#nSub').textContent = n.sub || '';
    S.notice = n;
    api.notice();
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { S.notice = null; applyLayout(); }, 4000);
    applyLayout();
  }
  api.onToast((t) => showNotice(t));

  // Pin: báo khi cắm sạc, pin yếu (20%, 10%)
  (function watchBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then((b) => {
      let lastCharging = b.charging, warned = 100;
      const pct = () => Math.round(b.level * 100);
      b.addEventListener('chargingchange', () => {
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

  /* ================= Điều khiển: hẹn giờ, bấm giờ, công tắc ================= */
  function timerRemaining() { return S.timer.running ? Math.max(0, (S.timer.endTs - Date.now()) / 1000) : S.timer.remaining; }
  function buildRuler() {
    let h = '';
    for (let m = 0; m <= 180; m += 5) h += m % 10 === 0 ? `<span style="left:${m * PX_MIN}px">${m}</span>` : `<u style="left:${m * PX_MIN}px"></u>`;
    $('#ticks').innerHTML = h;
  }
  function renderRuler() {
    const rw = $('#ruler').clientWidth || 424;
    const mins = S.timer.running ? timerRemaining() / 60 : S.timer.total / 60;
    $('#ticks').style.transform = `translateX(${(rw * 0.36 - mins * PX_MIN).toFixed(1)}px)`;
  }
  function renderIcRow() {
    const items = [
      ['ct-timer', ICON.hourglass, 'Hẹn giờ', S.ctPanel === 'timer'],
      ['ct-sw', ICON.stopwatch, 'Bấm giờ', S.ctPanel === 'sw'],
      ['ct-dnd', ICON.moon, 'Không làm phiền (tắt thông báo)', S.flags.dnd],
      ['ct-awake', ICON.coffee, 'Giữ máy luôn thức', S.flags.awake],
    ];
    $('#icRow').innerHTML = items.map(([a, ic, t, on]) => `<button class="ib ${on ? 'on' : ''}" data-act="${a}" title="${t}">${ic}</button>`).join('');
    $('.ct-timer').classList.toggle('on', S.ctPanel === 'timer');
    $('.ct-sw').classList.toggle('on', S.ctPanel === 'sw');
  }
  function renderTimer() {
    const T = S.timer, rem = timerRemaining();
    $('#tTime').textContent = fmtTimer(Math.ceil(rem));
    const btn = $('#tToggle');
    const label = T.running ? 'Tạm dừng' : (rem < T.total && rem > 0 ? 'Tiếp tục' : 'Bắt đầu');
    if (btn.textContent !== label) btn.textContent = label;
    $('#tReset').style.visibility = (T.running || rem < T.total) ? 'visible' : 'hidden';
    renderRuler();
  }
  function timerAdjust(deltaSec) {
    const T = S.timer, rem = timerRemaining();
    if (deltaSec < 0 && rem + deltaSec < 60) return;
    if (T.total + deltaSec > 180 * 60) return;
    T.total += deltaSec;
    if (T.running) T.endTs += deltaSec * 1000; else T.remaining = Math.min(T.total, rem + deltaSec);
    store.set('ttotal', T.total);
    renderTimer(); renderCompact();
  }
  function swElapsed() { return S.sw.running ? S.sw.base + (performance.now() - S.sw.start) : S.sw.base; }
  function renderSW() {
    const el = swElapsed();
    $('#swTime').textContent = fmtSW(el);
    const tg = $('#swToggle'), lp = $('#swLapBtn');
    const lbl = S.sw.running ? 'Dừng' : 'Bắt đầu';
    if (tg.textContent !== lbl) { tg.textContent = lbl; tg.className = 'pill ' + (S.sw.running ? 'gray' : 'orange'); }
    const lbl2 = S.sw.running ? 'Vòng' : 'Đặt lại';
    if (lp.textContent !== lbl2) lp.textContent = lbl2;
    lp.disabled = !S.sw.running && el === 0;
  }
  function renderLaps() {
    const laps = S.sw.laps;
    $('#swLaps').innerHTML = laps.slice(-3).reverse().map((t, i) => { const n = laps.length - i, prev = laps[n - 2] || 0; return `<div><span>Vòng ${n}</span><span>${fmtSW(t - prev)}</span></div>`; }).join('');
  }
  api.onFlags((f) => { if (f) { S.flags = Object.assign(S.flags, f); renderIcRow(); } });
  Promise.resolve(api.flags()).then((f) => { if (f) { S.flags = Object.assign(S.flags, f); renderIcRow(); } }).catch(() => {});

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
    $('#ringIcon').innerHTML = r.kind === 'timer' ? ICON.hourglass : r.kind === 'water' ? ICON.drop : ICON.bell;
    const sn = $('#ringSnooze');
    sn.style.display = (r.kind === 'alarm' || r.kind === 'water' || r.kind === 'timer') ? '' : 'none';
    sn.textContent = r.kind === 'water' ? `Nhắc lại sau ${S.water.snooze}′` : r.kind === 'timer' ? '+5 phút' : 'Báo lại 5 phút';
    $('#ringRestart').style.display = r.kind === 'timer' ? '' : 'none';
    $('#ringStop').textContent = (r.kind === 'water' || r.kind === 'note') ? 'Xong' : 'Tắt';
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
  }

  /* ================= Kiểm tra báo thức / ghi chú (có bù khi máy ngủ dậy) ================= */
  let lastTick = Date.now();
  function checkAlarms() {
    const now = Date.now();
    let from = Math.floor(lastTick / 60000) + 1;
    const to = Math.floor(now / 60000);
    if (to - from > 15) from = to - 15;
    for (let mn = from; mn <= to; mn++) {
      const d = new Date(mn * 60000), hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      for (const a of S.alarms) {
        if (a.on && a.h === d.getHours() && a.m === d.getMinutes() && (!a.days.length || a.days.includes(d.getDay()))) {
          if (!a.days.length) { a.on = false; saveAlarms(); renderAlarms(); }
          startRing({ kind: 'alarm', title: 'Báo thức', sub: hhmm });
        }
      }
      for (const n of S.notes[ymd(d)] || []) if (n.at === hhmm) startRing({ kind: 'note', title: n.t, sub: 'Ghi chú · ' + hhmm });
    }
    S.snoozes = S.snoozes.filter((sn) => { if (sn.ts <= now) { startRing({ kind: 'alarm', title: 'Báo thức (báo lại)', sub: fmtClock(new Date()) }); return false; } return true; });
    if (S.waterNext && now >= S.waterNext) fireWater();
    lastTick = now;
  }

  /* ================= Vòng lặp chính ================= */
  let lastSec = -1;
  function tick() {
    const now = new Date(), T = S.timer;
    if (T.running && timerRemaining() <= 0) {
      T.running = false; T.remaining = 0;
      startRing({ kind: 'timer', title: 'Hết giờ', sub: fmtTimer(T.total) });
      renderTimer(); applyLayout();
    }
    if (S.tab === 'ctrl') { if (S.ctPanel === 'timer') { if (T.running) renderTimer(); } else renderSW(); }
    if (S.tab === 'music' && !(S.drag && S.drag.k === 'seek')) updateProgress();
    if (now.getSeconds() !== lastSec) {
      lastSec = now.getSeconds();
      checkAlarms(); renderCompact(); renderTopDate();
      if (S.hover || S.peek) requestSys();
      if (Date.now() - devPoll > 8000) { devPoll = Date.now(); api.sys('devices'); }
      applyLayout();
    }
  }
  function renderAll() {
    renderMusic(); renderWater(); renderCalendar(); renderAlarms(); renderClip(); renderShelf(); renderIcRow(); renderTimer(); renderSW(); renderLaps(); renderCompact(); renderVol(); renderBri();
  }

  /* ================= Kéo thả (tua nhạc, thanh trượt, thước hẹn giờ...) ================= */
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
    else if (d.k === 'sl') {
      const f = frac(d.el, ev);
      if (d.el.id === 'slVol') setVol(f);
      else if (d.el.id === 'slBri') setBri(f);
      else if (d.el.id === 'slEvery') {
        const idx = Math.round(f * (EVERY.length - 1));
        if (EVERY[idx] !== S.water.every) { S.water.every = EVERY[idx]; saveWater(); scheduleWater(); renderWater(); }
      }
    } else if (d.k === 'vol2') setVol(frac(d.el, ev));
    else if (d.k === 'ruler') {
      if (S.timer.running) return;
      const mins = clamp(Math.round(d.min0 - (ev.clientX - d.x0) / PX_MIN), 1, 180);
      if (mins * 60 !== S.timer.total) { S.timer.total = S.timer.remaining = mins * 60; store.set('ttotal', S.timer.total); renderTimer(); }
    } else if (d.k === 'range') {
      const idx = Math.round(frac(d.el, ev) * 47);
      const mn = idx * 30, w = S.water;
      if (Math.abs(mn - w.from) <= Math.abs(mn - w.to)) w.from = Math.min(mn, w.to - 30); else w.to = Math.max(mn, w.from + 30);
      saveWater(); renderWater(); scheduleWater();
    }
  }
  function endDrag() {
    const d = drag; if (!d) return;
    drag = null; S.drag = null;
    api.hold(false);
    if (d.k === 'seek') {
      const sec = d.sec == null ? curPos() : d.sec;
      S.media.pos = sec; S.media.base = Date.now(); S.media.seekAt = Date.now();
      api.media('seek:' + sec.toFixed(1));
    } else if (d.k === 'sl' && d.el.id === 'slBri') api.sys('bri:' + Math.max(1, S.sys.bri));
    if (!S.hoverRaw) collapseSoon(500);
  }
  document.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const t = ev.target;
    let el;
    if ((el = t.closest('#mBar'))) { if (hasMusic() && S.media.dur > 0) beginDrag({ k: 'seek', el, sec: null }, ev); return; }
    if ((el = t.closest('.sl'))) { beginDrag({ k: 'sl', el }, ev); return; }
    if ((el = t.closest('.bar[data-vol]'))) { beginDrag({ k: 'vol2', el }, ev); return; }
    if ((el = t.closest('#ruler'))) { beginDrag({ k: 'ruler', el, x0: ev.clientX, min0: S.timer.total / 60 }, ev); return; }
    if ((el = t.closest('#wTicks'))) { beginDrag({ k: 'range', el }, ev); return; }
  });
  document.addEventListener('pointermove', (ev) => { if (drag) moveDrag(ev); });
  ['pointerup', 'pointercancel'].forEach((e) => document.addEventListener(e, endDrag));

  /* ================= Sự kiện bấm ================= */
  function act(a, el) {
    const T = S.timer, m = S.media;
    switch (a) {
      // Nhạc
      case 'm-play': m.pos = curPos(); m.base = Date.now(); m.status = m.status === 'Playing' ? 'Paused' : 'Playing'; m.cmdAt = Date.now(); api.media('play_pause'); musicSig = ''; renderMusic(); renderCompact(); break;
      case 'm-next': api.media('next'); break;
      case 'm-prev': api.media('prev'); break;
      case 'm-shuffle': m.shuffle = !m.shuffle; api.media('shuffle'); musicSig = ''; renderMusic(); break;
      case 'm-out': S.outOpen = !S.outOpen; musicSig = ''; renderMusic(); applyLayout(); requestSys(true); break;
      case 'dev': api.sys('dev:' + el.dataset.id); S.sys.devices.forEach((d) => { d.def = d.id === el.dataset.id; }); renderOut(); break;
      case 'open-sound': api.openSound(); break;
      // Nước
      case 'w-save': saveWaterMsg(); break;
      case 'w-snooze-cycle': S.water.snooze = SNOOZES[(SNOOZES.indexOf(S.water.snooze) + 1) % SNOOZES.length]; saveWater(); renderWater(); break;
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
      // Báo thức
      case 'alarm-add': S.editor = { id: null, h: 7, m: 0, days: [] }; renderEditor(); break;
      case 'a-edit': { const a2 = S.alarms.find((x) => x.id === el.dataset.id); if (a2) { S.editor = { id: a2.id, h: a2.h, m: a2.m, days: [...a2.days] }; renderEditor(); } break; }
      case 'a-toggle': { const a2 = S.alarms.find((x) => x.id === el.dataset.id); if (a2) { a2.on = !a2.on; saveAlarms(); renderAlarms(); } break; }
      case 'e-h+': S.editor.h = wrap(S.editor.h + 1, 24); renderEditor(); break;
      case 'e-h-': S.editor.h = wrap(S.editor.h - 1, 24); renderEditor(); break;
      case 'e-m+': S.editor.m = wrap(S.editor.m + 1, 60); renderEditor(); break;
      case 'e-m-': S.editor.m = wrap(S.editor.m - 1, 60); renderEditor(); break;
      case 'e-day': { const d = Number(el.dataset.d), i = S.editor.days.indexOf(d); if (i >= 0) S.editor.days.splice(i, 1); else S.editor.days.push(d); renderEditor(); break; }
      case 'e-cancel': S.editor = null; renderEditor(); break;
      case 'e-del': S.alarms = S.alarms.filter((x) => x.id !== S.editor.id); S.editor = null; saveAlarms(); renderAlarms(); break;
      case 'e-save': {
        const e = S.editor;
        if (e.id) { const a2 = S.alarms.find((x) => x.id === e.id); if (a2) Object.assign(a2, { h: e.h, m: e.m, days: [...e.days], on: true }); }
        else S.alarms.push({ id: 'a' + Date.now().toString(36), h: e.h, m: e.m, days: [...e.days], on: true });
        S.editor = null; saveAlarms(); renderAlarms(); break;
      }
      // Kệ tạm
      case 'shelf-open': api.shelfOpen(el.dataset.id); break;
      case 'shelf-del': api.shelfDel(el.dataset.id); break;
      case 'shelf-clear': api.shelfClear(); break;
      // Bảng tạm
      case 'clip-paste': api.clipPaste(el.dataset.id); break;
      case 'clip-pin': api.clipPin(el.dataset.id); break;
      case 'clip-del': api.clipDel(el.dataset.id); break;
      case 'clip-clear': api.clipClear(); break;
      case 'clip-q-clear': { const q = $('#clipQ'); q.value = ''; S.clipQ = ''; $('#clipQx').classList.remove('on'); renderClip(); break; }
      // Điều khiển
      case 'ct-timer': case 'ct-sw': S.ctPanel = a === 'ct-timer' ? 'timer' : 'sw'; store.set('ctPanel', S.ctPanel); renderIcRow(); renderTimer(); renderSW(); break;
      case 'ct-dnd': S.flags.dnd = !S.flags.dnd; api.toggle('dnd', S.flags.dnd); renderIcRow(); break;
      case 'ct-awake': S.flags.awake = !S.flags.awake; api.toggle('awake', S.flags.awake); renderIcRow(); break;
      // Hẹn giờ / bấm giờ
      case 't-plus': timerAdjust(60); break;
      case 't-toggle':
        if (T.running) { T.remaining = timerRemaining(); T.running = false; }
        else { if (T.remaining <= 0) T.remaining = T.total; T.endTs = Date.now() + T.remaining * 1000; T.running = true; }
        renderTimer(); renderCompact(); applyLayout(); break;
      case 't-reset': T.running = false; T.remaining = T.total; renderTimer(); renderCompact(); applyLayout(); break;
      case 'sw-toggle':
        if (S.sw.running) { S.sw.base = swElapsed(); S.sw.running = false; } else { S.sw.start = performance.now(); S.sw.running = true; }
        renderSW(); break;
      case 'sw-lap':
        if (S.sw.running) S.sw.laps.push(swElapsed()); else { S.sw.base = 0; S.sw.laps = []; }
        renderSW(); renderLaps(); break;
      // Chuông
      case 'ring-stop': stopRing(); break;
      case 'ring-restart':
        T.remaining = T.total; T.endTs = Date.now() + T.total * 1000; T.running = true;
        stopRing(); renderTimer(); renderCompact(); break;
      case 'ring-snooze':
        if (S.ring && S.ring.kind === 'timer') { T.remaining = 300; T.endTs = Date.now() + 300000; T.running = true; stopRing(); renderTimer(); renderCompact(); break; }
        if (S.ring && S.ring.kind === 'water') S.waterNext = Date.now() + S.water.snooze * 60000;
        else S.snoozes.push({ ts: Date.now() + 5 * 60000 });
        stopRing(); break;
    }
  }

  let repTimer = null, repDelay = null;
  function stopRepeat() { clearTimeout(repDelay); clearInterval(repTimer); repDelay = repTimer = null; }
  document.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest('[data-rep]');
    if (!el) return;
    const a = el.dataset.act;
    act(a, el);
    stopRepeat();
    repDelay = setTimeout(() => { repTimer = setInterval(() => act(a, el), 70); }, 380);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((e) => document.addEventListener(e, stopRepeat));
  window.addEventListener('blur', stopRepeat);

  document.addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tb');
    if (tab) { setTab(tab.dataset.tab); return; }
    if (ev.target.closest('[data-rep]')) return;
    if (ev.target.closest('#mBar') || ev.target.closest('.sl') || ev.target.closest('#ruler')) return;
    // Công tắc báo thức / nút con trong hàng ưu tiên hơn hàng cha
    const inner = ev.target.closest('.sw[data-act], .acts button[data-act], .note button[data-act], .sh-item .rm[data-act]');
    const el = inner || ev.target.closest('[data-act]');
    if (el) act(el.dataset.act, el);
  });

  // Cuộn chuột: chỉnh giờ/phút báo thức, hoặc kéo thước hẹn giờ
  document.addEventListener('wheel', (ev) => {
    const col = ev.target.closest('.col[data-col]');
    if (col && S.editor) {
      ev.preventDefault();
      const dir = ev.deltaY < 0 ? 1 : -1;
      if (col.dataset.col === 'h') S.editor.h = wrap(S.editor.h + dir, 24); else S.editor.m = wrap(S.editor.m + dir, 60);
      renderEditor();
      return;
    }
    if (ev.target.closest('#ruler') && !S.timer.running) {
      ev.preventDefault();
      timerAdjust(ev.deltaY < 0 ? 60 : -60);
    }
  }, { passive: false });

  document.addEventListener('contextmenu', (ev) => { ev.preventDefault(); api.menu(); });

  /* ----- Gõ chữ: cho cửa sổ nhận bàn phím tạm thời ----- */
  let typingTimer = null;
  document.addEventListener('focusin', (ev) => {
    if (!ev.target.matches('input')) return;
    clearTimeout(typingTimer);
    if (!S.typing) { S.typing = true; api.typing(true); applyLayout(); }
  });
  document.addEventListener('focusout', (ev) => {
    if (!ev.target.matches('input')) return;
    if (ev.target.id === 'wMsg') saveWaterMsg();
    typingTimer = setTimeout(() => {
      if (document.activeElement && document.activeElement.matches('input')) return;
      S.typing = false; api.typing(false);
      if (!S.hoverRaw) collapseSoon(300);
    }, 120);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.matches('input')) {
      if (ev.target.id === 'noteIn' || ev.target.id === 'noteAt') addNote();
      if (ev.target.id === 'wMsg') ev.target.blur();
      if (ev.target.id === 'clipQ') ev.target.blur();
    }
    if (ev.key === 'Escape' && ev.target.matches('input')) ev.target.blur();
  });
  $('#clipQ').addEventListener('input', (ev) => { S.clipQ = ev.target.value; $('#clipQx').classList.toggle('on', !!S.clipQ); renderClip(); });

  /* ================= Khởi động ================= */
  $('#calIco').innerHTML = ICON.calendar;
  $('#calPrev').innerHTML = ICON.left;
  $('#calNext').innerHTML = ICON.right;
  $('#calTodayBtn').innerHTML = ICON.clock;
  $('#alarmAddBtn').innerHTML = ICON.plus;
  $('#clipClearBtn').innerHTML = ICON.minusCircle;
  $('#shelfClearBtn').innerHTML = ICON.minusCircle;
  $('#clipQx').innerHTML = ICON.xCircle;
  $('#noteAddBtn').innerHTML = ICON.plus;
  $('#wSave').innerHTML = ICON.check;
  $('#tPlus').innerHTML = ICON.plus;
  $('#tReset').innerHTML = ICON.reset;
  buildSl($('#slEvery'), 'Nhắc mỗi');
  buildSl($('#slVol'), 'Âm lượng');
  buildSl($('#slBri'), 'Độ sáng');
  buildRuler();
  api.clipGet();
  api.shelfGet();
  scheduleWater();
  setTab(S.tab);
  applyLayout();
  setInterval(tick, 100);

  if (window.__DI_TEST) window.__di = { S, startRing, stopRing, act, renderAll, applyLayout, setTab, renderCompact, renderMusic, renderOut, renderVol, renderBri, setAccent, renderClip, renderShelf, showNotice, holidayOf, diffDevices };
})();
