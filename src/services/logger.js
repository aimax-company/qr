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