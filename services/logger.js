export async function logScan(
  db,
  qrId,
  status,
  request
) {
  return db.prepare(`
    INSERT INTO qr_logs
    (
      qr_id,
      status,
      ip,
      country,
      user_agent,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  .bind(
    qrId,
    status,
    request.headers.get("CF-Connecting-IP"),
    request.cf?.country || null,
    request.headers.get("User-Agent"),
    Date.now()
  )
  .run();
}