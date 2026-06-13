// File: src/services/logger.js

// This module provides the logScan function used to record successful QR code operations.
// It is primarily used in src/routes/qr.js to track when a QR code is accessed and successfully redirected.
//
// The logScan function records analytics data into the qr_logs table, including:
// - qr_id: the QR code identifier
// - ip_address: the user's IP address (from CF-Connecting-IP or X-Forwarded-For)
// - country: the user's country derived from request.cf.country (Cloudflare metadata)
// - user_agent: the browser or device user agent string
// - timestamp: the time the operation occurred (in milliseconds since epoch)
//
// The function is designed to run asynchronously using ctx.waitUntil in Cloudflare Workers,
// ensuring that logging does not block or delay the HTTP response to the user.
//
// logScan is implemented using a D1 prepared statement to ensure secure and efficient database writes.
// It is intended for analytics, monitoring, and usage tracking of QR code traffic.
//
// The function handles errors gracefully by allowing callers to wrap it in .catch(() => {})
// so that any logging failure does not impact the main request flow.
//
// Example usage:
// ctx.waitUntil(
//   logScan(config.DB, qrId, request).catch(() => {})
// );
//
// This module is a core part of the QR analytics system, enabling insights into:
// - operation volume
// - geographic distribution
// - device and browser usage patterns
// - system health monitoring
//
// It is safe to use in high-traffic environments due to its non-blocking design and lightweight DB operations.

export async function logScan(
  db,
  qrId,
  request
) {
  return db.prepare(`
    INSERT INTO qr_logs
    (
      qr_id,
      ip,
      country,
      user_agent,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `)
  .bind(
    qrId,
    request.headers.get("CF-Connecting-IP"),
    request.cf?.country || null,
    request.headers.get("User-Agent"),
    Date.now()
  )
  .run();
}