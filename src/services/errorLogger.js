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