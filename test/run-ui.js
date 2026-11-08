// Chạy test/ui-smoke.js bằng Electron. Bỏ ELECTRON_RUN_AS_NODE (terminal của VS Code thường đặt biến này,
// khiến Electron chạy như Node và không mở được cửa sổ).
const { spawnSync } = require('child_process');
const path = require('path');
const electron = require('electron'); // đường dẫn tới electron.exe
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const r = spawnSync(electron, [path.join(__dirname, 'ui-smoke.js')], { stdio: 'inherit', env });
process.exit(r.status == null ? 1 : r.status);
