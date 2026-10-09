# Đội Hình Theo Ấn (TFT Set 18)

Chọn 1–4 ấn để nhận gợi ý các đội hình mạnh nhất có thể đạt được, kèm tướng nên cầm ấn.

## Mở trang

Cách nhanh nhất: bấm đúp file **`Mo app.bat`** ở thư mục gốc. Nó bật server và tự mở http://localhost:5173.
Giữ cửa sổ đen đó mở trong lúc dùng app; đóng nó thì link localhost sẽ không vào được nữa.

Hoặc chạy server rồi mở http://localhost:5173:

```bash
node tools/serve.mjs
```

## Cập nhật dữ liệu khi có bản mới

```bash
node tools/update.mjs
```

Lệnh này tải lại: tướng / tộc hệ / ấn / icon (CommunityDragon), đội hình meta (TFT Academy) và
số liệu trận xếp hạng **bản hiện tại** từ MetaTFT (Bạch Kim trở lên, 3 ngày gần nhất): tướng theo số sao,
từng mốc tộc/hệ, tướng cầm từng ấn. seemeta chỉ còn dùng dự phòng. Đã đối chiếu MetaTFT với tactics.tools: lệch dưới 0,1 hạng.

## Kiểm tra tự động các gợi ý

```bash
node tools/audit.cjs
```

Chạy qua mọi ấn đơn lẻ và một mẫu tổ hợp 2, 3, 4 ấn ở cấp 8 và 9 (khoảng 15 phút; `FULL=1` để chạy hết như trước), báo các lỗi như ấn không có người cầm,
người cầm vượt 3 món đồ, thiếu tank, tướng vượt giá theo cấp, sai số ô.

Kiểm tra cách đếm tộc/hệ của tướng có cơ chế đặc biệt (vd Rồng Ngàn Tuổi tính 2 Quái Rừng) bằng đội thật:

```bash
node tools/check-counts.cjs
```

## Có nên đập ấn (Búa Rèn) không?

```bash
node tools/reforge.cjs 9 "Tiên Linh" "Mặt Trăng" "Thuật Sĩ"
```

Thay từng ấn bằng mỗi ấn khác, so điểm đội tốt nhất trước/sau khi đập.

## Chạy thử thuật toán trong terminal

```bash
node tools/test-solver.cjs "Ấn Hoa Linh" "Ấn Thuật Sư"
```

## Các file

| File | Nội dung |
|---|---|
| `web/index.html` | Giao diện |
| `web/solver.js` | Thuật toán gợi ý. Các con số chỉnh được nằm ở đầu file |
| `web/data.js` | Dữ liệu set, do `build-data.mjs` tạo ra |
| `tools/build-data.mjs` | Tải dữ liệu. Danh sách tộc/hệ tính là tank nằm ở đầu file |

## Cách thuật toán chấm điểm

Mọi thứ chấm cùng một kiểu: lấy hạng trung bình thật (MetaTFT), mẫu nhỏ kéo về mức trung bình
(như trộn thêm 500 ván), dưới 300 ván thì không dùng; rồi thưởng theo chính số liệu đó
(tốt +2, ngang trung bình +1, kéo tụt hạng 0).

- **Mốc tộc/hệ:** hạng TB của đội dừng ở đúng mốc đó; mốc cao không bao giờ kém mốc thấp hơn của cùng tộc/hệ.
  Mốc chủ lực tính đủ, các mốc sau giảm dần (×0,6, ×0,4, ×0,3…). Mốc dư tướng (vd 3/2) bị phạt.
- **Cả đội:** so với 59 kiểu đội thật của MetaTFT (bản hiện tại); giống kiểu nào thì cộng/trừ theo hạng TB của kiểu đó.
  Đội không giống kiểu thật nào được coi là trung bình (có ấn thì đội thường khác các kiểu phổ biến).
- **Tướng:** hạng TB của tướng, chỉ tính ván ở 1–2 sao (không reroll khi chơi theo ấn), cộng thêm ưu tiên tướng đắt.
  Đồ có hạn: chỉ 3 tướng hàng trước + 3 tướng hàng sau mạnh nhất (cầm đồ) tính đủ; tướng còn lại là tướng kích mốc,
  chỉ tính 30% số liệu riêng — giá trị của họ nằm ở mốc họ kích.
- **Cân hàng:** hàng sau (tướng đánh xa, không phải tank) tối đa 4 (3 tướng sát thương + 1 chỗ cho Lux).
- **Tướng cầm ấn:** hạng TB khi tướng đó cầm đúng ấn đó, so với hạng TB chung của ấn. Chỉ tính khi ấn lên được mốc.
- **Ấn không lên mốc (phí ấn):** bị phạt; đội có ấn phí tối đa hạng B.
- **Tank:** mỗi tank được cộng điểm (càng nhiều tank càng tốt), không có số tối thiểu.
- **Tộc/hệ lơ lửng** (có tướng nhưng chưa lên mốc, vd 1/2) bị trừ điểm: mỗi tướng thêm vào nên ghép đôi được với tướng đã có.
- Luật cứng: cấp 7 tối đa tướng 3 vàng, cấp 8 tối đa 4 vàng; đủ carry đắt; không có tướng không kích tộc/hệ nào.
- Các con số chỉnh được nằm ở đầu `web/solver.js`.

## Chia sẻ và tự cập nhật

- App đưa lên Cloudflare Pages (thư mục `web`), bạn bè chỉ cần mở link.
- `.github/workflows/cap-nhat-so-lieu.yml` chạy mỗi ngày lúc 3 giờ sáng (giờ Việt Nam): tải số liệu mới, tính lại thang điểm, chạy `tools/regress.cjs`. Đạt thì lưu vào kho và Cloudflare tự đưa bản mới lên link; không đạt thì giữ bản cũ.
- Chạy tay: GitHub → tab Actions → "Cập nhật số liệu" → Run workflow.
- `web/_headers` bắt trình duyệt hỏi lại máy chủ mỗi lần mở, nên không bị kẹt bản cũ.
