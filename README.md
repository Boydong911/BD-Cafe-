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
2. Buka **SQL Editor**, jalankan `supabase/schema.sql`, lalu `supabase/storage-policies.sql`.
3. Copy `.env.local.example` -> `.env.local`, isi dengan URL & anon key project (Settings > API).
   Untuk `SUPABASE_SERVICE_ROLE_KEY`, ambil dari halaman yang sama (JANGAN pernah commit / expose ke client).

## 3. Buat akun Owner awal (boy123 / boboiboy123)
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
- `supabase/schema.sql` — semua tabel, RLS, dan function laporan
  (`get_sales_report`, `get_top_menu`) untuk Dashboard Owner (Recharts).

## Yang masih perlu kamu lengkapi
- Komponen UI: landing page (hero, galeri, maps), katalog menu + filter/search,
  form kustomisasi menu, cart, form menu owner, chart Recharts, tabel kasir.
  Semua bisa memakai Server Action & schema yang sudah disiapkan di sini.
- Integrasi QRIS sungguhan (payment gateway pihak ketiga) jika ingin generate
  QR dinamis — saat ini alur "QRIS" hanya mencatat `payment_method = 'qris'`
  dengan `payment_status = 'pending'` sampai dikonfirmasi kasir.
