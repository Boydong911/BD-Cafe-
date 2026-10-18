-- =========================================================
-- DIAGNOSA: kenapa karyawan hasil daftar tidak bisa login
--
-- Jalankan di Supabase SQL Editor (role postgres).
-- Tidak mengubah apa pun -- semua query di bawah hanya SELECT.
--
-- Dua akun yang dicoba: boykeren dan boytampan.
-- GANTI 123456 di Bagian B dengan password yang benar-benar dipakai
-- (6 angka itu).
--
-- Semua query di file ini sudah disesuaikan dengan kolom yang benar-benar
-- ada: public.profiles hanya punya id, username, full_name, role,
-- created_at. Email tidak ada di sana, jadi email diambil dari auth.users.
-- =========================================================


-- ---------------------------------------------------------
-- BAGIAN A: adakah baris di auth.identities untuk tiap akun?
-- ---------------------------------------------------------
-- Ini inti dugaan. Kolom jumlah_identity:
--   0  = dugaan terkonfirmasi. GoTrue tidak pernah diberi identitas
--         untuk akun ini, jadi tidak bisa memverifikasi password-nya.
--   >0 = dugaan salah. Lanjut ke Bagian B.
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
--
-- Kalau muncul error "function crypt does not exist", pgcrypto tidak
-- terlihat dari search_path sesi ini. Abaikan bagian ini dan lanjut ke bagian C.
select
  u.email,
  (u.encrypted_password = crypt('123456', u.encrypted_password)) as password_cocok
from auth.users u
where u.email like '%@cafe.internal';


-- ---------------------------------------------------------
-- BAGIAN C: username yang tersimpan vs yang diketik
-- ---------------------------------------------------------
-- register_staff_account() menyimpan username dalam huruf KECIL.
-- Form login tidak menormalize, jadi kalau diketik "Boykeren" dengan
-- huruf besar, pencocokan gagal dan gejalanya PERSIS sama.
--
-- username_tersimpan semua huruf kecil = aman dari masalah ini.
select
  p.username                                         as username_tersimpan,
  p.full_name                                        as nama,
  p.role                                             as role,
  u.email                                            as email,
  (p.username = lower(btrim(p.username)))            as semua_huruf_kecil
from public.profiles p
left join auth.users u on u.id = p.id
where p.username ilike '%boykeren%'
   or p.username ilike '%boytampan%'
   or p.username ilike '%boy%';


-- ---------------------------------------------------------
-- BAGIAN D: contoh identitas milik akun yang SUDAH bisa login
-- ---------------------------------------------------------
-- to_jsonb() dipakai supaya query ini tidak mungkin gagal karena nama
-- kolom auth.identities berbeda antar versi Supabase: dia membungkus
-- seluruh baris apa adanya. Pola inilah yang harus disalin persis saat
-- memperbaiki.
--
-- Expected baris paling sedikit 1: akun owner.
select
  u.email,
  to_jsonb(i) as isi_baris_identitas
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
