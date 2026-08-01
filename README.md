# KasTok Ledger

Aplikasi rekap pendapatan TikTok Shop berbasis Next.js, Supabase Auth, dan Supabase Postgres.

## Environment

Salin `.env.local.example` menjadi `.env.local`, lalu isi:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Setup Supabase

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan isi file `supabase/schema.sql`.
4. Aktifkan Auth email/password di Supabase Authentication.
5. Buat user dari Supabase Dashboard atau lewat halaman login setelah user tersedia.

## Catatan Keamanan

- Jangan pernah memakai Supabase service role key di frontend atau Vercel public env.
- Aplikasi hanya membutuhkan anon key; akses data dibatasi oleh Supabase Row Level Security.
- Tabel `transactions` punya unique constraint `(user_id, dedupe_key)` untuk mencegah transaksi ganda.
- Library `xlsx` dipakai sesuai requirement untuk membaca export TikTok Shop di browser. Batasi penggunaan untuk file export internal yang tepercaya karena advisory npm untuk SheetJS belum memiliki fix resmi.
- File XLSX tidak diunggah ke server aplikasi; browser hanya menyimpan hasil parsing transaksi ke Supabase.

## Development

```bash
npm install
npm run dev
```

Dashboard berjalan di `/dashboard`, login di `/login`.

## Membuat Akun Superadmin

Tambahkan variable berikut ke `.env.local` lokal:

```bash
SUPABASE_SERVICE_ROLE_KEY=
SUPERADMIN_EMAIL=
SUPERADMIN_PASSWORD=
```

Lalu jalankan:

```bash
npm run create-superadmin
```

Service role key hanya untuk skrip lokal/admin. Jangan pernah isi service role key di Vercel sebagai public env dan jangan dipakai di kode frontend.

## Deploy ke Vercel

1. Push project ini ke GitHub.
2. Import repository di Vercel.
3. Isi environment variable `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy.
# KasTok-Ledger
