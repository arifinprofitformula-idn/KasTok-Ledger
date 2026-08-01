export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey)
  };
}

export function assertSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env.isConfigured) {
    throw new Error("Konfigurasi Supabase belum lengkap. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return env as { url: string; anonKey: string; isConfigured: true };
}
