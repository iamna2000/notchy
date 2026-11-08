# Phát hành Notchy cho bạn bè

Bạn bè chỉ cần cài một lần bằng file `Notchy-Setup-x.y.z.exe`. Sau đó app tự kiểm tra bản mới trên GitHub:
- Lúc mở app và mỗi 4 giờ, app kiểm tra và tự tải ngầm bản mới.
- Tải xong, viên thuốc báo "Có bản mới x.y.z".
- Người dùng chuột phải viên thuốc, chọn **Cập nhật lên x.y.z**. Nếu không chọn, bản mới tự cài lúc tắt app hoặc tắt máy.
- Cài đặt, ghi chú và bảng tạm được giữ nguyên qua các lần cập nhật.

## Chuẩn bị (làm một lần)

1. **Tạo repo trên GitHub:** đăng nhập GitHub, tạo repo **Public** tên `notchy`.
2. **Điền tên tài khoản:** mở `package.json`, thay `TEN_GITHUB_CUA_BAN` bằng tên tài khoản GitHub của bạn.
3. **Đẩy mã nguồn lên repo.** Repo phải có ít nhất một commit thì mới tạo được bản phát hành:
   ```
   git remote add origin https://github.com/<ten-ban>/notchy.git
   git push -u origin master
   ```
4. **Tạo token** để máy bạn được quyền đăng bản phát hành:
   - Vào GitHub > Settings > Developer settings > Personal access tokens > **Fine-grained tokens** > Generate new token.
   - Repository access: chỉ chọn repo `notchy`.
   - Permissions > Repository > **Contents: Read and write**.
   - Lưu token vào biến môi trường (chỉ làm một lần, mở lại terminal sau khi chạy):
     ```
     setx GH_TOKEN "github_pat_xxx..."
     ```
   - Không gửi token cho ai, và không đưa token vào mã nguồn.

## Mỗi lần ra bản mới

1. **Sửa xong code, chạy thử bằng `chay.bat`** như bình thường.
2. **Nếu có sửa `native/`:** build lại cầu nối Rust.
   ```
   cd native
   cargo build --release
   cd ..
   ```
3. **Tăng số phiên bản**, nếu không thì máy bạn bè sẽ không nhận ra có bản mới:
   ```
   npm version patch --no-git-tag-version
   ```
   - `patch` cho sửa lỗi: 3.2.0 → 3.2.1.
   - `minor` cho tính năng mới: 3.2.0 → 3.3.0.
4. **Đóng gói và đăng lên GitHub:**
   ```
   npm run release
   ```
   Lệnh này tạo bản phát hành `v3.2.1` trên GitHub, kèm file cài đặt và `latest.yml`. Máy bạn bè nhận bản này trong vòng 4 giờ, hoặc ngay khi mở lại app.
5. **Commit và push** mã nguồn như thường lệ.

Chỉ muốn tạo file cài đặt để thử, chưa đăng lên GitHub: chạy `npm run dist`. File nằm trong thư mục `dist/`.

## Gửi bạn bè lần đầu

Gửi link `https://github.com/<ten-ban>/notchy/releases/latest`, hoặc gửi thẳng file `Notchy-Setup-x.y.z.exe`.

App chưa có chữ ký số nên lần cài đầu Windows sẽ hiện **"Windows đã bảo vệ PC của bạn"**. Bấm **Thông tin thêm > Vẫn chạy**. Các lần tự cập nhật sau không hỏi lại.

Sau khi cài:
- App có trong menu Start, tự chạy khi bật máy và tự kiểm tra cập nhật.
- Gỡ app ở Cài đặt > Ứng dụng > Notchy.

## Ghi chú

- Bản cài đặt dùng chung thư mục dữ liệu với bản chạy bằng `chay.bat` (`%APPDATA%\dynamic-island-windows`). Hai bản không chạy cùng lúc được, bản mở sau sẽ tự thoát.
- Nếu muốn nhận cập nhật tự động như bạn bè, bạn cũng có thể cài bản `.exe` lên máy mình. Khi đó hãy dùng bản cài đặt thay cho `chay.bat`.
- Nhật ký cập nhật: các dòng `update:` trong `%APPDATA%\dynamic-island-windows\log.txt`.
