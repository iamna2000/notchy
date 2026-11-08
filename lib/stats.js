// Tab Hệ thống + cầu nối âm lượng / thiết bị phát / mạng (di-sys, dự phòng system.ps1).
// Ghi nền liên tục để biểu đồ có lịch sử thật: mỗi 2 giây (1 giây khi tab đang mở), giữ 1 giờ gần nhất.
// CPU/RAM: Node; GPU: nvidia-smi chạy liên tục (-lms); mạng: lệnh 'net' của di-sys;
// độ trễ: thời gian bắt tay TCP tới 1.1.1.1:443 (không cần quyền ICMP, không phụ thuộc ngôn ngữ).
const { ipcMain } = require('electron');
const os = require('os');
const net = require('net');
const readline = require('readline');
const { spawn } = require('child_process');
const core = require('./core');
const { stopProc, writeProc, withFallback } = require('./bridges');

// ----- Cầu nối âm lượng / thiết bị phát / mạng -----
let sysProc = null;
const startSysProc = withFallback({
  name: 'di-sys', ps: 'system.ps1', label: 'sys bridge',
  onLine: (line) => {
    let m;
    try { m = JSON.parse(line); } catch (_) { return; }
    if (m.type === 'net') onNet(m); else core.send('sys', m);
  },
  onExit: () => { sysProc = null; }, // bật lại khi cần (lệnh tiếp theo hoặc lượt đo mạng)
});
function ensureSys() {
  if (sysProc || process.platform !== 'win32' || core.quitting) return;
  sysProc = startSysProc();
}

// ----- Đo hệ thống -----
const HIST_MS = 3600 * 1000;
const stats = {
  on: false, live: false, timer: null, gpuProc: null, gpu: null, gpuOk: true, cpuPrev: null, netPrev: null,
  down: null, up: null, ping: null, pingAt: 0,
  hist: { t: [], cpu: [], ram: [], gpu: [], down: [], up: [] },
};
function cpuTimes() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) { const t = c.times; idle += t.idle; total += t.user + t.nice + t.sys + t.idle + t.irq; }
  return { idle, total };
}
function onNet(m) {
  const now = Date.now(), p = stats.netPrev;
  if (p && now > p.at && m.rx >= p.rx && m.tx >= p.tx) {
    const dt = (now - p.at) / 1000;
    stats.down = (m.rx - p.rx) / dt; stats.up = (m.tx - p.tx) / dt;
  }
  stats.netPrev = { rx: m.rx, tx: m.tx, at: now };
}
function startGpu() {
  if (stats.gpuProc || !stats.gpuOk || process.platform !== 'win32') return;
  let p;
  try {
    p = spawn('nvidia-smi', ['--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total,power.draw',
      '--format=csv,noheader,nounits', '-lms', '1000'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { stats.gpuOk = false; return; }
  p.on('error', () => { stats.gpuOk = false; stats.gpu = null; stats.gpuProc = null; }); // không có card NVIDIA
  readline.createInterface({ input: p.stdout }).on('line', (line) => {
    const v = line.split(',').map((s) => parseFloat(s));
    if (v.length >= 4 && !isNaN(v[0])) stats.gpu = { util: v[0], temp: isNaN(v[1]) ? null : v[1], memUsed: v[2], memTotal: v[3], power: isNaN(v[4]) ? null : v[4] };
  });
  p.on('exit', () => { if (stats.gpuProc === p) stats.gpuProc = null; });
  stats.gpuProc = p;
}
function measurePing() {
  const t0 = process.hrtime.bigint();
  const s = net.connect({ host: '1.1.1.1', port: 443 });
  const done = (ms) => { stats.ping = ms; s.destroy(); };
  s.setTimeout(1500, () => done(null));
  s.once('connect', () => done(Number(process.hrtime.bigint() - t0) / 1e6));
  s.once('error', () => done(null));
}
function statsTick() {
  const now = Date.now();
  const c = cpuTimes(), p = stats.cpuPrev;
  const cpu = p && c.total > p.total ? Math.max(0, Math.min(1, 1 - (c.idle - p.idle) / (c.total - p.total))) : null;
  stats.cpuPrev = c;
  ensureSys(); writeProc(sysProc, 'net');
  if (now - stats.pingAt >= (stats.live ? 2000 : 10000)) { stats.pingAt = now; measurePing(); }
  if (stats.gpuOk && !stats.gpuProc) startGpu(); // nvidia-smi bị tắt ngang thì bật lại
  const total = os.totalmem(), ramUsed = total - os.freemem(), g = stats.gpu;
  // Ghi lịch sử (giá trị 0..1, mạng là byte/giây), bỏ phần cũ hơn 1 giờ
  const h = stats.hist;
  h.t.push(now); h.cpu.push(cpu); h.ram.push(ramUsed / total); h.gpu.push(g ? g.util / 100 : null);
  h.down.push(stats.down); h.up.push(stats.up);
  let cut = 0;
  while (cut < h.t.length && h.t[cut] < now - HIST_MS) cut++;
  if (cut) Object.values(h).forEach((a) => a.splice(0, cut));
  if (stats.live) {
    core.send('stats', {
      t: now, cpu, cores: os.cpus().length, ramUsed, ramTotal: total,
      gpu: g, down: stats.down, up: stats.up, ping: stats.ping,
    });
  }
}
function statsLoop() {
  try { statsTick(); } catch (e) { core.log('stats:', e.message); }
  stats.timer = setTimeout(statsLoop, stats.live ? 1000 : 2000);
}
function startStats() {
  if (stats.on) return;
  stats.on = true; stats.cpuPrev = cpuTimes();
  startGpu();
  ensureSys(); writeProc(sysProc, 'net');
  stats.timer = setTimeout(statsLoop, 1000);
}
function stopStats() {
  stats.on = false;
  clearTimeout(stats.timer); stats.timer = null;
  stopProc(stats.gpuProc); stats.gpuProc = null;
  stopProc(sysProc);
}
// Tab Hệ thống mở: gửi toàn bộ lịch sử một lần rồi cập nhật mỗi giây; đóng: quay về ghi nền 2 giây
function setStatsLive(on) {
  if (!stats.on) startStats();
  stats.live = !!on;
  if (on) {
    core.send('statsHist', stats.hist);
    clearTimeout(stats.timer); statsLoop();
  }
}

function registerIpc() {
  ipcMain.on('stats', (_e, on) => setStatsLive(on));
  ipcMain.on('sys-cmd', (_e, cmd) => {
    if (typeof cmd !== 'string' || !/^(get|devices|mute|vol:[01](\.\d+)?|dev:[\w\-.{}]{1,200})$/.test(cmd)) return;
    ensureSys();
    writeProc(sysProc, cmd);
  });
}

module.exports = { startStats, stopStats, registerIpc };
