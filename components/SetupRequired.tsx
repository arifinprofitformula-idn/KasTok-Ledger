import Image from "next/image";

export default function SetupRequired() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <Image src="/kastok-logo.webp" alt="Tokopedia dan TikTok Shop" width={96} height={96} priority />
          <div>
            <p className="eyebrow">Pengaturan Belum Siap</p>
            <h1>KasTok Ledger</h1>
            <p className="login-copy">
              Penyimpanan data belum tersambung. Periksa pengaturan aplikasi lalu buka kembali halaman ini.
            </p>
          </div>
        </div>
        <div className="status err">
          Aplikasi belum bisa dibuka sampai koneksi data dan keamanan login aktif.
        </div>
      </section>
    </main>
  );
}
