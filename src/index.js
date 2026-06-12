import { getConfig } from "./config";
import { logScan } from "./services/logger";
import { getTargetUrl } from "./services/redirect";
import { redirectHome } from "./utils/response";

export default {
  async fetch(request, env, ctx) {

    const config = getConfig(env);

    const url = new URL(request.url);

    if (url.pathname !== "/qr") {
      return redirectHome(config.HOME_URL);
    }

    const qrId = url.searchParams.get("id");

    if (!qrId) {
      return redirectHome(config.HOME_URL);
    }

    const targetUrl =
      await getTargetUrl(
        config.REDIRECTS,
        qrId
      );

    if (!targetUrl) {
      return redirectHome(config.HOME_URL);
    }

    try {
      new URL(targetUrl);
    } catch {

      ctx.waitUntil(
        logScan(
          config.DB,
          qrId,
          request
        )
      );

      return redirectHome(config.HOME_URL);
    }

    ctx.waitUntil(
      logScan(
        config.DB,
        qrId,
        request
      )
    );

    return Response.redirect(
      targetUrl,
      302
    );
  }
};