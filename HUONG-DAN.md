# Notchy cho Windows (bản 3.2)

## Cách chạy
1. Giải nén đè lên thư mục `dynamic-island` cũ (không phải tải lại Electron).
2. Bấm đúp **`chay.bat`**. Cửa sổ đen sẽ tự đóng ngay sau khi app mở, **đóng hay không đóng cửa sổ này đều không ảnh hưởng app** (app chạy độc lập qua `launch.vbs`). Chạy lại `chay.bat` sẽ tự tắt bản cũ và nạp bản mới.
3. Từ lần sau app tự chạy khi bật máy, không cần mở `chay.bat` nữa.

**Biểu tượng khay hệ thống** (góc phải taskbar): viên thuốc trắng. App tự đặt cờ "luôn hiện" cho icon trên Windows 11. Nếu vẫn chưa thấy:
- Bấm mũi tên **^** rồi kéo icon ra ngoài taskbar.
- Windows 11: Cài đặt > Cá nhân hóa > Thanh tác vụ > *Các biểu tượng khác ở góc thanh tác vụ*, bật mục tên **Electron** (hoặc Notchy).
- **Không cần khay vẫn dùng được**: bấm **chuột phải ngay trên viên thuốc** để mở menu (ẩn/hiện, tự ẩn, khởi động cùng Windows, nhật ký, Thoát).
- Gửi mình file `%APPDATA%\dynamic-island-windows\log.txt`, các dòng có chữ `tray` cho biết Windows đã tạo icon hay chưa.

## Tự ẩn khi có cửa sổ phóng to
Khi trình duyệt (hay bất kỳ app nào) đang phóng to / toàn màn hình và nằm dưới viên thuốc, viên thuốc **thu thành một vạch đen nhỏ ở giữa mép trên màn hình** (để biết app vẫn đang chạy) và không che tên tab. Muốn gọi ra: **đưa chuột lên sát mép trên màn hình, ngay vị trí giữa, giữ khoảng 0,3 giây**. Rời chuột đi thì tự ẩn lại. Nhắc ghi chú đang đổ chuông vẫn hiện bình thường. Tắt tính năng này ở menu khay hệ thống. Chế độ **Chỉ khi che tab trình duyệt** (menu > Tự ẩn): viên thuốc hiện liên tục, chỉ thu thành vạch khi đang che đúng một tab của Chrome/Edge/Brave/Cốc Cốc/Firefox hoặc Explorer (ví dụ nhiều tab tràn ra giữa màn hình). Ít tab, giữa dải tab trống thì vẫn hiện; mở hay đóng tab thì phản ứng sau khoảng 1 giây. **Toàn màn hình thì luôn thu thành vạch** (ở mọi chế độ, kể cả khi tắt tự ẩn; gọi ra bằng cách đưa chuột lên mép trên như trên): xem video toàn màn hình (YouTube, Netflix… trên trình duyệt, VLC), trình chiếu PowerPoint, F11 trên trình duyệt, game cửa sổ không viền. Thoát toàn màn hình thì viên thuốc hiện lại ngay. Game Direct3D toàn màn hình độc quyền thì ẩn hẳn. Cửa sổ chỉ phóng to thường (còn thấy taskbar) thì vẫn theo chế độ tự ẩn ở trên. Nhắc ghi chú đổ chuông vẫn hiện.

## Giao diện (theo ảnh mẫu)
Thanh icon phía trên: **Nhạc · Thời tiết · Lịch** (bên trái, số là ngày hôm nay) và **Bảng tạm · Kệ tạm · Hệ thống** (bên phải). Rời viên thuốc quá **1 phút** thì lần mở sau tự về lại tab **Nhạc** (trang mặc định); quay lại trong vòng 1 phút thì vẫn giữ tab đang xem.
- **Nhạc**: ảnh bìa, tên bài (**chữ chạy ngang khi đang phát**, cả ở dạng thu gọn lẫn khi mở), tua nhạc bằng cách **kéo** thanh tiến trình, phát ngẫu nhiên, nút thiết bị phát (thanh âm lượng + chọn loa/tai nghe). **YouTube trên trình duyệt** (video lẻ, YouTube không cho Windows chuyển bài): nút bài sau tự chuyển nhanh sang tab YouTube, bấm Shift+N rồi trả lại tab và cửa sổ bạn đang dùng (màn hình nháy khoảng 0,3 giây). Nút bài trước tua về đầu bài nếu đã nghe quá 3 giây, nếu không thì bấm Shift+P (chỉ có tác dụng trong danh sách phát). Khi đang chơi game hay ứng dụng toàn màn hình thì không làm gì, để không bị văng khỏi game.
- **Hệ thống**: CPU, RAM, GPU, mạng theo thời gian thực, xem lại 1 phút / 10 phút / 1 giờ.
- **Lịch**: dải 7 ngày kèm âm lịch; kéo thanh nhỏ dưới dải (hoặc bấm vào) để mở cả tháng. Thêm ghi chú cho từng ngày, có thể kèm giờ nhắc.
- **Thời tiết** (thay cho Báo thức), từ trên xuống. Nút mũi tên cạnh "Dự báo 7 ngày" chuyển giữa **gọn** (1 lưu ý quan trọng nhất, dải 7 ngày nhỏ) và **đầy đủ**; app nhớ chế độ đang chọn:
  - **Hiện tại**: icon thời tiết có chuyển động nhẹ, nhiệt độ, cao/thấp trong ngày, cảm giác thực, độ ẩm, gió.
  - **Lưu ý** (tối đa 3 dòng): luôn có *mặc gì hôm nay* (sau 19h là ngày mai), cộng tối đa 2 điều quan trọng nhất: thời tiết cực đoan hôm nay/ngày mai, hoặc ngày nào trong tuần có hiện tượng nguy hiểm hay nhiệt độ đổi đột ngột (từ 5° trở lên). Dòng đỏ là nguy hiểm, cam là cần chú ý. Tuần yên ổn thì báo "thời tiết ổn định".
  - **Dự báo 7 ngày**: rê chuột lên một ngày để xem lượng mưa, gió giật, UV. Ngày có thời tiết cực đoan được viền cam/đỏ.
  - Ngưỡng nóng/rét theo cách gọi của Trung tâm Dự báo KTTV quốc gia: nắng nóng khi cao nhất ≥35°, gay gắt ≥37°; rét đậm khi nhiệt độ trung bình ngày ≤15°, rét hại ≤13°. Ngoài ra có mưa to (≥20 mm), gió giật mạnh (≥50 km/h), dông sét, UV cao, sương mù.
  - Các báo thức cũ không còn được dùng.
- **Bảng tạm**: nhớ 50 đoạn văn bản chép gần nhất. Bấm vào một mục để chép lại vào clipboard (không tự dán); dòng đó phát sáng xanh kèm chữ "Đã chép" để biết đã nhận. Có tìm kiếm, ghim (biểu tượng đánh dấu), xóa. Nội dung từ trình quản lý mật khẩu thường được bỏ qua (làm tốt nhất có thể, không đảm bảo 100%). Viên thuốc dài theo số mục (tối đa khoảng 6 mục rồi cuộn).
- **Kệ tạm** (một hàng ảnh/tệp cuộn ngang, lăn chuột để xem thêm; tiêu đề ghi số tệp và tổng dung lượng; khi có từ 4 tệp, nút mũi tên cạnh nút xóa mở kệ thành lưới 5 cột, tối đa 3 hàng rồi cuộn dọc, bấm lại để thu về một hàng. App nhớ chế độ đang chọn): kéo tệp hoặc thư mục từ Explorer lên viên thuốc, đảo tự mở sang tab này, thả tệp vào. Khi cần, **kéo từ kệ thả sang ứng dụng khác** (Zalo, Mail, Chrome...). Bấm vào một tệp để mở thư mục chứa nó, bấm dấu x để bỏ khỏi kệ. Kệ chỉ nhớ đường dẫn, không sao chép hay xóa tệp thật; nếu tệp gốc bị di chuyển/xóa thì tự biến mất khỏi kệ. **Ảnh chụp màn hình** (Win+Shift+S, PrtScn) tự lên đầu kệ kèm thông báo nhỏ, kéo thẳng sang Zalo/Messenger... không cần mở thư mục Screenshots. Kệ giữ 10 ảnh chụp gần nhất; tắt ở menu chuột phải > *Ảnh chụp màn hình vào Kệ tạm*. Cần bật tự lưu ảnh của Snipping Tool (mặc định đã bật trên Windows 11).

## Thông báo ngắn trên viên thuốc (mới)
Viên thuốc tự nở ra khoảng 4 giây khi:
- Vừa cắm sạc, hoặc pin xuống còn 20% / 10% (chỉ laptop).
- Một tệp vừa tải xong vào thư mục **Downloads** (bỏ qua tệp tạm .crdownload, .part...).
- Có thiết bị âm thanh mới xuất hiện (tai nghe, loa Bluetooth, tai nghe cắm dây).

**Lịch**: đánh dấu ngày lễ (dương lịch và âm lịch, gồm Tết Nguyên Đán, Giỗ Tổ, Trung Thu...) bằng chấm đỏ và dòng "Lễ" bên dưới ngày được chọn.

## Thoát app
Chuột phải biểu tượng ở khay hệ thống chọn **Thoát**, hoặc `Ctrl + Alt + Q`, hoặc chạy `thoat.bat`.

## Nếu có lỗi
- Nhật ký lỗi: `%APPDATA%\dynamic-island-windows\log.txt` (có nút mở nhanh trong menu khay).
- Nhạc không hiện ảnh bìa: phát bài, chờ vài giây (app tự thử lại tối đa ~40 giây). Nếu vẫn không có, gửi mình dòng chứa `thumb` trong nhật ký.
