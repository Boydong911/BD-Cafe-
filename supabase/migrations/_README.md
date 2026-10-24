# migrations — perubahan database SETELAH 20 Okt 2026

Folder ini hidup kembali sebagai tempat rutinitas: satu perubahan
database = satu file baru, seperti pola yang dipakai 15-19 Okt.

Aturan main:

1. Penamaan: `20261021-<nama>.sql` — tanggal dulu, supaya urutan nama
   file = urutan pemasangan di database baru.
2. Komentar atas di setiap file mencatat: gejala yang dilihat, isi
   perbaikan, dan (bila penting) keadaan sebelum perbaikan.
3. File yang SUDAH dijalankan di database tidak boleh diedit isinya.
   Kalau isi salah, buat file baru yang memperbaiki - jangan menyulap
   riwayat.
4. Wajib idempoten (aman dijalankan dua kali): pakai guard seperti
   `where ... is null`, `if not exists`, atau `create or replace`.
5. Rollback (kalau benar-benar perlu) = file terpisah
   `20261021-rollback-<nama>.sql`. Ingat: rollback ke versi lampau di
   database yang sudah berubah bisa memasang ulang bug (kasus 19 Okt).
6. Prosedur menjalankan & diagnosa tetap di `../sql-editor/`:
   `00-PROSEDUR.md` dan `01-cek-kesehatan.sql`.
7. Setiap migrasi baru yang sudah dijalankan di project aktif WAJIB diikutkan
   ke installer `../sql-editor/02-install-database-lengkap.sql` — leburkan
   manual sebagai BAGIAN baru paling bawah + perbarui header-nya (langkah
   rinci: bagian 4 `../sql-editor/00-PROSEDUR.md`). Prinsipnya: siapapun
   yang install tinggal paste SATU file, tidak perlu mengejar file migrasi
   satu per satu. Setelah melebur, file migrasi di folder ini boleh
   dihapus (isinya aman di installer & riwayat git) supaya folder bersih.

Riwayat 15-19 Okt 2026 (15 migrasi terpasang + 12 rollback) melebur ke
bekuan `02-install-database-baru.sql`; bekuan itu kini JADI BAGIAN 1 dari
`../sql-editor/02-install-database-lengkap.sql` (file bekuan sendiri
dihapus; aslinya di riwayat git).
