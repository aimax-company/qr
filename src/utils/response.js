export function redirectHome(homeUrl) {
  return Response.redirect(homeUrl, 302);
}