// Ảnh bìa: thu nhỏ + bộ nhớ đệm theo bài.
// Ảnh gốc từ Windows có thể là PNG 30..150 KB trong khi giao diện chỉ hiện 66px: thu về tối đa 240px JPEG
// (~10 KB) cho IPC và giải mã nhẹ. Lưu theo bài (key) trong RAM và trên đĩa (userData/thumbs), xóa sau 1 ngày,
// tối đa 300 ảnh: quay lại bài đã nghe thì có ảnh ngay, không phải chờ đọc lại.
const { nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const core = require('./core');

const THUMB_TTL = 24 * 3600 * 1000, THUMB_MAX = 300, THUMB_PX = 240;
const thumbDir = () => path.join(core.userDir(), 'thumbs');
const thumbMem = new Map(); // key -> { url, at }
const thumbFile = (key) => path.join(thumbDir(), crypto.createHash('sha1').update(key).digest('hex') + '.jpg');

function shrinkThumb(url) {
  try {
    const img = nativeImage.createFromDataURL(url);
    if (img.isEmpty()) return url;
    const { width, height } = img.getSize(), k = THUMB_PX / Math.max(width, height);
    const out = k < 1 ? img.resize({ width: Math.round(width * k), height: Math.round(height * k), quality: 'best' }) : img;
    return 'data:image/jpeg;base64,' + out.toJPEG(88).toString('base64');
  } catch (e) { core.log('thumb shrink:', e.message); return url; }
}
function cacheThumb(key, url) {
  thumbMem.delete(key); thumbMem.set(key, { url, at: Date.now() }); // Map giữ thứ tự chèn: đầu là cũ nhất
  while (thumbMem.size > THUMB_MAX) thumbMem.delete(thumbMem.keys().next().value);
  const b64 = url.slice(url.indexOf(',') + 1);
  fs.promises.mkdir(thumbDir(), { recursive: true })
    .then(() => fs.promises.writeFile(thumbFile(key), Buffer.from(b64, 'base64')))
    .catch((e) => core.log('thumb cache write:', e.message));
}
function cachedThumb(key) {
  const m = thumbMem.get(key);
  if (m && Date.now() - m.at < THUMB_TTL) return m.url;
  try {
    const f = thumbFile(key), st = fs.statSync(f);
    if (Date.now() - st.mtimeMs >= THUMB_TTL) return '';
    const url = 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
    thumbMem.set(key, { url, at: st.mtimeMs });
    return url;
  } catch (_) { return ''; }
}
// Xóa ảnh quá 1 ngày, và bớt ảnh cũ nhất nếu quá THUMB_MAX (chạy lúc mở app và mỗi giờ)
async function pruneThumbs() {
  try {
    const dir = thumbDir();
    const files = await Promise.all((await fs.promises.readdir(dir)).filter((f) => f.endsWith('.jpg'))
      .map(async (f) => ({ f: path.join(dir, f), t: (await fs.promises.stat(path.join(dir, f))).mtimeMs })));
    files.sort((a, b) => b.t - a.t);
    const now = Date.now();
    await Promise.all(files.filter((x, i) => now - x.t >= THUMB_TTL || i >= THUMB_MAX).map((x) => fs.promises.unlink(x.f).catch(() => {})));
  } catch (_) {}
}
// Tin nhắn nhạc từ cầu nối: thu nhỏ ảnh mới và lưu; bài mới chưa có ảnh thì lấy từ bộ nhớ đệm ngay
function processThumb(m) {
  if (m.type !== 'media' || !m.active || !m.key) return;
  if (typeof m.thumb === 'string' && m.thumb.startsWith('data:')) {
    m.thumb = shrinkThumb(m.thumb);
    cacheThumb(m.key, m.thumb);
  } else if (m.thumb === '') {
    const c = cachedThumb(m.key);
    if (c) m.thumb = c;
  }
}

module.exports = { processThumb, pruneThumbs };
