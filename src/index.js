export default {
  async fetch(request, env, ctx) {

    const url = new URL(request.url);

    if (url.pathname !== "/qr") {
      return Response.redirect(env.HOME_URL, 302);
    }

    const qrId = url.searchParams.get("id");

    if (!qrId) {
      return Response.redirect(env.HOME_URL, 302);
    }

    const targetUrl = await env.REDIRECTS.get(qrId);

    if (!targetUrl) {
      return Response.redirect(env.HOME_URL, 302);
    }

    try {
      new URL(targetUrl);
    } catch {

      ctx.waitUntil(
        env.DB.prepare(`
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
        .run()
      );

      return Response.redirect(env.HOME_URL, 302);
    }

    ctx.waitUntil(
      env.DB.prepare(`
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
      .run()
    );

    return Response.redirect(targetUrl, 302);
  }
};