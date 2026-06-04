# QR Dynamic Redirect System

## Mục tiêu
Thiết kế ưu tiên trải nghiệm và độ tin cậy của người dùng cuối. Toàn bộ mã QR đều sử dụng domain chính của doanh nghiệp thay vì subdomain hoặc domain kỹ thuật để tăng mức độ nhận diện thương hiệu và giảm rủi ro người dùng nghi ngờ URL không chính thống.

Xây dựng hệ thống QR động trên Cloudflare cho phép:

* Một mã QR tương ứng với một ID ngắn.
* URL đích có thể thay đổi mà không cần in lại QR.
* Thống kê số lượt quét.
* Chi phí thấp, có thể chạy hoàn toàn trên gói Free của Cloudflare.
* Dễ mở rộng khi số lượng QR và lượt truy cập tăng.

---

## Cấu trúc URL

Sử dụng định dạng:

```text
https://domain.com/qr?id=abc
```

Ví dụ:

```text
https://domain.com/qr?id=a1
https://domain.com/qr?id=b2
https://domain.com/qr?id=c3
```

Lý do lựa chọn:

* Dễ hiểu.
* Dễ mở rộng thêm tham số trong tương lai.
* Không cần thay đổi URL khi nâng cấp hạ tầng.
* Có thể sử dụng ID ngắn 4–6 ký tự để giảm mật độ QR.

---

## Kiến trúc hệ thống

```text
QR
 ↓
Cloudflare Worker
 ├─ KV (tra cứu URL đích)
 └─ D1 (ghi log thống kê)
 ↓
302 Redirect
 ↓
Website đích
```

---

## KV Storage

KV chỉ dùng cho mục đích redirect.

Ví dụ:

```text
abc -> https://pinsacduphong.com
xyz -> https://google.com
```

Worker:

```js
const targetUrl = await env.REDIRECTS.get(id);

if (!targetUrl) {
  return new Response("Not found", { status: 404 });
}

return Response.redirect(targetUrl, 302);
```

Ưu điểm:

* Đọc rất nhanh.
* Độ trễ thấp.
* Phù hợp với bài toán key → value.
* Không cần truy vấn SQL khi redirect.

---

## D1 Database

D1 chỉ dùng cho thống kê và lịch sử quét.

### Bảng qr_logs

```sql
CREATE TABLE qr_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qr_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    country TEXT,
    user_agent TEXT
);
```

### Ghi log

Sử dụng `ctx.waitUntil()` để không làm chậm redirect:

```js
ctx.waitUntil(
  env.DB.prepare(`
    INSERT INTO qr_logs
    (qr_id, created_at, country, user_agent)
    VALUES (?, ?, ?, ?)
  `)
  .bind(
    id,
    Date.now(),
    request.cf?.country || null,
    request.headers.get("User-Agent")
  )
  .run()
);
```

---

## Thống kê

### Tổng số lượt quét

```sql
SELECT COUNT(*)
FROM qr_logs
WHERE qr_id = ?;
```

### Top QR được quét nhiều nhất

```sql
SELECT
    qr_id,
    COUNT(*) AS total
FROM qr_logs
GROUP BY qr_id
ORDER BY total DESC
LIMIT 20;
```

### Lượt quét theo ngày

```sql
SELECT
    DATE(created_at / 1000, 'unixepoch') AS day,
    COUNT(*) AS total
FROM qr_logs
GROUP BY day
ORDER BY day DESC;
```

---

## Dashboard

Dashboard sẽ:

1. Lấy danh sách QR từ KV.
2. Lấy thống kê từ D1.
3. Hiển thị:

   * ID QR.
   * URL đích.
   * Tổng lượt quét.
   * Thống kê theo ngày.

Không cần bảng `qr_codes` trong giai đoạn đầu.

---

## Tại sao không lưu bộ đếm trong KV

Không sử dụng KV làm counter vì:

* Có giới hạn ghi trên cùng một key.
* Có thể xảy ra race condition khi nhiều người quét cùng lúc.
* Không phù hợp cho thống kê chính xác.

Thay vào đó:

* KV chỉ lưu `id -> URL`.
* D1 lưu từng lượt quét.

---

## Khả năng mở rộng

### Giai đoạn 1 (Free)

```text
KV
 └─ id -> URL

D1
 └─ qr_logs
```

Phù hợp với:

* Hàng nghìn QR.
* Hàng nghìn lượt quét mỗi ngày.

### Giai đoạn 2

Khi số lượng QR rất lớn:

```text
D1
 ├─ qr_codes
 └─ qr_logs

KV
 └─ cache URL
```

Lúc này:

* D1 quản lý dữ liệu chính.
* KV làm cache để tăng tốc redirect.

### Giai đoạn 3

Nâng cấp lên gói trả phí nếu cần:

* D1 Paid.
* KV Paid.
* Durable Objects.
* Hoặc hệ quản trị cơ sở dữ liệu khác.

URL QR vẫn giữ nguyên:

```text
https://domain.com/qr?id=abc
```

Không cần thay đổi hoặc in lại mã QR.

---

## Nguyên tắc thiết kế

1. KV chỉ dùng cho redirect.
2. D1 chỉ dùng cho thống kê.
3. Redirect phải nhanh và độc lập với thống kê.
4. Không lưu counter trong KV.
5. Luôn giữ nguyên định dạng URL QR để dễ mở rộng trong tương lai.

## Lý do sử dụng đường dẫn `/qr/` trên domain chính

Hệ thống sử dụng định dạng:

```text
https://domain.com/qr/?id=example
```

thay vì:

```text
https://qr.domain.com/?id=example
```

hoặc:

```text
https://example.workers.dev/?id=example
```

### Mục tiêu

Tăng độ tin cậy đối với người dùng cuối khi quét mã QR.

Hiện nay nhiều ứng dụng quét QR sẽ hiển thị URL trước khi mở. Người dùng thường chỉ quan sát tên miền chính để quyết định có tiếp tục truy cập hay không.

Ví dụ:

```text
https://domain.com/qr/?id=example
```

Người dùng dễ nhận biết đây là tên miền chính thức của doanh nghiệp.

Trong khi đó các URL dạng:

```text
https://qr.domain.com
https://example.workers.dev
```

có thể làm giảm mức độ tin tưởng đối với một số người dùng không am hiểu kỹ thuật.

### Kiến trúc triển khai

Website hiện tại vẫn hoạt động bình thường trên cùng domain:

```text
domain.com/                -> Website chính
domain.com/login           -> Website chính
domain.com/admin           -> Website chính
domain.com/api/*           -> Website chính

domain.com/qr/*            -> QR Redirect Service
```

Cloudflare Worker chỉ xử lý các request thuộc đường dẫn:

```text
/qr/*
```

Tất cả các request còn lại tiếp tục được chuyển tới hệ thống hiện có (Nginx, Java, Tomcat, Spring Boot, v.v.).

### Lợi ích

* Giữ nguyên thương hiệu trên URL.
* Tăng độ tin cậy khi khách hàng quét QR.
* Không làm thay đổi kiến trúc website hiện tại.
* Có thể sử dụng Cloudflare Worker, KV và D1 mà người dùng không nhận thấy sự khác biệt.
* Dễ mở rộng trong tương lai mà không cần thay đổi hoặc in lại mã QR.

### Nguyên tắc bất biến

Định dạng URL QR được xem là API công khai của hệ thống:

```text
https://domain.com/qr/?id=<QR_ID>
```

Backend có thể thay đổi theo thời gian:

```text
KV -> D1 -> Cache -> Database khác
```

nhưng URL của khách hàng luôn giữ nguyên để đảm bảo tính tương thích lâu dài.

