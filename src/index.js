const normalizeBaseUrl = (value) => value.replace(/\/+$/, "");

const logQrScan = async (request, env, qrId) => {
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    return;
  }

  try {
    await env.DB.prepare(`
      INSERT INTO qr_logs (qr_id, ip, country, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
      .bind(
        qrId,
        request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || null,
        request.cf?.country || null,
        request.headers.get("User-Agent") || null,
        Date.now()
      )
      .run();
  } catch (error) {
    console.warn("QR log insert failed", error);
  }
};

const handler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const sourceDomain = normalizeBaseUrl(env.DOMAIN || "https://domain.com");
    const targetDomain = env.DOMAIN_TARGET || "https://qr.domain.com";

    const isQrRoute = url.pathname === "/qr" || url.pathname === "/qr/";

    if (!isQrRoute) {
      if (url.pathname === "/demo") {
        return fetch(new Request(new URL("/demo.html", request.url)));
      }

      const proxyUrl = new URL(request.url);
      const sourceUrl = new URL(sourceDomain);
      proxyUrl.protocol = sourceUrl.protocol;
      proxyUrl.host = sourceUrl.host;
      proxyUrl.port = sourceUrl.port;

      return fetch(proxyUrl, request);
    }

    const qrId = url.searchParams.get("id") || url.searchParams.get("qr");

    if (!qrId) {
      const fallbackUrl = new URL(sourceDomain);
      url.searchParams.forEach((value, key) => {
        fallbackUrl.searchParams.append(key, value);
      });

      const fallbackLocation = fallbackUrl.search === ""
        ? sourceDomain
        : fallbackUrl.toString();

      return Response.redirect(fallbackLocation, 302);
    }

    const targetUrl = env.REDIRECTS && typeof env.REDIRECTS.get === "function"
      ? await env.REDIRECTS.get(qrId)
      : null;

    if (!targetUrl) {
      const legacyRedirectUrl = new URL(targetDomain);
      legacyRedirectUrl.searchParams.set("id", qrId);
      return Response.redirect(legacyRedirectUrl.toString(), 302);
    }

    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(logQrScan(request, env, qrId));
    }

    return Response.redirect(targetUrl, 302);
  }
};

export default handler;