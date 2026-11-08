# Phát hành Notchy cho bạn bè

- **Repo:** https://github.com/iamna2000/notchy (công khai)
- **Link gửi bạn bè:** https://github.com/iamna2000/notchy/releases/latest

Bạn bè chỉ cần cài một lần bằng file `Notchy-Setup-x.y.z.exe`. Sau đó app tự kiểm tra bản mới trên GitHub:
- Lúc mở app và mỗi 4 giờ, app kiểm tra và tự tải ngầm bản mới.
- Tải xong, viên thuốc báo "Có bản mới x.y.z".
- Người dùng chuột phải viên thuốc, chọn **Cập nhật lên x.y.z**. Nếu không chọn, bản mới tự cài lúc tắt app hoặc tắt máy.
- Cài đặt, ghi chú và bảng tạm được giữ nguyên qua các lần cập nhật.

## Mỗi lần ra bản mới

1. **Sửa xong code, chạy thử bằng `chay.bat`** như bình thường.
2. **Bấm đúp `phat-hanh.bat`:**
   - Chọn **1** nếu là sửa lỗi (3.2.0 → 3.2.1), **2** nếu là tính năng mới (3.2.0 → 3.3.0).
   - Gõ một dòng mô tả ngắn. Bạn bè sẽ thấy dòng này trên trang phát hành.
   - Script tự làm các bước còn lại: build cầu nối Rust, tăng số phiên bản, đóng gói, đăng lên GitHub, rồi commit và push.

Máy bạn bè nhận bản mới khi mở lại app, hoặc trong vòng 4 giờ.

Chỉ muốn tạo file cài đặt để thử, chưa đăng lên GitHub: chạy `npm run dist`. File nằm trong thư mục `dist/`.

## Gửi bạn bè lần đầu

Gửi link https://github.com/iamna2000/notchy/releases/latest. Bạn bè tải file `Notchy-Setup-x.y.z.exe` ở mục *Assets* về rồi bấm đúp để cài.

App chưa có chữ ký số nên lần cài đầu Windows sẽ hiện **"Windows đã bảo vệ PC của bạn"**. Bấm **Thông tin thêm > Vẫn chạy**. Các lần tự cập nhật sau không hỏi lại.

Sau khi cài:
- App có trong menu Start, tự chạy khi bật máy và tự kiểm tra cập nhật.
- Gỡ app ở Cài đặt > Ứng dụng > Notchy.

## Ghi chú

- `phat-hanh.bat` dùng tài khoản GitHub đã đăng nhập trong GitHub CLI (`gh`). Nếu đăng nhập hết hạn, chạy `gh auth login --web`.
- Bản cài đặt dùng chung thư mục dữ liệu với bản chạy bằng `chay.bat` (`%APPDATA%\dynamic-island-windows`). Hai bản không chạy cùng lúc được, bản mở sau sẽ tự thoát.
- Nếu muốn nhận cập nhật tự động như bạn bè, bạn cũng có thể cài bản `.exe` lên máy mình. Khi đó hãy dùng bản cài đặt thay cho `chay.bat`.
- Nhật ký cập nhật: các dòng `update:` trong `%APPDATA%\dynamic-island-windows\log.txt`.

## Cấu trúc mã nguồn

| Phần | Nằm ở | Việc |
|---|---|---|
| Tiến trình chính | `main.js` | Cửa sổ viên thuốc, tự ẩn, phím tắt, cầu nối nhạc, khay hệ thống, khởi động |
| | `lib/core.js` | Nhật ký, đọc / ghi cài đặt, gửi tin cho viên thuốc |
| | `lib/prefs.js` | Chuẩn hóa cài đặt (hàm thuần, có test) |
| | `lib/settings-window.js` | Cửa sổ Cài đặt, khôi phục mặc định, báo lỗi, giới thiệu |
| | `lib/weather.js`, `clip.js`, `shelf.js`, `stats.js`, `thumbs.js`, `updater.js`, `bridges.js` | Thời tiết, bảng tạm, kệ tạm, tab Hệ thống, ảnh bìa, tự cập nhật, chạy cầu nối |
| Giao diện | `renderer/app.js` | Viên thuốc |
| | `renderer/wx-logic.js` | Logic thời tiết: cảnh báo, mặc gì, lưu ý (có test) |
| | `renderer/settings.*` | Cửa sổ Cài đặt |
| Cầu nối Rust | `native/src/media.rs` → `di-media.exe` | Nhạc, ảnh bìa, cửa sổ che, tab, toàn màn hình |
| | `native/src/sys.rs` → `di-sys.exe` | Âm lượng, thiết bị phát, mạng (thay `system.ps1`: khoảng 10 MB thay vì 70 MB RAM) |

Hai script PowerShell `scripts/media.ps1` và `scripts/system.ps1` vẫn được giữ làm dự phòng. Nếu exe Rust thoát ngay 3 lần liền thì app tự dùng lại chúng.

## Kiểm thử

- `npm test`: kiểm thử chuẩn hóa cài đặt và logic thời tiết (chạy trong vài phần mười giây).
- `npm run test:ui`: mở viên thuốc và cửa sổ Cài đặt ẩn với dữ liệu giả, đi qua mọi trang, báo lỗi JavaScript. Không đụng tới cài đặt thật.
- `npm run test:rust`: kiểm thử phần Rust (đọc tọa độ dò, làm gọn tên tab, nhận diện livestream).
- `npm run test:all`: chạy cả ba.

`phat-hanh.bat` tự chạy cả ba trước khi đăng bản mới. Có lỗi thì dừng và không đăng.
