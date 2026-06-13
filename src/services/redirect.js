// File: src/services/redirect.js

export async function getTargetUrl(
  redirects,
  qrId
) {
  return redirects.get(qrId);
}