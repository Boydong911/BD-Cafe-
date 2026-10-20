# 00-PROSEDUR — Cara Menjalankan SQL di Supabase SQL Editor

Folder ini adalah **satu-satunya pintu** untuk semua pekerjaan database:
Database (tabel, index, fungsi), Auth (akun, login), dan Keamanan (RLS, policy).

Perubahan database ke depan ditulis sebagai file baru di `supabase/migrations/`
(aturannya di bagian 4). Folder ini menyimpan: prosedur, diagnosa, dan
skema dasar beku 20 Okt 2026.

Server aplikasi Next.js **tidak pernah diutak-atik** untuk urusan database —
semua perubahan database ditempel langsung di Supabase Dashboard → **SQL Editor**.

---

## 1. Isi folder ini

| File | Buat apa | Kapan boleh jalan |
|---|---|---|
| `01-cek-kesehatan.sql` | Semua diagnosa (dashboard, akun, login 500). Seluruhnya `SELECT`, tidak mengubah apa pun | **Kapan saja** (bisa dijalankan berulang, 100% aman) |
| `02-install-database-baru.sql` | Perintah SKEMA lengkap: gabungan 17 file asli (schema + storage + 15 migrasi) dalam urutan pemasangan. Isinya DIBEKUKAN pada 20 Okt 2026 | **HANYA database baru yang kosong** — setelahnya lanjut file `../migrations/` bertanggal sesudah 20 Okt, urut nama. Di database yang sudah berjalan: TIDAK BOLEH |
| `../migrations/2026MMDD-*.sql` | Perubahan database berikutnya: satu perubahan = satu file di `supabase/migrations/` (lihat bagian 4) | Sesuai isinya — biasanya sekali jalan, tidak diulang |

---

## 2. Prosedur standar menjalankan SQL (ikuti selalu)

**Sebelum menjalankan apa pun yang BUKAN file cek** (yaitu yang bisa mengubah
data/tabel): buka Dashboard → **Database → Backups** dan pastikan ada backup
terbaru di hari yang sama. Kalau tidak ada, buat dulu. File cek (`01-…`)
tidak butuh langkah ini.

Langkah di SQL Editor:

1. **Buka** Supabase Dashboard → menu **SQL Editor** → tombol **New query**.
2. **Paste SATU bagian saja** dari file yang relevan — praktisnya satu
   blok komentar sampai blok berikutnya. Kalau masih dipelajari, paste
   seluruh file juga boleh (`01-…` aman; `02-…` untuk install penuh).
3. Klik **Run** (atau Ctrl+Enter).
4. **Baca hasilnya** — jangan hanya melihat "Success":
   - Bagian bawah panel = hasil tabel. Angka `0` atau `NULL` sering adalah
     PETUNJUK, bukan kegagalan; komentar di atas setiap query menjelaskan
     pembacaannya.
5. **Kalau muncul error: BERHENTI.** Jangan asal mengeksekusi
   perintah lain "coba-coba memperbaiki". Copy-paste pesan errornya
   (baris pertama + query apa yang sedang dijalankan) — itu material
   diagnosis; menebak-nebak yang sering membuat keadaan lebih kacau.
6. **Catat apa yang baru dilakukan** di akhir percakapan dengan AI /
   commit message, bertgl, supaya jejaknya jelas.

---

## 3. Aturan aman per kategori

### Database (tabel, index, fungsi)
- Tabel & fungsi = milik `public.*`. Kalau perintah `create table ...` gagal
  karena "already exists", itu tanda file ditempel pada database yang SALAH
  (sudah terisi) — bukan alasan memaksa `drop` yang lama.
- Semua migrasi lama sudah **terpasang dan menjadi bagian dari
  `02-install-database-baru.sql`**. Di database yang sedang jalan,
  migrasi lama TIDAK diulang.

### Auth (akun, login)
- Tabel `auth.users`, `auth.identities`, dst. milik GoTrue. **Jangan pernah
  INSERT manual** baris baru di sana — semua pembuatan akun lewat function
  `create_staff_account` / `register_staff_account` (SQL sudah lengkap menulis
  semua kolom wajib: token, timestamp, dll. — pelajaran pahit 19 Okt).
- Jenjang mengecek akun: jalankan **Bagian B** `01-cek-kesehatan.sql`.
- Jangan isi password acak ke `encrypted_password` — itu harus bcrypt;
  function SQL-nya yang menangani.

### Keamanan (RLS & policy)
- Policy RLS adalah pengunci akses baris. **Jangan menghapus policy
  "supaya bisa masuk"** — itu biasanya membuka lebih besar dari yang
  diminta. Kalau ada 403, cari policy mana yang berhenti (/database/policies
  di Dashboard), baca logika `is_owner()` / `is_staff()`.
- Setelah menyentuh policy, uji DUA kondisi: akun owner DAN akun kasir,
  jangan cuma satu (kasir yang kebuka adalah bencana diam-diam).
- Kalau perlu menutup celah: buat file perbaikan baru yang MENGETAT, dan
  jalankan; jangan biarkan celah "nanti-dipikirkan".

---

## 4. Menambah perbaikan / perubahan database

Satu perubahan = satu file BARU di `supabase/migrations/` — pola yang
dipakai 15-19 Okt. Penamaan: `20261021-<nama>.sql` (tanggal dulu, supaya
urutan nama file = urutan pemasangan). Komentar atas di file itu mencatat:

1. Gejala apa yang dilihat.
2. Isi perbaikan dan seberapa luas (tabel mana, baris mana).
3. Rollback bila penting: keadaan "sebelum perbaikan".

Lalu jalankan file itu lewat prosedur bagian 2, dan jangan lupa commit.

Tiga tali pengaman supaya aman:

- File yang SUDAH dijalankan di database JANGAN diedit isinya (salah
  tulis? buat file baru berikutnya yang memperbaiki, bukan menyulap
  file lampau).
- Idempoten = aman dijalankan dua kali: bila perbaikan menulis
  `update ... set x = ...`, tambahkan `where ... is null` (atau kondisi
  lain) sehingga dieksekusi ulang pun hasilnya sama.
- Rollback = file terpisah (`20261021-rollback-<nama>.sql`). Ingat:
  rollback ke versi lampau di database yang sudah berubah bisa memasang
  ulang bug yang dulu sudah dibeneri (persis kasus 19 Okt).

`02-install-database-baru.sql` TIDAK di-update setiap ada perubahan —
isinya dibekukan per 20 Okt 2026. Membangun database baru dari nol =
tempel file itu dulu, lalu jalankan file-file `../migrations/` yang
bertanggal sesudah 20 Okt, urut nama file.

---

## 5. Sejarah singkat (rantai yang sudah terpasang)

Semua bagian `02-install-database-baru.sql` dulu berbentuk file terpisah
dan dijalankan satu per satu di SQL Editor antara 15–19 Okt 2026:

1. `schema.sql` — tabel dasar (profiles, categories, menu_items, orders,
   order_items, tables), fungsi `get_login_email`, RLS dasar, fungsi laporan.
2. storage-policies.sql — bucket menu-images + policy owner.
3. 15 migrasi Oct 15–19: menu kustomisasi + nomor order, kategori dua tingkat,
   nomor antrean saat konfirmasi bukan saat checkout, RPC pembayaran QRIS
   (confirm/cancel), laporan zona WIB, `confirm_cash_payment`, fungsi
   manajemen staff, opsi gula minuman, anti tabrakan nomor order,
   pengetatan RLS orders + RPC baca by-id pelanggan, penempelan search_path
   pgcrypto, dan rangkaian perbaikan akun staff (identities → insert id →
   token kolom) yang menuntaskan masalah login 500.

File file aslinya masih terselamatkan di riwayat git (bila perlu menoleh),
sehingga folder supabase jadi bersih dari berkas-berkas yang menyerupai
tapi tak lagi perlu.

---

*Koreksi terakhir: 20 Okt 2026 — folder sql-editor dibuat bersama Ponytail.*
