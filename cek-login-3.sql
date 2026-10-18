-- =========================================================
-- CEK KILAT 2: tiga hal yang belum diketahui
--
-- Jalankan di Supabase SQL Editor (role postgres).
-- Hanya satu query, hasilnya langsung menjawab hampir semua
-- pertanyaan yang tersisa.
--
-- GANTI 123456 dengan password yang benar-benar dipakai.
--
-- Cara baca tiap kolom:
--
--   jumlah_identity
--     1 = baris auth.identities sudah ada. Kalau 0, migrasi yang
--         tadi tidak berefek dan itu penyebabnya.
--
--   email_ditemukan
--     Isi dengan email = langkah pertama login (get_login_email)
--     berhasil. Kosong = username tidak ketemu, masalahnya ada
--     sebelum password diperiksa sama sekali.
--
--   awal_hash
--     Harus diawali "$2a$" atau "$2b$". Kalau "$2" tapi bentuknya
--     aneh, atau panjangnya bukan 60, hash-nya tidak berbentuk bcrypt
--     yang bisa dibaca GoTrue.
--
--   pw_cocok
--     true = password yang diketik cocok dengan hash yang tersimpan.
--     false = passwordnya yang beda, dan itu berarti masalahnya di
--     sisi data password, bukan di sisi GoTrue.
--
--   bcrypt_valid_pgcrypto
--     true kalau pgcrypto bisa membaca hash yang tersimpan. Kalau false,
--     hash-nya rusak atau bukan bcrypt sama sekali.
-- =========================================================

select
  u.email                                                      as email,
  p.username                                                   as username,
  p.role                                                       as role,

  -- A: apakah identitas sudah ada sekarang
  (select count(*)
     from auth.identities i
    where i.user_id = u.id)                                    as jumlah_identity,

  -- B: apakah langkah pertama login menemukan email
  public.get_login_email(p.username)                           as email_ditemukan,

  -- C: bentuk hash password
  left(u.encrypted_password, 7)                                as awal_hash,
  (u.encrypted_password like '$2%')                            as format_bcrypt,
  length(u.encrypted_password)                                as panjang_hash,
  coalesce(u.encrypted_password is not null
           and length(u.encrypted_password) = 60, false)       as panjang_bcrypt_60,

  -- apakah hash cocok dengan password yang diketik
  (u.encrypted_password = crypt('123456', u.encrypted_password)) as pw_cocok,

  -- apakah pgcrypto bisa membaca hash itu sendiri
  coalesce(crypt('123456', u.encrypted_password) is not null, false) as bcrypt_valid_pgcrypto

from auth.users u
join public.profiles p on p.id = u.id
where u.email like '%@cafe.internal'
order by u.created_at;
