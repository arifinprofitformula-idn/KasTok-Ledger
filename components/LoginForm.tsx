"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogIn, Mail } from "lucide-react";

type Props = {
  disabled?: boolean;
};

export default function LoginForm({ disabled = false }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      setLoading(false);

      if (!response.ok) {
        setStatus("Login gagal. Periksa email dan password.");
        return;
      }
    } catch (error) {
      setLoading(false);
      setStatus(error instanceof Error ? error.message : "Konfigurasi login bermasalah.");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label>
        <span>Email</span>
        <div className="input-shell">
          <Mail size={17} />
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" required />
        </div>
      </label>
      <label>
        <span>Password</span>
        <div className="input-shell">
          <Lock size={17} />
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required />
        </div>
      </label>
      <button className="btn btn-primary login-submit" type="submit" disabled={loading || disabled}>
        <LogIn size={17} />
        {loading ? "Masuk..." : "Masuk ke Aplikasi"}
      </button>
      {status ? <p className="status err">{status}</p> : null}
    </form>
  );
}
