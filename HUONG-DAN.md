# Notchy cho Windows (bản 1.0)

## Cách chạy
1. Giải nén đè lên thư mục `dynamic-island` cũ (không phải tải lại Electron).
2. Bấm đúp **`chay.bat`**. Cửa sổ đen sẽ tự đóng ngay sau khi app mở, **đóng hay không đóng cửa sổ này đều không ảnh hưởng app** (app chạy độc lập qua `launch.vbs`). Chạy lại `chay.bat` sẽ tự tắt bản cũ và nạp bản mới.
3. Từ lần sau app tự chạy khi bật máy, không cần mở `chay.bat` nữa.

**Biểu tượng khay hệ thống** (góc phải taskbar): viên thuốc trắng. App tự đặt cờ "luôn hiện" cho icon trên Windows 11. Nếu vẫn chưa thấy:
- Bấm mũi tên **^** rồi kéo icon ra ngoài taskbar.
- Windows 11: Cài đặt > Cá nhân hóa > Thanh tác vụ > *Các biểu tượng khác ở góc thanh tác vụ*, bật mục tên **Electron** (hoặc Notchy).
- **Không cần khay vẫn dùng được**: bấm **chuột phải ngay trên viên thuốc** để mở menu gọn (Cài đặt…, ẩn/hiện, Thoát).

## Cài đặt
Chuột phải viên thuốc > **Cài đặt…** (hoặc bấm đúp icon khay, hoặc bánh răng trên viên thuốc). Cài đặt chỉ mở khi bạn chọn; mở Notchy từ menu Start khi app đang chạy chỉ hiện lại viên thuốc. Cửa sổ theo chế độ sáng / tối của Windows. Gồm:
- **Chung**: khởi động cùng Windows, ẩn/hiện viên thuốc, chọn màn hình, **trang mặc định** khi mở viên thuốc và **sau bao lâu thì quay về** trang đó (1 / 5 / 15 phút hoặc không bao giờ), **chọn tab hiện** trên thanh icon, **phím tắt mở viên thuốc** (mặc định Ctrl+Alt+Space; máy đã có app khác dùng tổ hợp này thì tự chuyển sang Ctrl+Shift+Space hoặc Alt+Shift+N). Mở bằng phím tắt: bảng đầy đủ hiện ra kể cả khi đang tự ẩn; **Esc** hoặc nhấn lại để đóng, không rê chuột vào thì tự đóng sau 10 giây.
- **Tự ẩn**: 3 chế độ: **Luôn hiện**, **Ẩn khi che tab trình duyệt**, **Ẩn khi có cửa sổ bên dưới** (ngay / sau 5 / 10 giây không dùng); bật/tắt thu thành vạch khi có ứng dụng toàn màn hình.
- **Thời tiết**: đơn vị **°C / °F**; **nhiều địa điểm** (tối đa 8): vị trí hiện tại đoán theo mạng (tắt được) cộng các thành phố tự thêm bằng cách gõ tên; chọn **địa điểm chính** (hiện nhiệt độ trên viên thuốc), đổi thứ tự, xóa.
- **Thông báo**: bật/tắt từng loại (tải xong tệp, ảnh chụp màn hình, thiết bị âm thanh, pin, bản cập nhật).
- **Bảng tạm & Kệ tạm**: xóa lịch sử, **số mục nhớ** (20/50/100/200), **tạm dừng ghi** (khi chép mật khẩu, OTP; cũng có nút ⏸ trên trang Bảng tạm), **không lưu lịch sử xuống đĩa** (chỉ giữ trong bộ nhớ đến khi tắt app), dọn kệ, ảnh chụp màn hình vào kệ, mở thư mục dữ liệu và nhật ký lỗi.
- **Cập nhật & thông tin**: phiên bản, kiểm tra / cài bản mới, **tạo báo lỗi** (tệp thông tin ra Desktop, không chứa bảng tạm / ghi chú, kèm mở trang báo lỗi GitHub), **khôi phục cài đặt mặc định** (giữ dữ liệu), khởi động lại, thoát.
- Gửi mình file `%APPDATA%\dynamic-island-windows\log.txt`, các dòng có chữ `tray` cho biết Windows đã tạo icon hay chưa.

## Tự ẩn khi có cửa sổ phóng to
Khi trình duyệt (hay bất kỳ app nào) đang phóng to / toàn màn hình và nằm dưới viên thuốc, viên thuốc **thu thành một vạch đen nhỏ ở giữa mép trên màn hình** (để biết app vẫn đang chạy) và không che tên tab. Muốn gọi ra: **đưa chuột lên sát mép trên màn hình, ngay vị trí giữa, giữ khoảng 0,3 giây**. Rời chuột đi thì tự ẩn lại. Nhắc ghi chú đang đổ chuông vẫn hiện bình thường. Đổi chế độ ở Cài đặt > Tự ẩn. Chế độ **Ẩn khi che tab trình duyệt**: viên thuốc hiện liên tục, chỉ thu thành vạch khi đang che đúng một tab của Chrome/Edge/Brave/Cốc Cốc/Firefox hoặc Explorer (ví dụ nhiều tab tràn ra giữa màn hình). Ít tab, giữa dải tab trống thì vẫn hiện; mở hay đóng tab thì phản ứng sau khoảng 1 giây. **Toàn màn hình thì luôn thu thành vạch** (ở mọi chế độ, kể cả khi tắt tự ẩn; gọi ra bằng cách đưa chuột lên mép trên như trên): xem video toàn màn hình (YouTube, Netflix… trên trình duyệt, VLC), trình chiếu PowerPoint, F11 trên trình duyệt, game cửa sổ không viền. Thoát toàn màn hình thì viên thuốc hiện lại ngay. Game Direct3D toàn màn hình độc quyền thì ẩn hẳn. Cửa sổ chỉ phóng to thường (còn thấy taskbar) thì vẫn theo chế độ tự ẩn ở trên. Nhắc ghi chú đổ chuông vẫn hiện.

## Giao diện (theo ảnh mẫu)
**Kích thước**: Cài đặt > Viên thuốc > Kích thước, chọn Nhỏ / Vừa / Lớn / Rất lớn. Cả viên thuốc (chữ, icon, các bảng) phóng theo cùng tỉ lệ, áp dụng ngay.

**Rê chuột**: viên thuốc chỉ phản ứng khi chuột dừng trong vùng của nó khoảng 0,15 giây, nên lướt qua để bấm tab trình duyệt không làm bảng bung ra (bấm vào thì mở ngay). Tab đang xem có nền sáng; **bánh răng** ở cuối thanh tab mở Cài đặt. Khi laptop chạy pin, hiệu ứng làm mờ lúc mở / đóng bảng tự tắt để đỡ tốn pin.

Thanh icon phía trên: **Nhạc · Thời tiết · Lịch** (bên trái, số là ngày hôm nay) và **Bảng tạm · Kệ tạm · Hệ thống** (bên phải). Rời viên thuốc quá **1 phút** thì lần mở sau tự về lại tab **Nhạc** (trang mặc định); quay lại trong vòng 1 phút thì vẫn giữ tab đang xem. Đổi trang mặc định và thời gian ở Cài đặt > Chung.
- **Nhạc**: ảnh bìa, tên bài (**chữ chạy ngang khi đang phát**, cả ở dạng thu gọn lẫn khi mở), tua nhạc bằng cách **kéo** thanh tiến trình, phát ngẫu nhiên, nút thiết bị phát (thanh âm lượng + chọn loa/tai nghe). **YouTube trên trình duyệt** (video lẻ, YouTube không cho Windows chuyển bài): nút bài sau tự chuyển nhanh sang tab YouTube, bấm Shift+N rồi trả lại tab và cửa sổ bạn đang dùng (màn hình nháy khoảng 0,3 giây). Nút bài trước tua về đầu bài nếu đã nghe quá 3 giây, nếu không thì bấm Shift+P (chỉ có tác dụng trong danh sách phát). Khi đang chơi game hay ứng dụng toàn màn hình thì không làm gì, để không bị văng khỏi game.
- **Hệ thống**: CPU, RAM, GPU, mạng theo thời gian thực, xem lại 1 phút / 10 phút / 1 giờ.
- **Lịch**: dải 7 ngày kèm âm lịch; kéo thanh nhỏ dưới dải (hoặc bấm vào) để mở cả tháng. Thêm ghi chú cho từng ngày, có thể kèm giờ nhắc.
- **Thời tiết** (thay cho Báo thức), từ trên xuống. Nút mũi tên cạnh "Dự báo 7 ngày" chuyển giữa **gọn** (1 lưu ý quan trọng nhất, dải 7 ngày nhỏ) và **đầy đủ**; app nhớ chế độ đang chọn. Có từ 2 địa điểm thì hàng chip trên cùng để chuyển địa điểm (lăn chuột để xem thêm, nút + mở Cài đặt); bấm tên địa điểm cũng mở Cài đặt. Không đoán được vị trí qua mạng thì trang này có nút **Chọn địa điểm**:
  - **Hiện tại**: icon thời tiết có chuyển động nhẹ, nhiệt độ, cao/thấp trong ngày, cảm giác thực, độ ẩm, gió.
  - **Lưu ý** (tối đa 3 dòng): luôn có *mặc gì hôm nay* (sau 19h là ngày mai), cộng tối đa 2 điều quan trọng nhất: thời tiết cực đoan hôm nay/ngày mai, hoặc ngày nào trong tuần có hiện tượng nguy hiểm hay nhiệt độ đổi đột ngột (từ 5° trở lên). Dòng đỏ là nguy hiểm, cam là cần chú ý. Tuần yên ổn thì báo "thời tiết ổn định".
  - **Dự báo 7 ngày**: rê chuột lên một ngày để xem lượng mưa, gió giật, UV. Ngày có thời tiết cực đoan được viền cam/đỏ.
  - Ngưỡng nóng/rét theo cách gọi của Trung tâm Dự báo KTTV quốc gia: nắng nóng khi cao nhất ≥35°, gay gắt ≥37°; rét đậm khi nhiệt độ trung bình ngày ≤15°, rét hại ≤13°. Ngoài ra có mưa to (≥20 mm), gió giật mạnh (≥50 km/h), dông sét, UV cao, sương mù.
  - Các báo thức cũ không còn được dùng.
- **Bảng tạm**: nhớ 50 đoạn văn bản chép gần nhất. Bấm vào một mục để chép lại vào clipboard (không tự dán); dòng đó phát sáng xanh kèm chữ "Đã chép" để biết đã nhận. Có tìm kiếm (trong ô tìm: **↑/↓** chọn mục, **Enter** chép, **Esc** xóa chữ đã gõ), ghim (biểu tượng đánh dấu), xóa. Nội dung từ trình quản lý mật khẩu thường được bỏ qua (làm tốt nhất có thể, không đảm bảo 100%). Viên thuốc dài theo số mục (tối đa khoảng 6 mục rồi cuộn).
- **Kệ tạm** (một hàng ảnh/tệp cuộn ngang, lăn chuột để xem thêm; tiêu đề ghi số tệp và tổng dung lượng; khi có từ 4 tệp, nút mũi tên cạnh nút xóa mở kệ thành lưới 5 cột, tối đa 3 hàng rồi cuộn dọc, bấm lại để thu về một hàng. App nhớ chế độ đang chọn): kéo tệp hoặc thư mục từ Explorer lên viên thuốc, đảo tự mở sang tab này, thả tệp vào. Khi cần, **kéo từ kệ thả sang ứng dụng khác** (Zalo, Mail, Chrome...). Bấm vào một tệp để mở thư mục chứa nó, bấm dấu x để bỏ khỏi kệ. Kệ chỉ nhớ đường dẫn, không sao chép hay xóa tệp thật; nếu tệp gốc bị di chuyển/xóa thì tự biến mất khỏi kệ. **Ảnh chụp màn hình** (Win+Shift+S, PrtScn) tự lên đầu kệ kèm thông báo nhỏ, kéo thẳng sang Zalo/Messenger... không cần mở thư mục Screenshots. Kệ giữ 10 ảnh chụp gần nhất; tắt ở Cài đặt > Bảng tạm & Kệ tạm. Cần bật tự lưu ảnh của Snipping Tool (mặc định đã bật trên Windows 11).

## Thông báo ngắn trên viên thuốc (mới)
Viên thuốc tự nở ra khoảng 4 giây khi:
- Vừa cắm sạc, hoặc pin xuống còn 20% / 10% (chỉ laptop).
- Một tệp vừa tải xong vào thư mục **Downloads** (bỏ qua tệp tạm .crdownload, .part...).
- Có thiết bị âm thanh mới xuất hiện (tai nghe, loa Bluetooth, tai nghe cắm dây).

Nhiều thông báo đến cùng lúc (chụp liền 2 ảnh, tải xong nhiều tệp) thì **xếp hàng** hiện lần lượt, góc phải ghi **+N** là số đang chờ; thông báo đến lúc bạn đang dùng bảng sẽ hiện khi bạn rời chuột. Rê chuột vào thông báo *Đã thêm vào Kệ tạm* là mở thẳng Kệ tạm.

**Nhắc ghi chú**: khi chuông đổ, bấm **Báo lại sau 5 phút** hoặc **Xong**. Lịch báo lại được nhớ cả khi tắt app; máy ngủ qua giờ thì nhắc ngay khi thức dậy (ghi "trễ").

**Lịch**: đánh dấu ngày lễ (dương lịch và âm lịch, gồm Tết Nguyên Đán, Giỗ Tổ, Trung Thu...) bằng chấm đỏ và dòng "Lễ" bên dưới ngày được chọn.

## Thoát app
Chuột phải biểu tượng ở khay hệ thống chọn **Thoát**, hoặc `Ctrl + Alt + Q`, hoặc chạy `thoat.bat`.

## Nếu có lỗi
- Nhật ký lỗi: `%APPDATA%\dynamic-island-windows\log.txt` (Cài đặt > Bảng tạm & Kệ tạm > Mở nhật ký).
- Nhạc không hiện ảnh bìa: phát bài, chờ vài giây (app tự thử lại tối đa ~40 giây). Nếu vẫn không có, gửi mình dòng chứa `thumb` trong nhật ký.
