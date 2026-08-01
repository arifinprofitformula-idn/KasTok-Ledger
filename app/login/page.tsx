import Image from "next/image";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
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
        <LoginForm />
      </section>
    </main>
  );
}
