import Image from "next/image";
import LoginForm from "@/components/LoginForm";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default function LoginPage() {
  const envConfigured = getSupabaseEnv().isConfigured;

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <Image src="/kastok-logo.svg" alt="KasTok Ledger" width={116} height={116} priority />
          <div>
            <p className="eyebrow">Buku Kas Digital</p>
            <h1>KasTok Ledger</h1>
            <p className="login-copy">Rekap pendapatan TikTok Shop yang rapi, aman, dan siap dibawa ke Vercel.</p>
          </div>
        </div>
        {!envConfigured ? <p className="status err">Konfigurasi Supabase belum lengkap di Vercel. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`, lalu redeploy.</p> : null}
        <LoginForm disabled={!envConfigured} />
      </section>
    </main>
  );
}
