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

Riwayat 15-19 Okt 2026 (15 migrasi terpasang + 12 rollback) mencair ke
`../sql-editor/02-install-database-baru.sql`; file aslinya masih ada di
riwayat git bila perlu menoleh.
