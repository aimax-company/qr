export async function logError(
  db,
  qrId,
  targetUrl,
  request,
  err
) {
  const errorType = err?.name || "UNKNOWN_ERROR";
  const country = request.cf?.country || null;
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
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  .bind(
    qrId,
    errorType,
    targetUrl || null,
    request.headers.get("CF-Connecting-IP"),
    country,
    request.headers.get("User-Agent"),
    Date.now()
  )
  .run();
}