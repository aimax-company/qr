import { getConfig } from "../config";
import { getTargetUrl } from "../services/redirect";
import { logScan } from "../services/logger";
import { logError } from "../services/errorLogger";
import { redirectHome } from "../utils/response";

export async function handleQr(
  request,
  env,
  ctx
) {
  const config = getConfig(env);
  if (!config?.DB) {
    return redirectHome(config.HOME_URL);
  }

  const url = new URL(request.url);
  const qrId = url.searchParams.get("id");

  if (!qrId) {

    ctx.waitUntil(
      logError(
        config.DB,
        null,
        null,
        request
      ).catch(() => {})
    );

    return redirectHome(
      config.HOME_URL
    );
  }

  const targetUrl =
    await getTargetUrl(
      config.REDIRECTS,
      qrId
    );

  if (!targetUrl) {

    ctx.waitUntil(
      logError(
        config.DB,
        qrId,
        null,
        request
      ).catch(() => {})
    );

    return redirectHome(
      config.HOME_URL
    );
  }

let safeUrl;

  try {
    safeUrl = new URL(targetUrl);

    if (!["http:", "https:"].includes(safeUrl.protocol)) {
      throw new Error("BAD_PROTOCOL");
    }

  } catch {
    ctx.waitUntil(
      logError(config.DB, qrId, targetUrl, request).catch(() => {})
    );

    return redirectHome(config.HOME_URL);
  }

  ctx.waitUntil(
    logScan(config.DB, qrId, request).catch(() => {})
  );

  return Response.redirect(safeUrl.toString(), 302);
}