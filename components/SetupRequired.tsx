import Image from "next/image";

export default function SetupRequired() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <Image src="/kastok-logo.svg" alt="KasTok Ledger" width={96} height={96} priority />
          <div>
            <p className="eyebrow">Setup Diperlukan</p>
            <h1>KasTok Ledger</h1>
            <p className="login-copy">
              Konfigurasi Supabase belum terbaca di runtime. Isi environment variable Vercel lalu redeploy.
            </p>
          </div>
        </div>
        <div className="status err">
          Wajib ada: NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </div>
      </section>
    </main>
  );
}
