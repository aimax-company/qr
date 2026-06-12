export function getConfig(env) {
  return {
    HOME_URL: env.HOME_URL,
    DASHBOARD_URL: env.DASHBOARD_URL,
    WEBAPP_URL: env.WEBAPP_URL,
    ANDROID_URL: env.ANDROID_URL,
    IOS_URL: env.IOS_URL,

    REDIRECTS: env.REDIRECTS,
    DB: env.DB,

    GOOGLE_CLIENT_ID:
      env.GOOGLE_CLIENT_ID,

    GOOGLE_CLIENT_SECRET:
      env.GOOGLE_CLIENT_SECRET,

    JWT_SECRET:
      env.JWT_SECRET
  };
}