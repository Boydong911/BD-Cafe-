# Cafe/Restoran App — Setup

## 1. Install dependencies
```bash
npx create-next-app@latest cafe-app --typescript --tailwind --app
cd cafe-app
npx shadcn@latest init
npx shadcn@latest add button input label card badge sheet select textarea switch table
npm install @supabase/ssr @supabase/supabase-js zod recharts
npm install -D tsx
```
Lalu copy-kan semua file di paket ini ke dalam project (`app/`, `lib/`, `middleware.ts`, `supabase/`, `scripts/`).

## 2. Setup Supabase
1. Buat project baru di https://supabase.com.
2. Buka **SQL Editor**, jalankan `supabase/sql-editor/02-install-database-baru.sql`
   — satu tempel, berisi skema + policies + seluruh migrasi dalam urutan
   pemasangannya. Prosedur rinci dan aturan amannya ada di
   `supabase/sql-editor/00-PROSEDUR.md`; hasil instal dicek dengan
   `supabase/sql-editor/01-cek-kesehatan.sql`.
3. Buat `.env.local` berisi dua baris berikut (dari Settings > API):
   - `NEXT_PUBLIC_SUPABASE_URL=...` (URL project)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...` (publik, aman untuk client)
   `SUPABASE_SERVICE_ROLE_KEY` hanya perlu diisi bila menjalankan
   `scripts/seed-owner.ts` (membuat owner awal via Admin API).
   JANGAN pernah commit / expose key ini ke client.

## 3. Buat akun Owner awal 
```bash
npx tsx scripts/seed-owner.ts
```
Script ini memanggil Supabase Admin API (`auth.admin.createUser`) sehingga password
otomatis di-hash (bcrypt) oleh Supabase Auth, lalu membuat baris di `profiles`
dengan `role = 'owner'`.

## 4. Generate tipe TypeScript dari schema (opsional tapi disarankan)
```bash
npx supabase gen types typescript --project-id <project-id> > types/database.types.ts
```

## 5. Jalankan
```bash
npm run dev
```
- Customer: `http://localhost:3000/?table=05`
- Login staff: `http://localhost:3000/login`

## Alur singkat yang sudah diimplementasikan di paket ini
- `middleware.ts` — proteksi semua route `/admin/*`, redirect otomatis sesuai role.
- `app/login/actions.ts` — login pakai username (di-mapping ke email internal via RPC
  `get_login_email`), password diverifikasi oleh Supabase Auth (bcrypt).
- `app/admin/owner/menu/actions.ts` — create/update/delete menu + upload foto ke
  Supabase Storage bucket `menu-images`.
- `app/checkout/actions.ts` — Server Action checkout: validasi ulang harga & stok
  dari database (tidak percaya harga dari client), insert `orders` + `order_items`.
- `app/order/[orderId]/` — bukti pesanan + status realtime via `supabase-js` Realtime.
- `supabase/sql-editor/` — prosedur menjalankan SQL, file cek kesehatan,
  dan install database baru (tabel, RLS, function laporan
  `get_sales_report` / `get_top_menu`).

## Yang masih perlu kamu lengkapi
- Komponen UI: landing page (hero, galeri, maps), katalog menu + filter/search,
  form kustomisasi menu, cart, form menu owner, chart Recharts, tabel kasir.
  Semua bisa memakai Server Action & schema yang sudah disiapkan di sini.
- Integrasi QRIS sungguhan (payment gateway pihak ketiga) jika ingin generate
  QR dinamis — saat ini alur "QRIS" hanya mencatat `payment_method = 'qris'`
  dengan `payment_status = 'pending'` sampai dikonfirmasi kasir.
