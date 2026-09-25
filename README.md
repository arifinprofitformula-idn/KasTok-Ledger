# KasTok Ledger

Aplikasi rekap pendapatan TikTok Shop berbasis Next.js dan PostgreSQL self-hosted.

## Environment

Salin `.env.local.example` menjadi `.env.local`, lalu isi:

```bash
DATABASE_URL=postgresql://user:password@host:5432/kastok_ledger
AUTH_SECRET=isi-random-minimal-32-karakter
DATABASE_SSL=false
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=change-this-strong-password
```

Gunakan `DATABASE_SSL=true` kalau koneksi database VPS kamu mewajibkan SSL.

## Setup Database

1. Buat database PostgreSQL di VPS.
2. Jalankan isi file `database/schema.sql`.
3. Isi `.env.local`.
4. Buat akun admin:

```bash
npm run create-superadmin
```

## Catatan Keamanan

- Jangan expose port PostgreSQL ke publik tanpa firewall atau allowlist.
- Browser tidak memegang credential database; semua query berjalan lewat server route Next.js.
- Session login disimpan di cookie HTTP-only bertanda tangan `AUTH_SECRET`.
- Tabel `transactions` punya unique constraint `(user_id, dedupe_key)` untuk mencegah transaksi ganda.
- Library `xlsx` dipakai untuk membaca export TikTok Shop di browser. Batasi penggunaan untuk file export internal yang tepercaya karena advisory npm untuk SheetJS belum memiliki fix resmi.
- File XLSX tidak diunggah ke server aplikasi; browser hanya menyimpan hasil parsing transaksi ke database melalui API aplikasi.

## Development

```bash
npm install
npm run dev
```

Dashboard berjalan di `/dashboard`, login di `/login`.

Untuk memperbarui database yang sudah ada setelah aplikasi mendapat fitur baru, jalankan:

```bash
npm run db:migrate
```

## Laporan Produk Terjual

- Upload export TikTok Shop yang memiliki sheet `OrderSKUList`.
- Sistem melewati baris deskripsi TikTok, menjaga Order ID/SKU ID sebagai teks, dan tidak menyimpan data penerima atau alamat.
- Produk terjual bersih dihitung dari pesanan berstatus `Selesai`: `Quantity - Sku Quantity of return`.
- Status `Dikirim` dan `Perlu dikirim` ditampilkan sebagai proses; status `Dibatalkan` tidak masuk penjualan final.
- File identik tidak diimpor ulang. File ekspor yang lebih baru memperbarui status baris pesanan lama berdasarkan Order ID, SKU ID, dan variasi.

## Deploy

1. Push project ini ke GitHub.
2. Deploy ke Vercel atau VPS Node.js.
3. Isi environment variable `DATABASE_URL`, `AUTH_SECRET`, dan `DATABASE_SSL` bila perlu.
4. Jalankan `database/schema.sql` di database production.
5. Jalankan `npm run create-superadmin` dengan env production untuk membuat akun awal.
