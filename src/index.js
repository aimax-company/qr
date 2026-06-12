import { handleQr } from "./routes/qr";
import { getConfig } from "./config";
import { redirectHome } from "./utils/response";

export default {
  async fetch(request, env, ctx) {

    const config = getConfig(env);

    const path =
      new URL(request.url).pathname;

    switch (path) {

      case "/qr":
        return handleQr(
          request,
          env,
          ctx
        );

      case "/qr-error":
        return new Response("QR Error");

      case "/qr-dashboard":
        return new Response("Dashboard");

      default:
        return redirectHome(
          config.HOME_URL
        );
    }
  }
};