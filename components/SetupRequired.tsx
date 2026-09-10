import Image from "next/image";

export default function SetupRequired() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <Image src="/kastok-logo.webp" alt="Tokopedia dan TikTok Shop" width={96} height={96} priority />
          <div>
            <p className="eyebrow">Setup Diperlukan</p>
            <h1>KasTok Ledger</h1>
            <p className="login-copy">
              Konfigurasi database belum terbaca di runtime. Isi environment variable lalu redeploy.
            </p>
          </div>
        </div>
        <div className="status err">
          Wajib ada: DATABASE_URL dan AUTH_SECRET.
        </div>
      </section>
    </main>
  );
}
