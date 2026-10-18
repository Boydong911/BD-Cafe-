-- =========================================================
-- DIAGNOSA: kenapa karyawan hasil daftar tidak bisa login
--
-- Jalankan di Supabase SQL Editor (role postgres).
-- Tidak mengubah apa pun -- semua query di bawah hanya SELECT.
--
-- Dua akun yang dicoba: boykeren dan boytampan.
-- GANTI 123456 di Bagian B dengan password yang benar-benar dipakai
-- (6 angka itu).
-- =========================================================


-- ---------------------------------------------------------
-- BAGIAN A: adakah baris di auth.identities untuk tiap akun?
-- ---------------------------------------------------------
-- Ini inti dugaan. Kolom jumlah_identity:
--   0  = BUKAN penyebab. Lanjut ke Bagian B.
--   >0 = penyebabnya ketemu. auth.identities kosong = GoTrue tidak
--         pernah diberi identitas untuk akun ini, jadi tidak bisa
--         memverifikasi password-nya.
select
  u.email                                            as email,
  p.username                                         as username,
  p.role                                             as role,
  (p.id is not null)                                 as ada_profile,
  (select count(*)
     from auth.identities i
    where i.user_id = u.id)                          as jumlah_identity,
  left(u.encrypted_password, 7)                      as awal_hash,
  (u.email_confirmed_at is not null)                 as email_terkonfirmasi,
  u.created_at                                       as dibuat
from auth.users u
left join public.profiles p on p.id = u.id
where u.email like '%@cafe.internal'
order by u.created_at;


-- ---------------------------------------------------------
-- BAGIAN B: apakah hash password-nya benar-benar cocok?
-- ---------------------------------------------------------
-- GANTI 123456 dengan password yang dipakai.
-- password_cocok = true  -> hash-nya benar, masalahnya di luar password.
-- password_cocok = false -> hash-nya tidak cocok dengan yang diketik.
select
  u.email,
  (u.encrypted_password = crypt('123456', u.encrypted_password)) as password_cocok
from auth.users u
where u.email like '%@cafe.internal';


-- ---------------------------------------------------------
-- BAGIAN C: apakah username yang diketik cocok dengan yang tersimpan?
-- ---------------------------------------------------------
-- register_staff_account() menyimpan username dalam huruf KECIL.
-- Kalau diketik "Boykeren" (huruf besar), pencocokan gagal dan
-- gejalanya persis sama: "Username atau password salah".
select username, email
from public.profiles
where username ilike '%boykeren%' or username ilike '%boytampan%';


-- ---------------------------------------------------------
-- BAGIAN D: contoh identitas milik akun yang SUDAH bisa login
-- ---------------------------------------------------------
-- Ini pola yang harus diikuti saat memperbaiki. Salin nilainya persis.
select
  i.provider,
  i.provider_id,
  i.identity_data,
  u.email
from auth.identities i
join auth.users u on u.id = i.user_id
order by u.created_at
limit 5;


-- ---------------------------------------------------------
-- BAGIAN E: struktur tabel auth.identities di database ini
-- ---------------------------------------------------------
-- Dipakai supaya perbaikannya ditulis sesuai kolom yang benar-benar ada,
-- bukan asumsi.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'auth'
  and table_name = 'identities'
order by ordinal_position;