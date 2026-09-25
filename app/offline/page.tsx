import Link from "next/link";
import Image from "next/image";

export default function OfflinePage() {
  return (
    <div className="login-container">
      <div className="login-card" style={{ textAlign: "center" }}>
        <Image
          src="/kastok-logo.webp"
          alt="KasTok Logo"
          width={80}
          height={80}
          style={{ margin: "0 auto 16px auto", display: "block" }}
        />
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "8px" }}>
          Mode Offline
        </h1>
        <p style={{ color: "#a1a1aa", fontSize: "0.875rem", marginBottom: "20px" }}>
          Koneksi internet Anda sedang terputus. KasTok Ledger memerlukan koneksi untuk menyinkronkan data transaksi dan pesanan terbaru.
        </p>
        <Link
          href="/dashboard"
          className="btn"
          style={{
            display: "inline-block",
            width: "100%",
            textAlign: "center",
            padding: "10px 16px",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Coba Muat Ulang
        </Link>
      </div>
    </div>
  );
}
