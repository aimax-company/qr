// File: src/routes/qr.js

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
  const home = config.HOME_URL || "https://example.com";

  if (!config?.DB) {
    return redirectHome(home);
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return redirectHome(home);
  }
  const qrId = url.searchParams.get("id");

  if (!qrId) {

    ctx.waitUntil(
      logError(
        config.DB,
        null,
        null,
        request,
        {
        name: "MISSING_QR_ID",
        message: "QR id is missing"
        }
      ).catch(() => {})
    );

    return redirectHome(
      home
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
        request,
        {
        name: "QR_NOT_FOUND",
        message: "No mapping for QR"
        }
      ).catch(() => {})
    );

    return redirectHome(
      home
    );
  }

 let safeUrl;

  // ❌ invalid URL
  try {
    safeUrl = new URL(targetUrl);
  } catch {
    ctx.waitUntil(
      logError(config.DB, qrId, targetUrl, request, {
        name: "INVALID_URL",
        message: "URL parse failed"
      }).catch(() => {})
    );

    return redirectHome(home);
  }

  // ❌ invalid protocol
  if (!["http:", "https:"].includes(safeUrl.protocol)) {
    ctx.waitUntil(
      logError(config.DB, qrId, targetUrl, request, {
        name: "INVALID_PROTOCOL",
        message: "Blocked protocol"
      }).catch(() => {})
    );

    return redirectHome(home);
  }

  // Chuyển hương về URL đích và ghi log
  ctx.waitUntil(
    logScan(config.DB, qrId, request).catch(() => {})
  );

  return Response.redirect(safeUrl.toString(), 302);
}