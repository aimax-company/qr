import { handleQr } from "./routes/qr";
import { redirectHome } from "./utils/response";
import { getConfig } from "./config";

export default {
  async fetch(request, env, ctx) {

    const config = getConfig(env);

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/qr") {
      return handleQr(
        request,
        env,
        ctx
      );
    }

    if (path === "/qr-error") {
      return new Response(
        "QR Error Page"
      );
    }

    if (path === "/qr-dashboard") {
      return new Response(
        "Dashboard"
      );
    }

    return redirectHome(
      config.HOME_URL
    );
  }
};