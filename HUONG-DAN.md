# Dynamic Island cho Windows (bản 3.2)

## Cách chạy
1. Giải nén đè lên thư mục `dynamic-island` cũ (không phải tải lại Electron).
2. Bấm đúp **`chay.bat`**. Cửa sổ đen sẽ tự đóng ngay sau khi app mở, **đóng hay không đóng cửa sổ này đều không ảnh hưởng app** (app chạy độc lập qua `launch.vbs`). Chạy lại `chay.bat` sẽ tự tắt bản cũ và nạp bản mới.
3. Từ lần sau app tự chạy khi bật máy, không cần mở `chay.bat` nữa.

**Biểu tượng khay hệ thống** (góc phải taskbar): viên thuốc trắng. App tự đặt cờ "luôn hiện" cho icon trên Windows 11. Nếu vẫn chưa thấy:
- Bấm mũi tên **^** rồi kéo icon ra ngoài taskbar.
- Windows 11: Cài đặt > Cá nhân hóa > Thanh tác vụ > *Các biểu tượng khác ở góc thanh tác vụ*, bật mục tên **Electron** (hoặc Dynamic Island).
- **Không cần khay vẫn dùng được**: bấm **chuột phải ngay trên viên thuốc** để mở menu (ẩn/hiện, tự ẩn, khởi động cùng Windows, nhật ký, Thoát).
- Gửi mình file `%APPDATA%\dynamic-island-windows\log.txt`, các dòng có chữ `tray` cho biết Windows đã tạo icon hay chưa.

## Tự ẩn khi có cửa sổ phóng to
Khi trình duyệt (hay bất kỳ app nào) đang phóng to / toàn màn hình và nằm dưới viên thuốc, viên thuốc **thu thành một vạch đen nhỏ ở giữa mép trên màn hình** (để biết app vẫn đang chạy) và không che tên tab. Muốn gọi ra: **đưa chuột lên sát mép trên màn hình, ngay vị trí giữa, giữ khoảng 0,3 giây**. Rời chuột đi thì tự ẩn lại. Báo thức/hẹn giờ đang đổ chuông vẫn hiện bình thường. Tắt tính năng này ở menu khay hệ thống. Game Direct3D toàn màn hình thì ẩn hẳn.

## Giao diện (theo ảnh mẫu)
Thanh icon phía trên: **Nhạc · Nhắc uống nước · Lịch** (bên trái, số là ngày hôm nay) và **Báo thức · Bảng tạm · Kệ tạm · Điều khiển** (bên phải).
- **Nhạc**: ảnh bìa, tên bài (**chữ chạy ngang khi đang phát**, cả ở dạng thu gọn lẫn khi mở), tua nhạc bằng cách **kéo** thanh tiến trình, phát ngẫu nhiên, nút thiết bị phát (thanh âm lượng + chọn loa/tai nghe).
- **Nhắc uống nước**: kéo thanh "Nhắc mỗi" để chọn 15–120 phút (kéo về 0 là tắt, mặc định đang tắt), kéo trên dải vạch để chọn khung giờ, chỉnh nội dung nhắc.
- **Lịch**: dải 7 ngày kèm âm lịch; kéo thanh nhỏ dưới dải (hoặc bấm vào) để mở cả tháng. Thêm ghi chú cho từng ngày, có thể kèm giờ nhắc.
- **Báo thức**: như bản trước.
- **Bảng tạm**: nhớ 50 đoạn văn bản chép gần nhất. Bấm vào một mục để dán ngay vào ô bạn đang gõ. Có tìm kiếm, ghim (biểu tượng đánh dấu), xóa. Nội dung từ trình quản lý mật khẩu thường được bỏ qua (làm tốt nhất có thể, không đảm bảo 100%).
- **Kệ tạm** (mới): kéo tệp hoặc thư mục từ Explorer lên viên thuốc, đảo tự mở sang tab này, thả tệp vào. Khi cần, **kéo từ kệ thả sang ứng dụng khác** (Zalo, Mail, Chrome...). Bấm vào một tệp để mở thư mục chứa nó, bấm dấu x để bỏ khỏi kệ. Kệ chỉ nhớ đường dẫn, không sao chép hay xóa tệp thật; nếu tệp gốc bị di chuyển/xóa thì tự biến mất khỏi kệ.
- **Điều khiển**: âm lượng, độ sáng (chỉ laptop), hẹn giờ (kéo thước), bấm giờ, Không làm phiền (tắt thông báo Windows), Giữ máy luôn thức.

## Thông báo ngắn trên viên thuốc (mới)
Viên thuốc tự nở ra khoảng 4 giây khi:
- Vừa cắm sạc, hoặc pin xuống còn 20% / 10% (chỉ laptop).
- Một tệp vừa tải xong vào thư mục **Downloads** (bỏ qua tệp tạm .crdownload, .part...).
- Có thiết bị âm thanh mới xuất hiện (tai nghe, loa Bluetooth, tai nghe cắm dây).

**Hẹn giờ hết giờ**: hiện thêm nút **Bắt đầu lại** và **+5 phút**.
**Lịch**: đánh dấu ngày lễ (dương lịch và âm lịch, gồm Tết Nguyên Đán, Giỗ Tổ, Trung Thu...) bằng chấm đỏ và dòng "Lễ" bên dưới ngày được chọn.

## Thoát app
Chuột phải biểu tượng ở khay hệ thống chọn **Thoát**, hoặc `Ctrl + Alt + Q`, hoặc chạy `thoat.bat`.

## Nếu có lỗi
- Nhật ký lỗi: `%APPDATA%\dynamic-island-windows\log.txt` (có nút mở nhanh trong menu khay).
- Nhạc không hiện ảnh bìa: phát bài, chờ vài giây (app tự thử lại tối đa ~40 giây). Nếu vẫn không có, gửi mình dòng chứa `thumb` trong nhật ký.
