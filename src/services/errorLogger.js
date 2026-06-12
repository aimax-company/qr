export async function logError(
  db,
  qrId,
  targetUrl,
  request
) {
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
    request.headers.get("CF-Connecting-IP"),
    request.cf?.country || null,
    request.headers.get("User-Agent"),
    Date.now()
  )
  .run();
}