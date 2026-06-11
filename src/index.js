const handler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const sourceDomain = env.DOMAIN || "https://domain.com";
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

      return Response.redirect(fallbackUrl.toString(), 302);
    }

    const redirectUrl = new URL(targetDomain);
    redirectUrl.searchParams.set("id", qrId);

    return Response.redirect(redirectUrl.toString(), 302);
  }
};

export default handler;