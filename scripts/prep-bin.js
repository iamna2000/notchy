// Chuẩn bị trước khi đóng gói: chép các exe Rust (di-media, di-sys) vào bin/ để đưa vào bản cài đặt.
// Thiếu exe thì dừng: build trước bằng "cargo build --release" trong thư mục native.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
for (const name of ['di-media', 'di-sys']) {
  const src = path.join(root, 'native', 'target', 'release', name + '.exe');
  const dst = path.join(root, 'bin', name + '.exe');
  if (!fs.existsSync(src)) {
    console.error(`Thieu ${src}. Hay build: cd native && cargo build --release`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`Da chep ${name}.exe vao bin/`);
}
