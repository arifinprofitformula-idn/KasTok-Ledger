export function getAppEnv() {
  const localDevelopment = process.env.NODE_ENV !== "production";
  const databaseUrl = process.env.DATABASE_URL || (localDevelopment ? "postgresql://postgres@127.0.0.1:5432/kastok_ledger" : undefined);
  const authSecret = process.env.AUTH_SECRET || (localDevelopment ? "local-kastok-development-secret-change-in-production" : undefined);

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
