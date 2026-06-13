export function getConfig(env) {
  return {
    HOME_URL: env.HOME_URL || "https://pinsacduphong.com",
    DASHBOARD_URL: env.DASHBOARD_URL || "https://pinsacduphong.com/qr-dashboard",
    WEBAPP_URL: env.WEBAPP_URL || "https://api.littlebee.vn",
    ANDROID_URL: env.ANDROID_URL || "https://play.google.com/store/apps/details?id=com.pinsacduphong",
    IOS_URL: env.IOS_URL || "https://apps.apple.com/app/id1548987654",

    KV: env.REDIRECTS,
    DB: env.DB,

    GOOGLE_CLIENT_ID:
      env.GOOGLE_CLIENT_ID,

    GOOGLE_CLIENT_SECRET:
      env.GOOGLE_CLIENT_SECRET,

    JWT_SECRET:
      env.JWT_SECRET
  };
}