// File: src/routes/qr.js

// This module handles incoming QR code requests and controls the full redirect workflow.
//
// It is the core routing layer of the QR redirect system and is responsible for:
// - parsing incoming requests
// - validating QR identifiers
// - resolving target redirect URLs
// - validating URL safety and protocol
// - logging scan and error events
// - redirecting users to the appropriate destination or fallback page
//
// The function handleQr is designed for Cloudflare Workers and uses ctx.waitUntil
// to perform logging operations asynchronously without blocking the HTTP response.
//
// Request flow:
// 1. Validate configuration and database availability
// 2. Extract QR ID from query parameters
// 3. Resolve target URL from KV store using the QR ID
// 4. Validate URL format and protocol safety
// 5. Log scan or error events accordingly
// 6. Redirect user to target URL or fallback HOME_URL
//
// The module relies on external services for configuration (src/config.js),
// including the database connection and fallback URL settings.
//
// Error conditions are categorized and logged using logError for observability:
// - MISSING_QR_ID: request does not contain a QR identifier
// - QR_NOT_FOUND: no matching redirect exists for the QR ID
// - INVALID_URL: stored URL cannot be parsed
// - INVALID_PROTOCOL: unsafe or unsupported URL protocol
//
// Successful QR scans are recorded using logScan for analytics purposes.
//
// The function ensures that all logging operations are best-effort and never block
// or interfere with user redirection.
//
// Example usage:
// export default {
//   fetch: handleQr
// };
//
// This route is a critical entry point for QR analytics and redirect behavior,
// and is designed to be resilient, non-blocking, and safe under high traffic conditions.

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
  const home = config.HOME_URL;

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
      config.KV,
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