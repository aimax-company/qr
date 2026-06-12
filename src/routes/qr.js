import { getConfig } from "../config";
import { getTargetUrl } from "../services/redirect";
import { logScan } from "../services/logger";
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
      logScan(
        config.DB,
        "missing",
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
      logScan(
        config.DB,
        qrId,
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
      logScan(
        config.DB,
        qrId,
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