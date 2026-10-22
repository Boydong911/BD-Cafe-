# BD Coffee — Roadmap Multi-Outlet

Dibuat: 20 Okt 2026 · Versi: 1.1 · Status: TAMAT — Tahap 1, 2, 3 selesai & diuji (21–22 Okt 2026).
File ini acuan kerja resmi. Setelah memasuki agent build, salinan resmi ditaruh di
`cafe-app/BD-Coffee-Roadmap-Outlet.md` (root repo) + commit; tahap selesai centang bagian 6.

---

## 0. Keputusan final (terkunci 20 Okt 2026 — tidak berubah diam-diam)

| # | Hal | Keputusan |
|---|---|---|
| 1 | Outlet A (pusat) | Seluruh data yang ada sekarang (menu, meja, pesanan, sejarah, akun kasir) menjadi milik **Outlet A — pusat**, slug `outlet-a` |
| 2 | Bentuk URL | Tiap outlet berjalur sendiri: `/outlet-a/menu?table=05`, `/outlet-a/login/kasir`, `/outlet-a/daftar`, `/outlet-a/admin/kasir`; outlet baru seterusnya dengan slug-nya masing-masing |
| 3 | Slug beku | Slug dibuat otomatis sekali (`outlet-a`, `outlet-b`, ...) lalu **tidak pernah diubah** — nama outlet bebas diedit kapan saja. Alasan: slug tercetak di QR; ubah slug = semua QR tercetak di outlet itu mati |
| 4 | Slug terlarang | Slug tak boleh sama dengan rute inti: `login`, `menu`, `admin`, `daftar`, `order`, `checkout`, `api`, `_next`, `favicon.ico` |
| 5 | URL & QR lama | `/menu?table=05`, `/login/kasir`, `/daftar`, `/admin/kasir` otomatis diarahkan ke slug pusat — QR yang sudah tercetak tetap jalan tanpa diganti |
| 6 | Dashboard owner | Tetap global di `/admin/owner/*` + **pemilih outlet** di sidebar; pilihan tercatat di URL (`?outlet=outlet-b`) agar bisa di-bookmark |
| 7 | "Menu ikut" | **Salinan sekali**: saat outlet dibuat, menu pusat difotokopi menjadi milik outlet baru; setelah itu berdiri sendiri — mengubah menu di pusat tidak menyentuh salinan |
| 8 | Kategori | **Global** — satu kumpulan kategori dipakai semua outlet; hanya menu item yang milik per outlet |
| 9 | "Buat menu sendiri" | Menu outlet itu kosong → halaman pelanggan menampilkan *"Maaf, menu belum ada."* |
| 10 | Kasir & outlet | **1 akun kasir = tepat 1 outlet** (owner dapat memindahkannya lewat dashboard); **owner menjangkau semua outlet** |
| 11 | Dinding kasir | Dijaga di SERVER (RLS + pemeriksaan saat login): kasir A yang mencoba login/logout di halaman kasir B ditolak dengan pesan jelas, begitu pun sebaliknya — bukan sekadar tombol disembunyikan |
| 12 | Isolasi alur pemesanan | Pesanan A dan B **tak pernah bercampur**: outlet tertanam di setiap pesanan sejak dibuat (mengikuti meja dari QR). Dari menu, checkout, nomor antrian, papan kasir, sampai pembayaran — semuanya di jalurnya sendiri. Customer tidak perlu memilih outlet (ikut meja tempat duduk) |
| 13 | Nomor antrian | **Per outlet per hari**: tiap outlet mulai dari `01` hari itu; format `ORD-YYYYMMDD-XX` tetap. Trigger nomor diubah dari satu buku global menjadi per-outlet |
| 14 | Laporan penjualan | Per outlet (mengikuti pemilih) + mode **"Semua Outlet"** (gabungan); tabel pesanan menandai outlet-nya |
| 15 | Mengurangi outlet | **Arsip nonaktif** — data & sejarah tetap aman, dapat dinyalakan lagi; tidak pernah hard-delete |
| 16 | Tanggal bangun | Disimpan & tampil di kartu outlet; hanya info/badge, tidak memengaruhi laporan |
| 17 | Auto-create | Saat **[Create Outlet Baru]**: outlet dibuat + **Meja 1** (beserta kartu QR + URL QR-nya) + **login page kasir** outlet + **halaman kasir** outlet. Awalnya hanya owner yang bisa masuk halaman kasir baru; karyawan baru dapat **daftar akun kasir** di `/{slug}/daftar` |
| 18 | Data lama | Semuanya ditanam ke Outlet A saat migrasi Tahap 1 — sejarah tidak ada yang hilang |

Pagar kecil yang ikut tercatat:
- Foto menu salinan berbagi file dengan asalnya: menghapus foto di A menghilangkannya dari salinan B, selama B belum menggantinya dengan foto sendiri.
- Akun kasir yang sudah ada (`boykeren`, `boytampan`, `boykece`, `boymantap`) otomatis ditetapkan ke Outlet A.

---

## 1. Prosedur kerja (sama untuk tiap tahap)

1. **Backup dulu**: jalankan `supabase/sql-editor/01-cek-kesehatan.sql` sebelum dan sesudah SQL.
2. **SQL = file baru** di `supabase/migrations/2026MMDD-<nama>.sql` sesuai aturan
   `supabase/sql-editor/00-PROSEDUR.md` bagian 4 (idempoten, jangan edit file yang sudah jalan).
   Ditempel oleh user di SQL Editor — selalu dijelaskan pendek apa yang dijalankan dan hasil yang diharapkan.
3. **Kode**: kerjakan scope tahap itu penuh; `npx tsc --noEmit` harus bersih.
4. **User menguji** daftar uji tahap tersebut → baru commit (message jelas) — **tanpa push, selamanya**.
5. Centang checklist bagian 6 dan sisipkan hasil uji ke file roadmap.

---

## 2. Tahap 1 — Pondasi database + manajer outlet (owner)

**SQL (migrations):**
- [ ] Tabel `outlets` (id, slug unik, nama, tanggal_bangun, menu_mode `salinan`|`sendiri`, is_pusat, is_active, dibuat_at)
- [ ] `outlet_id` ditambahkan ke: `tables`, `menu_items`, `orders`, `profiles` (staff), dan tabel pendaftaran akun bila ada
- [ ] Seeder: Outlet A pusat + semua data lama → Outlet A (termasuk 4 akun kasir lama)
- [ ] Batasan unik: `tables (outlet_id, table_number)`; `orders (outlet_id, order_number)` → dasar penomoran 01 per outlet
- [ ] RLS: kasir hanya melihat pesanan outletnya; owner semua outlet; pelanggan tetap via RPC seperti sekarang
- [ ] RPC: `create_staff_account` & pendaftaran akun mengerti outlet; checkout menempelkan outlet dari meja;
      trigger nomor pesanan jadi per outlet; `get_sales_report` menerima `p_outlet_id` (null = semua outlet)

**Owner UI:**
- [ ] Halaman baru **"Outlet"** di `/admin/owner`: kartu daftar outlet (nama, slug, tanggal bangun, mode menu, status aktif/arsip)
- [ ] Form tambah outlet: **nama** (editable), **tanggal bangun**, **mode menu** (ikut menu yang ada / buat menu sendiri), tombol **[Create Outlet Baru]** dan **[Batalkan]**
- [ ] Mode salinan: menu pusat difotokopi menjadi milik outlet baru saat create; mode sendiri: kosong
- [ ] Edit nama & tanggal bangun; **arsip** (nonaktifkan) dan nyalakan kembali; pemindahan kasir antar outlet
- [ ] **Pemilih outlet** di sidebar; halaman Karyawan / Meja / Menu mengikuti pilihan (Kategori tetap global)
- [ ] Catatan kecil di UI: Meja 1 + QR dan halaman kasir outlet baru aktif di Tahap 2

**Daftar uji Tahap 1:**
- Buat outlet mode salinan → menu tersalin; mengubah menu di pusat → salinan tidak berubah
- Buat outlet mode sendiri → menu outlet itu kosong
- Arsipkan outlet → hilang dari pemilih tetapi datanya masih ada
- Kasir lama tetap bisa bekerja seperti biasa (semuanya masih Outlet A)

---

## 3. Tahap 2 — URL per outlet + kasir per outlet + Meja 1 & QR

**Routing & middleware:**
- [ ] Rute hidup `app/[outlet]/…`: `menu`, `login/kasir`, `daftar`, `admin/kasir` — slug tak dikenal → 404
- [ ] Redirect lama → slug pusat: `/menu?table=*`, `/login/kasir`, `/daftar`, `/admin/kasir`
- [ ] Middleware seat: `/{slug}/login/kasir` & `/{slug}/admin/kasir` = seat kasir; `/{slug}/menu` = publik; sisanya tetap seperti sekarang

**Dinding kasir (server):**
- [ ] Login kasir: akun dari outlet lain ditolak dengan pesan jelas ("kamu terdaftar di Outlet A") — dan sebaliknya
- [ ] Halaman kasir outlet: pemeriksaan ganda (server page + RLS); board, polling, dan realtime ter-filter per outlet
- [ ] Awal outlet baru: hanya owner yang bisa masuk halaman kasirnya

**Auto-create lengkap:**
- [ ] Saat [Create Outlet Baru]: Meja 1 otomatis + kartu QR siap cetak di dashboard owner
- [ ] Login page kasir outlet + papan kasir outlet langsung hidup
- [ ] Daftar akun kasir lewat `/{slug}/daftar`
- [ ] Halaman pelanggan: mode sendiri & kosong → *"Maaf, menu belum ada."*; mode salinan → salinan tampil

**Daftar uji Tahap 2:**
- Scan QR Meja 1 outlet baru → halaman menu outlet itu (review menu)
- Login kasir A di halaman kasir B → ditolak; kasir B di halaman A → juga ditolak
- Daftar akun kasir baru di outlet B → login sukses di sana, gagal di outlet A
- Owner tetap bisa masuk papan kasir semua outlet
- Pesanan dari QR outlet B masuk antrean kasir B dengan nomor antrian B sendiri

---

## 4. Tahap 3 — Laporan per outlet + perapihan

- [ ] Penjualan: mode **"Semua Outlet"** (gabungan) + per outlet (mengikuti pemilih); kolom outlet di tabel pesanan; grafik ikut mode
- [ ] README: bagian URL outlet & cara mengelola outlet
- [ ] Perapihan sisa (rute mati, teks, struktur kecil); `tsc` bersih; commit penutup
- [ ] Salinan roadmap di repo ditandai selesai

**Daftar uji Tahap 3:** laporan per outlet & gabungan konsisten; angka gabungan = jumlah semua outlet.

---

## 5. Yang sengaja TIDAK dibuat (agar tidak melebar)

- Harga/stok berbeda antar outlet selama mode salinan (salinan = fotokopi murni)
- Kasir multi-outlet (satu akun dipakai di banyak outlet)
- Kategori per outlet
- Slug yang bisa diedit
- Mengubah mode menu setelah outlet dibuat (perubahan mode menyusul bila kelak diminta)

---

## 6. Riwayat kemajuan

- [x] **Tahap 1** — pondasi DB + manajer outlet owner (diuji 20–21 Okt 2026: buat outlet salinan/sendiri, arsip, kasir lama tetap bekerja)
- [x] **Tahap 2** — URL outlet + kasir per outlet + Meja 1/QR + menu pelanggan (diuji 21 Okt: QR → menu per outlet, menu jus alpukat outlet B tidak bocor ke A, pembelian Tunai & QRIS dua outlet)
  - tambahan setelah uji: sesi kasir jadi **per outlet** (cookie `sb-…-kasir-<slug>`) supaya dua tab board outlet berbeda login/logout mandiri; gerbang penugasan kasir di pintu login (kasir outlet lain ditolak & diarahkan); pintu login kasir menolak slug tak dikenal (404)
- [x] **Tahap 3** — laporan & perapihan (diuji 22 Okt 2026: omzet "Semua Outlet" = jumlah outlet-a + outlet-b; grafik & 5 Menu Terlaris ikut pemilih; kolom Tanggal & Jam + Outlet di tabel pesanan; riwayat 25/halaman + tombol halaman; README bagian URL & outlet; pembersihan revalidatePath ke jalur dinamis)

**Roadmap multi-outlet TAMAT** — seluruh tahap selesai & teruji.
