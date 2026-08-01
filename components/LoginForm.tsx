"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogIn, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setStatus("Login gagal. Periksa email dan password.");
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
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password Supabase" required />
        </div>
      </label>
      <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
        <LogIn size={17} />
        {loading ? "Masuk..." : "Masuk ke Dashboard"}
      </button>
      {status ? <p className="status err">{status}</p> : null}
    </form>
  );
}
