export function getAppEnv() {
  const databaseUrl = process.env.DATABASE_URL;
  const authSecret = process.env.AUTH_SECRET;

  return {
    databaseUrl,
    authSecret,
    isConfigured: Boolean(databaseUrl && authSecret)
  };
}

export function assertAppEnv() {
  const env = getAppEnv();

  if (!env.databaseUrl || !env.authSecret) {
    throw new Error("Konfigurasi belum lengkap. Isi DATABASE_URL dan AUTH_SECRET.");
  }

  if (env.authSecret.length < 32) {
    throw new Error("AUTH_SECRET minimal 32 karakter.");
  }

  return {
    databaseUrl: env.databaseUrl,
    authSecret: env.authSecret
  };
}
