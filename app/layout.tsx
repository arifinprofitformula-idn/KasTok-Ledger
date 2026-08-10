import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KasTok Ledger",
  description: "Rekap pendapatan TikTok Shop dengan PostgreSQL dan Next.js"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
