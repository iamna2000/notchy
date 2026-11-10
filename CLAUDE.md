# Quy tắc làm việc cho Claude

Phần 1 dùng chung, chép sang app mới được. Phần 2 riêng cho Notchy.

## 1. Quy tắc chung

### Giao tiếp
- Trả lời bằng tiếng Việt, ngắn gọn, nói rõ cái gì đã làm, cái gì chưa làm, cái gì chưa kiểm tra được.
- Tên tệp, lệnh, khóa cài đặt để trong `code`. Không dùng emoji trong giao diện lẫn tài liệu.

### Mã nguồn
- Chú thích trong mã viết tiếng Việt có dấu, giải thích **vì sao** (nhất là lỗi đã gặp, con số đã đo), không kể lại mã làm gì.
- Sửa đúng phạm vi được yêu cầu. Thấy việc khác đáng làm thì đề xuất, không tự làm.
- Chèn đoạn mã dài hoặc nhiều dấu nháy: ghi ra tệp rồi chạy script Node, không nhồi vào một dòng lệnh shell (dễ hỏng trích dẫn, mất dấu `\` trong biểu thức chính quy).
- Không giữ lại mã chẩn đoán tạm thời (log, tự chụp màn hình) sau khi sửa xong lỗi.

### Git và phát hành
- Chỉ commit, push, phát hành khi người dùng yêu cầu. Phát hành, xóa bản phát hành hay tag trên GitHub là việc công khai: hỏi trước nếu yêu cầu chưa nói rõ.
- Commit message: tiếng Việt **không dấu**, một dòng tiêu đề + gạch đầu dòng chi tiết, kết thúc bằng dòng `Co-Authored-By`.
- Số phiên bản theo semver và chỉ tăng (tự cập nhật không nhận số nhỏ hơn bản đang cài). Sửa lỗi: tăng số cuối; tính năng mới: tăng số giữa.
- Ghi chú phát hành: câu đầu ngắn, viết cho người dùng đọc (app hiện câu này khi báo có bản mới); sau đó các mục **Sửa lỗi**, **Cải thiện**, **Cập nhật**. Chỉ ghi điều có thật trong bản đó.

### Kiểm tra trước khi báo xong
- Chạy toàn bộ test sau mỗi thay đổi; tính năng mới có ít nhất một test giao diện.
- Thay đổi giao diện: chụp ảnh màn hình và tự xem lại. Hoạt ảnh: chụp chuỗi khung hình liên tiếp để thấy từng nhịp (lỗi như khe hở, nhịp trống chỉ lộ ra ở đây).
- Lỗi phụ thuộc thao tác thật của hệ điều hành (kéo thả, focus, phím tắt toàn cục): đo bằng nhật ký và tái hiện bằng chuột thật nếu được phép, không đoán. Nói rõ khi chưa kiểm được bằng thao tác thật.
- Không đọc dữ liệu riêng của người dùng (bảng tạm, ghi chú) trừ khi cần để sửa lỗi; nhật ký không chứa nội dung riêng.

### Giao diện
- Một bộ màu cho cả app: mục đang chọn dùng nền xám trung tính; xanh lá = đang bật / nút chính; cam = cập nhật, lưu ý; đỏ = xóa, thoát.
- Chữ phụ tương phản ít nhất 4,5:1 (trên nền tối dùng `#8e8e93` trở lên, không dùng `#636366` cho chữ); cỡ chữ nhỏ nhất 11px; vùng bấm ít nhất 28–32px; nút không ẩn hẳn chờ rê chuột.
- Không dùng điều khiển mặc định của trình duyệt khi nó lệch tông (ví dụ `<input type="time">` của Chromium): tự làm.
- Thao tác xóa cần đường lui (hoàn tác hoặc xác nhận).
- Tôn trọng `prefers-reduced-motion`.

### Hiệu năng (Electron, cửa sổ trong suốt)
- Không làm hoạt ảnh bằng `filter: blur()` trên vùng lớn; dùng `opacity` + `transform`.
- Không ghi vào DOM khi giá trị không đổi (vòng lặp chạy nhiều lần mỗi giây).
- Không dùng `requestAnimationFrame` cho vẽ liên tục (chạy theo tần số quét, màn 200 Hz là 200 lần/giây); dùng hẹn giờ ~30 lần/giây.
- Dừng hoạt ảnh lặp khi phần chứa nó đang ẩn.

## 2. Riêng Notchy

### Chạy và kiểm thử
- Chạy bản phát triển: `chay.bat` (mở qua `launch.vbs`). `thoat.bat` không tắt được bản đang chạy từ mã nguồn: dừng các tiến trình có đường dẫn nằm trong thư mục dự án.
- App đang chạy khóa `native/target/release/*.exe`: tắt app trước khi `cargo build`, mở lại sau.
- Test: `npm test` (logic), `npm run test:ui` (viên thuốc + Cài đặt với dữ liệu giả), `npm run test:rust`; `npm run test:all` chạy cả ba.
- Chụp viên thuốc: dùng Electron `capturePage` với `test/fixtures/pill-preload.js` (công cụ chụp màn hình không bắt được cửa sổ trong suốt luôn nằm trên cùng).

### Những điều đã trả giá mới biết
- Cửa sổ viên thuốc tạo với `focusable: false`: bấm vào ô nhập thì sự kiện `focusin` không chạy. Phải xin bàn phím ngay khi `pointerdown` (`api.typing(true)`), rồi focus lại ô khi cửa sổ nhận focus.
- **Không đổi `setIgnoreMouseEvents` trong lúc `webContents.startDrag`**: Windows huỷ phiên kéo (đo được: chết sau ~430 ms / 84 ms). Đóng băng `pollCursor` tới khi nhả chuột.
- Phiên nhạc của Windows (SMTC) không đồng nghĩa có tiếng: chỉ nhận ứng dụng đang phát ra âm thanh thật (đo bằng WASAPI trong `di-media`).
- Thay đổi chiều cao bảng phải sửa cả `viewH()` trong `renderer/app.js` cho khớp CSS, không thì nội dung bị cắt.
- Mã mục trong Cài đặt (`hide`, `about`…) giữ nguyên khi đổi tên hiển thị: có chỗ mở thẳng vào mục bằng mã.

### Phát hành
- `phat-hanh.bat`: build Rust, chạy test, tăng phiên bản, đóng gói, đăng GitHub Releases, commit + push. Cần `gh` đã đăng nhập.
- Sau khi đăng: kiểm tra `releases/latest` trỏ đúng bản mới và `latest.yml` có đúng số phiên bản.
- Dữ liệu người dùng ở `%APPDATA%\dynamic-island-windows` (giữ tên cũ để không mất cài đặt); nhật ký ở `log.txt` trong đó.
