// Chuẩn bị trước khi đóng gói: chép di-media.exe (Rust) vào bin/ để đưa vào bản cài đặt.
// Thiếu exe thì dừng: build trước bằng "cargo build --release" trong thư mục native.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'native', 'target', 'release', 'di-media.exe');
const dst = path.join(root, 'bin', 'di-media.exe');
if (!fs.existsSync(src)) {
  console.error('Thieu ' + src + '\nHay build: cd native && cargo build --release');
  process.exit(1);
}
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log('Da chep di-media.exe vao bin/');
