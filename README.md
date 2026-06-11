# QR Dynamic Redirect System

## Mục tiêu
Thiết kế ưu tiên trải nghiệm và độ tin cậy của người dùng cuối. 
Toàn bộ mã QR đều sử dụng domain chính của doanh nghiệp thay vì subdomain hoặc domain kỹ thuật để tăng mức độ nhận diện thương hiệu và giảm rủi ro người dùng nghi ngờ URL không chính thống.

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
https://domain.com/qr?id=<QR_ID>
```

Ví dụ:

```text
https://domain.com/qr?id=app
https://domain.com/qr?id=webapp
https://domain.com/qr?id=partner
https://domain.com/qr?id=web
```

Lý do lựa chọn:

* Dễ hiểu.
* Dễ mở rộng thêm tham số trong tương lai.
* Không cần thay đổi URL khi nâng cấp hạ tầng.
* Có thể sử dụng ID ngắn 4–6 ký tự để giảm mật độ QR.

---

## Kiến trúc hệ thống

### Kiến trúc triển khai giai đoạn đầu

```text
Client
 ↓
https://domain.com/qr?id=<QR_ID>
 ↓
Nginx
 ↓ proxy_pass
https://qr.domain.com?id=<QR_ID>
 ↓
Cloudflare Worker
 ├─ KV
 └─ D1
 ↓
302 Redirect
```
Lý do
* Không cần bật Cloudflare Proxy cho toàn bộ website.
* Không ảnh hưởng hệ thống Java hiện tại.
* Không phải thay đổi cơ chế ghi nhận IP hiện hữu.
* Có thể triển khai QR Service độc lập.
---

### Kiến trúc giai đoạn sau

```text
Client
 ↓
https://domain.com/qr?id=<QR_ID>
 ↓
Cloudflare Worker
 ├─ KV
 └─ D1
 ↓
302 Redirect
```

## KV Storage

KV chỉ dùng cho mục đích redirect.

Ví dụ:

```text
app -> link tải app (https://domain.com/download)
webapp -> link mở webapp (https://app.domain.com)
web -> link website (https://domain.com)
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
    ip TEXT,
    country TEXT,
    user_agent TEXT,
    created_at DATETIME NOT NULL
);

CREATE INDEX idx_qr_logs_qr_id
ON qr_logs(qr_id);

CREATE INDEX idx_qr_logs_created_at
ON qr_logs(created_at);
```
Vì sau này sẽ cần:

* Chống spam quét.
* Đếm unique visitor.
* Phân tích khu vực.
* Debug sự cố.

Ví dụ:
```text
SELECT COUNT(DISTINCT ip)
FROM qr_logs
WHERE qr_id = 'app';
```

### Ghi log

Sử dụng `ctx.waitUntil()` để không làm chậm redirect:

```js
ctx.waitUntil(
  env.DB.prepare(`
    INSERT INTO qr_logs
    (qr_id, ip, country, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)
  .bind(
    id,
    request.headers.get("CF-Connecting-IP"),
    request.cf?.country || null,
    request.headers.get("User-Agent"),
    Date.now()
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
Ghi chú về Free Tier

Cloudflare KV:
- Phù hợp cho redirect tốc độ cao.
- Có giới hạn thao tác ghi mỗi ngày.

Cloudflare D1:
- Phù hợp cho thống kê lượt quét.
- Có giới hạn truy vấn và dung lượng trên gói Free.

 Khi vượt quá giới hạn có thể nâng cấp lên gói trả phí mà không thay đổi URL QR.
 
---

## Dashboard

### Dashboard sẽ:

1. Lấy danh sách QR từ KV.
2. Lấy thống kê từ D1.
3. Hiển thị:

   * ID QR.
   * URL đích.
   * Tổng lượt quét.
   * Thống kê theo ngày.

Không cần bảng `qr_codes` trong giai đoạn đầu.

### Dashboard tương lai

- Quản lý QR.
- Thay đổi URL đích.
- Xem tổng lượt quét.
- Xem lượt quét theo ngày.
- Xem quốc gia truy cập.
- Xem số lượng người dùng duy nhất (unique IP).
- Xuất Excel/CSV.
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
https://domain.com/qr?id=<QR_ID>
```

Không cần thay đổi hoặc in lại mã QR.

---

## Nguyên tắc thiết kế

1. KV chỉ dùng cho redirect.
2. D1 chỉ dùng cho thống kê.
3. Redirect phải nhanh và độc lập với thống kê.
4. Không lưu counter trong KV.
5. Luôn giữ nguyên định dạng URL QR để dễ mở rộng trong tương lai.

## Lý do sử dụng đường dẫn `/qr` trên domain chính

Hệ thống sử dụng định dạng:

```text
https://domain.com/qr?id=<QR_ID>
```

thay vì:

```text
https://qr.domain.com/?id=<QR_ID>
```

hoặc:

```text
https://example.workers.dev/?id=<QR_ID>
```

### Mục tiêu

Tăng độ tin cậy đối với người dùng cuối khi quét mã QR.

Hiện nay nhiều ứng dụng quét QR sẽ hiển thị URL trước khi mở. Người dùng thường chỉ quan sát tên miền chính để quyết định có tiếp tục truy cập hay không.

Ví dụ:

```text
https://domain.com/qrid=<QR_ID>
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

domain.com/qr*            -> QR Redirect Service
```

Cloudflare Worker chỉ xử lý các request thuộc đường dẫn:

```text
/qr*
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
https://domain.com/qr?id=<QR_ID>
```

Backend có thể thay đổi theo thời gian:

```text
KV -> D1 -> Cache -> Database khác
```

nhưng URL của khách hàng luôn giữ nguyên để đảm bảo tính tương thích lâu dài.

# Triển khai Cloudflare Proxy và xử lý IP khách hàng

## Mục tiêu

Sau khi hệ thống QR Dynamic hoạt động ổn định, có thể chuyển toàn bộ website sang Cloudflare Proxy để tận dụng:

* DDoS Protection
* WAF (Web Application Firewall)
* Rate Limiting
* Bot Protection
* Cloudflare Workers
* Ẩn IP thật của máy chủ

---

## Phân biệt DNS Only và Proxied

### DNS Only

```text
A  domain.com  1.2.3.4
Proxy Status: DNS Only
```

Luồng:

```text
Client
 ↓
Server
```

Đặc điểm:

* Cloudflare chỉ làm DNS.
* Không có DDoS Protection.
* Không có WAF.
* Không có Rate Limiting.
* Không có Bot Protection.
* Không chạy được Worker Route trên domain.
* IP thật của server bị lộ.

---

### Proxied

```text
A  domain.com  1.2.3.4
Proxy Status: Proxied
```

Luồng:

```text
Client
 ↓
Cloudflare
 ↓
Server
```

Đặc điểm:

* Có DDoS Protection.
* Có WAF.
* Có Rate Limiting.
* Có Bot Protection.
* Có thể sử dụng Cloudflare Workers.
* IP server được ẩn khỏi Internet.

---

## Kiến trúc sau khi chuyển sang Cloudflare Proxy

```text
Client
   ↓
Cloudflare
   ├─ /qr*        → Worker
   └─ Other Path  → Nginx → Java
```

Ví dụ:

```text
https://domain.com/qr?id=<QR_ID>
```

được xử lý trực tiếp bởi Worker.

Các URL khác:

```text
https://domain.com/
https://domain.com/login
https://domain.com/api/*
```

tiếp tục được chuyển tới hệ thống hiện tại.

---

## Ảnh hưởng tới việc ghi nhận IP

### Trước khi dùng Cloudflare Proxy

Ứng dụng nhận IP từ:

```java
request.getRemoteAddr()
```

hoặc:

```nginx
$remote_addr
```

IP trả về là IP thật của khách hàng.

---

### Sau khi dùng Cloudflare Proxy

IP kết nối tới server sẽ là IP của Cloudflare.

Ví dụ:

```text
172.68.x.x
104.21.x.x
162.159.x.x
```

Do đó không được sử dụng trực tiếp:

```java
request.getRemoteAddr()
```

để xác định IP khách hàng.

---

## Header chứa IP thật

Cloudflare gửi IP thật của khách trong header:

```http
CF-Connecting-IP: 123.123.123.123
```

Ngoài ra còn có:

```http
X-Forwarded-For: 123.123.123.123
```

Ưu tiên sử dụng:

```http
CF-Connecting-IP
```

---

## Hướng dẫn cho Backend Java

Ví dụ:

```java
String clientIp = request.getHeader("CF-Connecting-IP");

if (clientIp == null || clientIp.isBlank()) {
    clientIp = request.getRemoteAddr();
}
```

Khuyến nghị tạo utility chung:

```java
public static String getClientIp(HttpServletRequest request) {
    String ip = request.getHeader("CF-Connecting-IP");

    if (ip == null || ip.isBlank()) {
        ip = request.getRemoteAddr();
    }

    return ip;
}
```

Sau đó toàn bộ hệ thống sử dụng chung phương thức này.

---

## Hướng dẫn cho Spring Boot

Nếu đang dùng Spring Boot phía sau Nginx và Cloudflare:

```properties
server.forward-headers-strategy=framework
```

hoặc:

```properties
server.forward-headers-strategy=native
```

tùy phiên bản Spring Boot.

---

## Hướng dẫn cho Nginx

Cấu hình nhận IP thật từ Cloudflare:

```nginx
real_ip_header CF-Connecting-IP;
```

Sau đó:

```nginx
$remote_addr
```

sẽ trả về IP thật của khách hàng thay vì IP Cloudflare.

Lưu ý cần khai báo danh sách IP Cloudflare trong cấu hình Real IP của Nginx để tránh giả mạo header.

---

## Hướng dẫn cho Cloudflare Worker

Lấy IP khách hàng:

```javascript
const clientIp =
    request.headers.get("CF-Connecting-IP");
```

Ví dụ:

```javascript
const ip = request.headers.get("CF-Connecting-IP");

await env.DB.prepare(`
INSERT INTO qr_logs
(qr_id, ip, created_at)
VALUES (?, ?, ?)
`)
.bind(
    qrId,
    ip,
    Date.now()
)
.run();
```

---

## Checklist trước khi bật Cloudflare Proxy

* Kiểm tra toàn bộ hệ thống có đang sử dụng `request.getRemoteAddr()`.
* Chuyển sang sử dụng `CF-Connecting-IP`.
* Kiểm tra log truy cập.
* Kiểm tra whitelist IP nếu có.
* Kiểm tra firewall server.
* Kiểm tra API giới hạn theo IP.
* Kiểm tra chức năng đăng nhập và ghi log bảo mật.

---

## Nguyên tắc phát triển

Tất cả tính năng mới cần lấy IP người dùng thông qua utility chung của hệ thống.

Không được sử dụng trực tiếp:

```java
request.getRemoteAddr()
```

trong business logic.

Việc thay đổi nhà cung cấp CDN hoặc Proxy trong tương lai chỉ cần cập nhật utility lấy IP mà không cần sửa toàn bộ source code.

# Lộ trình triển khai

## Giai đoạn 1

```text
Nginx
 ↓
proxy_pass
 ↓
qr.domain.com
 ↓
Worker + KV + D1
```

## Giai đoạn 2

```text
Dashboard quản trị QR
```

## Giai đoạn 3

```text
Cloudflare Proxy toàn bộ website
```

## Giai đoạn 4

```text
D1 + KV Cache + Analytics nâng cao
```
