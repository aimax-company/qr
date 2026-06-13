// File: src/services/errorLogger.js

// This module provides the logError function used to record system and routing errors
// occurring during QR code processing in the application.
//
// It is primarily used in src/routes/qr.js to capture and store detailed error information
// when QR resolution, URL parsing, or validation fails.
//
// The logError function stores error data into the qr_logs table, including:
// - qr_id: the QR code identifier (if available)
// - error_type: a normalized error category (e.g. MISSING_QR_ID, QR_NOT_FOUND, INVALID_URL)
// - target_url: the original or attempted redirect URL (if available)
// - ip: client IP address (CF-Connecting-IP or X-Forwarded-For fallback)
// - country: user country from request.cf.country (Cloudflare metadata)
// - user_agent: browser or device user agent string
// - created_at: timestamp of the error event (milliseconds since epoch)
//
// The function is designed to be non-blocking and is typically executed via ctx.waitUntil
// in Cloudflare Workers to avoid impacting request latency.
//
// Error logging is intentionally best-effort; failures inside this function are expected
// to be silently ignored when wrapped with .catch(() => {}) to prevent cascading failures.
//
// logError is implemented using a D1 prepared statement to ensure secure and efficient writes.
//
// Example usage:
// ctx.waitUntil(
//   logError(config.DB, qrId, targetUrl, request, errorObject).catch(() => {})
// );
//
// This module is critical for debugging, monitoring, and analytics of QR system failures,
// helping to identify invalid QR codes, misconfigurations, and potential abuse patterns.

export async function logError(
  db,
  qrId,
  targetUrl,
  request,
  err
) {
  const errorType = err?.name || err?.message || "UNKNOWN_ERROR";
  const country = request?.cf?.country || null;
  return db.prepare(`
    INSERT INTO qr_logs
    (
      qr_id,
      error_type,
      target_url,
      ip,
      country,
      user_agent,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  .bind(
    qrId || null,
    errorType,
    targetUrl || null,
    request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]  || null ,
    country || null,
    request.headers.get("User-Agent"),
    Date.now()
  )
  .run();
}