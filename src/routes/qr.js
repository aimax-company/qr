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

  const url = new URL(request.url);

  const qrId = url.searchParams.get("id");

  if (!qrId) {

    ctx.waitUntil(
      logError(
        config.DB,
        null,
        "MISSING_ID",
        null,
        request
      )
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
        "NOT_FOUND",
        null,
        request
      )
    );

    return redirectHome(
      config.HOME_URL
    );
  }

  try {
    new URL(targetUrl);
  } catch {

    ctx.waitUntil(
      logError(
        config.DB,
        qrId,
        "INVALID_URL",
        targetUrl,
        request
      )
    );

    return redirectHome(
      config.HOME_URL
    );
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