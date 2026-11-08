// Chạy cầu nối (exe Rust trong native/ hoặc script PowerShell trong scripts/): mỗi dòng stdout là một JSON,
// lệnh gửi qua stdin, mỗi lệnh một dòng.
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
const core = require('./core');

function spawnBridge(label, cmd, args, onLine, onExit) {
  let proc;
  try {
    proc = spawn(cmd, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) { core.log('spawn', label, e.message); return null; }
  readline.createInterface({ input: proc.stdout }).on('line', onLine);
  proc.stderr.on('data', (d) => core.log(label, 'stderr:', String(d).slice(0, 300)));
  proc.stdin.on('error', () => {});
  proc.on('error', (e) => core.log(label, 'error:', e.message));
  proc.on('exit', (code) => { core.log(label, 'exit', code); onExit(); });
  return proc;
}
function spawnPS(file, args, onLine, onExit) {
  const script = path.join(core.ROOT, 'scripts', file);
  return spawnBridge(file, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], onLine, onExit);
}
// Cầu nối Rust: bản đang phát triển ở native/target/release/ (ưu tiên, luôn mới nhất), bản đóng gói ở bin/
function nativeExe(name) {
  for (const p of [path.join(core.ROOT, 'native', 'target', 'release', name + '.exe'), path.join(core.ROOT, 'bin', name + '.exe')]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function stopProc(p) { try { if (p) p.kill(); } catch (_) {} }
function writeProc(p, line) { try { if (p && p.stdin.writable) p.stdin.write(line + '\n'); } catch (_) {} }

// Cầu nối Rust có bản PowerShell dự phòng: exe thoát ngay (dưới 10 giây) 3 lần liền thì chuyển sang PowerShell.
// opts: { name, ps, args, psArgs, onLine, onExit(proc dùng exe?) }. Trả về hàm start() tạo tiến trình mới.
function withFallback(opts) {
  let fails = 0;
  return function start() {
    const exe = fails < 3 ? nativeExe(opts.name) : null;
    const startedAt = Date.now();
    const onExit = () => {
      if (exe && Date.now() - startedAt < 10000 && ++fails >= 3) core.log(`${opts.name} lỗi liên tục, chuyển sang ${opts.ps}`);
      opts.onExit(!!exe && fails < 3);
    };
    const proc = exe
      ? spawnBridge(opts.name, exe, opts.args || [], opts.onLine, onExit)
      : spawnPS(opts.ps, opts.psArgs || [], opts.onLine, onExit);
    if (proc) core.log(opts.label + ':', exe ? `${opts.name} (Rust)` : opts.ps);
    return proc;
  };
}

module.exports = { spawnBridge, spawnPS, nativeExe, stopProc, writeProc, withFallback };
