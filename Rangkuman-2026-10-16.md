# Rangkuman Pengembangan BD Coffee — 2026-10-16

> Dokumentasi lengkap semua pekerjaan pada sesi ini.
> Simpan di luar repo kalau tidak ingin ikut ter-commit.
>
> **Proyek**: BD Coffee (`cafe-app`) — sistem pemesanan dine-in & takeaway
> **Stack**: Next.js 15 (App Router) · TypeScript · Tailwind v3 · shadcn/ui ·
> Supabase (PostgreSQL + Auth + Storage + Realtime) · Zod
> **Alamat lokal**: `http://localhost:3000`

---

## DAFTAR ISI

1. [Ringkasan Singkat](#1-ringkasan-singkat)
2. [Kondisi Awal Sesi](#2-kondisi-awal-sesi)
3. [File BARU](#3-file-baru)
4. [File DIUBAH](#4-file-diubah)
5. [Perubahan-perubahan Feature](#5-perubahan-perubahan-feature)
6. [Bug yang Diperbaiki](#6-bug-yang-diperbaiki)
7. [Migrasi Database](#7-migrasi-database)
8. [Catatan Keamanan](#8-catatan-keamanan)
9. [Status Fitur Saat Ini](#9-status-fitur-saat-ini)
10. [Yang Masih Tersisa](#10-yang-masih-tersisa)

---

## 1. RINGKASAN SINGKAT

Sesi ini berisi **6 blok pekerjaan** utama:

| # | Pekerjaan | Hasil |
|---|-----------|-------|
| A | Menjalankan web di `localhost:3000` | ✅ Berhasil, CRM dipindah /dimatikan |
| B | Memperbaiki crash halaman detail menu | ✅ `TypeError` hilang |
| C | Tombol Gula + Ice/Hot di kartu menu | ✅ Inline, sekali klik |
| D | "Pesanan Atas Nama" + reset keranjang | ✅ Selesai |
| E | Halaman pembayaran QRIS / Tunai | ✅ Alur lengkap |
| F | Nomor antrean saat konfirmasi | ✅ Berurutan per hari |

---

## 2. KONDISI AWAL SESI

### Temuan awal

1. **Port 3000 sudah dipakai project lain** — `Stacking Web/CRM/`
   Judul halamannya "Masuk". Bukan BD Coffee.
2. **`cafe-app/.env.local` belum ada** — hanya ada `.env.example`.
   Tanpa itu aplikasi tidak bisa konek Supabase sama sekali.
3. **Roadmap tidak sinkron dengan kode** — beberapa fitur yang masih `🔲`
   ternyata sudah jadi di kode.

### Perbaikan `.env.local`

File `.env.local` dibuat **oleh pengguna sendiri** (agar tidak terbaca AI).
Isinya 3 variabel:

| Variabel | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ ada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ ada |
| `SUPABASE_SERVICE_ROLE_KEY` | kosong — **aman**, website tidak membutuhkannya |

---

## 3. FILE BARU

Semua path relatif terhadap `cafe-app/`.

| # | Lokasi File | Isi |
|---|---|---|
| 1 | `lib/menu-customizations.ts` | Fungsi `normalizeCustomizationGroups()` — membersihkan JSON kustomisasi dari DB supaya data rusak tidak bikin halaman error 500 |
| 2 | `lib/payment.ts` | Konstanta `PAYMENT_WINDOW_MINUTES = 15`. Dipisah karena file `"use server"` hanya boleh mengekspor async function |
| 3 | `app/order/[orderId]/actions.ts` | Server action: `confirmQrisPayment()`, `expireOrder()`, `getPaymentState()` |
| 4 | `app/order/[orderId]/pay/page.tsx` | Halaman pembayaran (Server Component) — bifurcation QRIS vs Tunai |
| 5 | `app/order/[orderId]/pay/payment-panel.tsx` | Timer hitung mundur, QR dummy, tombol "Sudah Bayar", realtime untuk jalur Tunai |
| 6 | `supabase/migrations/20261015-backup-menu-customization.sql` | Backup nilai `customization_options` + definisi default lama |
| 7 | `supabase/migrations/20261015-fix-customizations-and-order-number.sql` | Normalisasi kustomisasi (`choices` → `options`) |
| 8 | `supabase/migrations/20261015-rollback.sql` | Pembatal migrasi 15-10 |
| 9 | `supabase/migrations/20261016-queue-number-on-confirmation.sql` | Nomor antrean dibuat saat konfirmasi, bukan saat pesanan dibuat |
| 10 | `supabase/migrations/20261016-rollback-queue-number.sql` | Pembatal migrasi 16-10 |

### Catatan: file yang ada tapi belum pernah di-commit

| Lokasi File | Status |
|---|---|
| `app/menu/[id]/page.tsx` | Sudah ada di disk, tapi belum pernah masuk git — **perlu di-commit** |
| `components/customer/menu-detail.tsx` | Sudah ada di disk, tapi belum pernah masuk git — **perlu di-commit** |
| `.env.example` | Sudah ada di disk, tapi belum pernah masuk git |

---

## 4. FILE DIUBAH

| # | Lokasi File | Apa yang Berubah |
|---|---|---|
| 1 | `lib/cart/cart-context.tsx` | Tambah `customerName` di `OrderSession`, fungsi `setCustomerName()`, normalisasi sesi saat load, **hapus persistensi keranjang**, tambah `clearScannedTable()` |
| 2 | `components/customer/menu-card.tsx` | Tambah 2 grup tombol cepat (Gula / Ice-Hot), `customizations` ikut dikirim, quantity tetap ada |
| 3 | `components/customer/cart-sheet.tsx` | Kolom "Pesanan Atas Nama" di atas blok meja, label "Nomor Meja" diperjelas |
| 4 | `components/customer/table-session-sync.tsx` | Kalau halaman tanpa `?table=`, bersihkan sisa sesi meja hasil scan |
| 5 | `components/customer/checkout-form.tsx` | Nama diambil dari `session` (bukan state lokal), label → "Pesanan Atas Nama" |
| 6 | `app/menu/page.tsx` | Kirim `customization_groups` ke kartu, pakai `normalizeCustomizationGroups()` |
| 7 | `app/menu/[id]/page.tsx` | Pakai normalizer, hilangin logika duplikat |
| 8 | `app/checkout/actions.ts` | Guard `group.options`, redirect ke `/order/[id]/pay` bukan `/order/[id]` |
| 9 | `app/order/[orderId]/page.tsx` | Tampil "Menunggu pembayaran" kalau belum lunas, tombol ke halaman bayar |
| 10 | `scripts/seed-menu.ts` | `choices` → `options`, import type dari `@/types/menu`, opsi jadi Gula + Suhu (Shot dihapus) |
| 11 | `supabase/schema.sql` | Komentar `choices` → `options`, `order_number` jadi nullable + diisi trigger |
| 12 | `PROJECT-STRUCTURE.txt` | Di-regenerate otomatis (89 → 100 file) |

---

## 5. PERUBAHAN-PERUBAHAN FEATURE

### 5.1 🔧 Menjalankan Web di Port 3000

**Masalah**: port 3000 dipakai project `Stacking Web/CRM/`.

**Solusi**:
1. Jalankan BD Coffee di port 3001 dulu (tanpa mengganggu CRM)
2. Pastikan semua halaman 200 OK
3. Matikan proses CRM (PID 35144) — sudah dicek cmdline-nya memang `CRM\node_modules\next\...`
4. Pindahkan BD Coffee ke port 3000

**Status**: ✅ `http://localhost:3000` → BD Coffee

---

### 5.2 ☕ Tombol Gula + Ice/Hot di Kartu Menu

Kustomer bisa memilih gula & suhu **tanpa buka halaman detail**.

**Tampilan kartu:**

```
┌─────────────────────────┐
│        [ FOTO ]         │
├─────────────────────────┤
│ Kopi Susu Gula Aren     │
│ Rp 22.000               │
│ ┌───────┐ ┌─────┐  ┌──┐ │
│ │Non    │ │ Ice │  │🛍│ │
│ │Gula   │ │     │  │  │ │
│ ├───────┤ ├─────┤  └──┘ │
│ │ Gula  │ │ Hot │       │
│ └───────┘ └─────┘       │
│ [-] 1 [+]          [🛍] │
└─────────────────────────┘
```

**Aturan teknis:**
- Tiap grup = 1 kolom, 2 tombol ditumpuk vertikal
- Pilihan awal = opsi pertama tiap grup
- Kombinasi berbeda → `lineId` berbeda → baris keranjang terpisah
- Tombol_quantity `[-] 1 [+]` tetap ada
- Tombol **"Pilih"** yang dulu menuju halaman detail — **dihapus**

**Opsi kustomisasi final** (grup `Gula` + `Suhu`, tanpa Shot):

```json
[
  {"name":"Gula","options":[{"label":"Non Gula","price_delta":0},
                           {"label":"Gula","price_delta":0}]},
  {"name":"Suhu","options":[{"label":"Ice","price_delta":0},
                           {"label":"Hot","price_delta":0}]}
]
```

Menu kategori **"Makanan Ringan"** → `[]` (tidak ada tombol).

---

### 5.3 📛 "Pesanan Atas Nama"

Kolom nama yang diisi customer untuk dipanggil kasir.

**Ditempatkan di 2 tempat:**

| Halaman | Perilaku |
|---|---|
| `components/customer/cart-sheet.tsx` | Kolom input **di atas** blok meja |
| `components/customer/checkout-form.tsx` | Terbawa otomatis dari keranjang — tidak perlu isi 2× |
| `app/order/[orderId]/page.tsx` | Tampil besar di bawah nomor antrean |

**Keputusan desain:** memakai ulang kolom `customer_name` yang sudah ada,
bukan menambah kolom baru. Alasannya: menambah kolom kedua dengan isi
sama akan membingungkan kasir.

---

### 5.4 🔄 Reset Keranjang saat Refresh

**Perilaku baru:**

| Aksi | Keranjang | Nomor Meja |
|---|---|---|
| Tambah menu | isi | 🪑 02 |
| **F5 / pull-to-refresh** | 🔄 **KOSONG** | 🪑 **tetap** |
| **Klik "back" / pindah halaman** | ✅ **tetap isi** | 🪑 02 |
| Scan QR meja lain | 🔄 kosong (sesuai meja) | 🪑 meja baru |

**Cara implementasi:** keranjang tidak lagi ditulis ke `localStorage`.
Begitu halaman reload, React state mulai dari nol. Tidak perlu listener scroll.

> ⚠️ Sesi (nomor meja + nama) **tetap** disimpan ke `localStorage`,
> supaya customer tidak perlu scan QR ulang.

---

### 5.5 🪑 `/menu` Tanpa QR vs Dengan QR

| Cara masuk | Yang tampil di keranjang |
|---|---|
| `/menu?table=02` (scan QR) | 🪑 **Meja Nomor 02** — terkunci |
| `/menu` (dari landing page) | **Dine In? / Take Away?** → pilih Dine In → kolom **Nomor Meja** muncul |

**Bug yang diperbaiki:** sesi scan sebelumnya masih "nempel" di `localStorage`
saat `/menu` dibuka tanpa QR. Sekarang `clearScannedTable()` membersihkannya.

**File terkait:** `components/customer/table-session-sync.tsx`,
`lib/cart/cart-context.tsx`, `components/customer/cart-sheet.tsx`

---

### 5.6 💳 Alur Pembayaran (BARU)

Ini perubahan terbesar sesi ini.

#### Alur Tunai di Kasir

```
Checkout → /order/[id]/pay
    ↓
┌──────────────────────────────────┐
│          🏪                       │
│  Silahkan Langsung Bayar Di Kasir│
│  Untuk Mendapatkan Antrian        │
│  Pemesanan :)                     │
└──────────────────────────────────┘
⏳ Menunggu kasir mengonfirmasi...
    ↓ kasir klik "Konfirmasi Bayar"
NOMOR ANTRIAN muncul OTOMATIS (realtime)
```

#### Alur QRIS

```
Checkout → /order/[id]/pay
    ↓
┌──────────────────────────────────┐
│ Silahkan Bayar Langsung yaa... :)│
│        ┌────────────┐             │
│        │   [ QR ]   │  ← dummy   │
│        └────────────┘             │
│ Pesanan atas nama : Budi          │
│ Meja               : 02           │
│ Total              : Rp 44.000    │
│ ⏱ Sisa waktu bayar: 14:32        │
│ [ ✓ Sudah Bayar ]                 │
└──────────────────────────────────┘
    ↓ klik
NOMOR ANTRIAN
```

#### Fiturteknis

| Fitur | Detail |
|---|---|
| **QR dummy** | Dibuat dengan `qrcode.react` (sudah terinstall). Isinya otomatis: nominal, order id, nama, meja, tipe |
| **Nominal otomatis** | Customer **tidak mengetik** nominal — diambil dari `order.total` |
| **Timer 15 menit** | Countdown live, warna merah kalau sisa ≤ 2 menit |
| **Auto-expire** | Saat timer habis → `expireOrder()` → status jadi `cancelled` |
| **Cek expire saat buka** | `getPaymentState()` membatalkan pesanan yang sudah lewat 15 menit |
| **Realtime Tunai** | Halaman payment subscribe Supabase Realtime, auto pindah ke halaman antrean setelah kasir konfirmasi |

**Halaman antrean** (`/order/[id]`) menampilkan:
- Kalau sudah lunas → nomor antrean besar + "Pesanan Atas Nama"
- Kalau belum lunas → "Menunggu pembayaran" + tombol ke halaman bayar

---

## 6. BUG YANG DIPERIKSA

### 6.1 `TypeError: Cannot read properties of undefined`

**Gejala**: klik kartu menu → halaman `/menu/[id]` error 500.

```
TypeError: Cannot read properties of undefined (reading 'filter')
    at app/menu/[id]/page.tsx:37:32
    at MenuDetailPage (app/menu/[id]/page.tsx:35:60)
```

**Akhir masalah**: type data tidak konsisten — `choices` vs `options`.

| File | Kode | Kata kunci |
|---|---|---|
| `types/menu.ts:8` | `options: CustomizationOption[]` | ✅ `options` |
| `app/menu/[id]/page.tsx:51` | `g.options.filter(...)` | ✅ `options` |
| `app/checkout/actions.ts:90` | `group?.options.find(...)` | ✅ `options` |
| `scripts/seed-menu.ts:29` | `choices: [...]` | ❌ **`choices`** |

`scripts/seed-menu.ts` mendefinisikan type **lokalnya sendiri** (baris 23-24)
dan **tidak** meng-import dari `types/menu.ts`, jadi TypeScript tidak pernah
menyadari itu salah.

**Akibatnya** isi kolom di database:
```json
[{"name":"Gula","choices":[...]}]   ← app cari "options" → undefined → 💥
```

**Menu terdampak** (3 dari 12): Kopi Susu Gula Aren, Caramel Macchiato,
Butterscotch Latte.

**Perbaikan (3 lapis):**

1. `scripts/seed-menu.ts` → `choices` jadi `options`, import type yang benar
2. `lib/menu-customizations.ts` → normalizer aman
3. `app/menu/[id]/page.tsx` + `app/checkout/actions.ts` → guard `Array.isArray()`

> Catatan: `supabase/schema.sql` baris 83-94 ikut salah menulis `choices`
> di komentar — ikut diperbaiki supaya tidak jadi sumber_typo di kemudian hari.

---

### 6.2 Error saat mengisi "Pesanan Atas Nama"

**Gejala**: React error saat mengisi kolom nama.

**Penyebab**: data sesi lama di `localStorage` belum punya field `customerName`.
Saat di-load:
```ts
setSession(JSON.parse(rawSession));   // customerName = undefined
```
Akibatnya `<Input value={undefined}>` → React error
*"A component is changing an uncontrolled input to be controlled"*.

**Perbaikan** — normalisasi saat load:
```ts
setSession({
  orderType:    parsed.orderType    ?? DEFAULT_SESSION.orderType,
  tableNumber:  parsed.tableNumber  ?? null,
  isScanned:    parsed.isScanned    ?? false,
  customerName: parsed.customerName ?? "",
});
```

---

### 6.3 `export const` di file `"use server"`

**Gejala**: `/checkout` dan `/order/[id]/pay` balas 500.

```
Error: Only async functions are allowed to be exported in a "use server" file.
    app/order/[orderId]/actions.ts:8:1
    export const PAYMENT_WINDOW_MINUTES = 15;
```

**Perbaikan**: konstanta dipindah ke `lib/payment.ts`.

---

## 7. MIGRASI DATABASE

### Cara menjalankan

Supabase Dashboard → **SQL Editor** → **New query** → paste → **Run**

### Urutan

```
supabase/migrations/
├── 20261015-backup-menu-customization.sql            ← 1 (WAJIB)
├── 20261015-fix-customizations-and-order-number.sql  ← 2
└── 20261016-queue-number-on-confirmation.sql         ← 3
```

### Pengaman

File migrasi utama **menolak jalan** kalau backup belum ada:

```sql
if v_bak = 0 then
  raise exception 'BACKUP BELUM ADA. Jalankan ... backup ... dulu
                   - migrasi dibatalkan agar data tidak hilang.';
end if;
```

### Rollback tersedia

| File | Mengembalikan |
|---|---|
| `20261015-rollback.sql` | Nilai `customization_options` + default `order_number` |
| `20261016-rollback-queue-number.sql` | Nomor antrean kembali saat pesanan dibuat |

Kedua rollback memulihkan nilai dari tabel backup, **bukan mengetik ulang manual**.

---

### 7.1 Normalisasi `customization_options`

Menu minuman dapat grup `Gula` + `Suhu`, makanan dapat `[]`.

### 7.2 Nomor Antrean Saat Konfirmasi

**Perubahan penting** — sebelumnya nomor dibuat saat pesanan **dibuat**,
sekarang saat pesanan **dikonfirmasi**:

| Waktu | `order_number` |
|---|---|
| Pesanan dibuat | `NULL` (menunggu) |
| Pembayaran terkonfirmasi | `ORD-20261016-01` |
| Pembayaran berikutnya | `ORD-20261016-02` |

Format: `ORD-YYYYMMDD-NN`, reset setiap hari, urut sesuai **urutan konfirmasi**.

**Trigger** otomatis menaikkan `status` dari `pending` ke `confirmed` saat
pembayaran masuk.

**Advisory lock** (`pg_advisory_xact_lock`) supaya 2 pesanan yang dikonfirmasi
bersamaan tidak mendapat nomor yang sama.

---

## 8. CATATAN KEAMANAN

### `.env.local`

- ✅ Sudah di-ignore `.gitignore` baris 10 (`.env*.local`)
- ✅ Hanya `.env.example` (placeholder) yang masuk commit
- ✅ Tidak pernah dibaca isinya selama sesi ini — hanya nama variabelnya

### Klasifikasi variabel

| Variabel | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 🟢 Aman (dirancang publik) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 🟢 Aman (emang untuk browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔴 **RAHASIA** |
| `DATABASE_URL` | 🔴 **RAHASIA** (password di dalam URL) |
| `TELEGRAM_BOT_TOKEN` | 🔴 **RAHASIA** |
| `CRON_SECRET` | 🔴 **RAHASIA** |
| `RESEND_API_KEY` | 🔴 **RAHASIA** |

> **Rumus**: ada awalan `NEXT_PUBLIC_` → aman. Tidak ada → anggap rahasia.

### ⚠️ Peringatan QRIS (PENTING)

Tombol **"Sudah Bayar"** saat ini bisa dipakai siapa saja yang tahu URL pesanan
(UUID acak, praktis tidak bisa ditebak). Ini ** disengaja** untuk sementara
sesuai permintaan — agar bisa diuji tanpa payment gateway.

**Saat QRIS asli sudah terhubung:**
status `paid` **HARUS** datang dari **webhook payment gateway**, bukan dari
tombol. Kalau tidak, siapa pun yang tahu UUID pesanan bisa mendapat antrean
tanpa bayar.

Sudah ditulis komentar peringatan di `app/order/[orderId]/actions.ts`.

### Temuan lain

`cafe-app/.env.example` ukurannya **1238 byte — identik** dengan
`CRM/.env.example`. Artinya file itu **disalin dari project CRM**, makanya ada
variabel Telegram/Cron/Resend yang tidak ada hubungannya dengan BD Coffee.
Semuanya **irrelevant**, aman diabaikan.

---

## 9. STATUS FITUR SAAT INI

### Customer

| Fitur | Status |
|---|---|
| Landing page + tombol "Lihat Menu" | ✅ |
| Katalog menu + search + filter kategori | ✅ |
| Tombol Gula + Ice/Hot di kartu | ✅ |
| Detail menu + kustomisasi | ✅ |
| Keranjang + quantity | ✅ |
| Kolom "Pesanan Atas Nama" | ✅ |
| Pesanan via QR meja | ✅ |
| Pesanan tanpa QR (pilih meja sendiri) | ✅ |
| Reset keranjang saat refresh | ✅ |
| Checkout + validasi harga dari DB | ✅ |
| Halaman pembayaran Tunai | ✅ |
| Halaman pembayaran QRIS (dummy) | ✅ |
| Timer 15 menit + auto-expire | ✅ |
| Nomor antrean saat konfirmasi | ✅ |
| Realtime status pesanan | ✅ |

### Admin

| Fitur | Status |
|---|---|
| Login username + role | ✅ |
| Manajemen meja + QR + print | ✅ |
| Dashboard kasir (realtime) | ✅ |
| Konfirmasi pembayaran kasir | ✅ |
| Manajemen menu (CRUD + upload) | ✅ |

### Infrastruktur

| Item | Status |
|---|---|
| `types/database.types.ts` | 🔴 **belum di-generate** → banyak error TS `never` |
| Analytics dashboard (Recharts) | 🔴 belum |
| Export laporan | 🔴 belum |
| Payment gateway QRIS asli | 🔴 belum (dummy) |

---

## 10. YANG MASIH TERSA

1. **Jalankan 3 file migrasi SQL** di Supabase SQL Editor
   (backup → fix → queue number)
2. **Generate Supabase types** — hilangkan error `never` yang banyak:
   ```
   npx supabase gen types typescript --project-id evjlpzxptvvyysglgsyy > types/database.types.ts
   ```
3. **Hapus variabel Relevan dari `.env.example`** — bersihkan sisa copy-paste
   dari project CRM (Telegram, Cron, Resend)
4. **Ganti tombol "Sudah Bayar"** dengan webhook QRIS asli
5. **Dashboard analytics** (Recharts) — belum dikerjakan
6. **Manajemen kategori** di UI owner — backend belum ada
7. **Test alur end-to-end** sebelum go-live

---

*Dokumen ini dibuat 2026-10-16 oleh sesi pengembangan BD Coffee.*
