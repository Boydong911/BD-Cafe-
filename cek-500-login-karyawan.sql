-- =========================================================
-- CEK KILAT: 500 "Database error querying schema" saat login kasir
--
-- Jalankan di Supabase SQL Editor (role postgres). Semua SELECT,
-- tidak mengubah apa pun. Copy SEMUA hasilnya (dua tabel) ke AI.
--
-- Latar: dulu gejala login kasir = 400 "Invalid login credentials"
-- (tidak ada baris auth.identities). Sudah di-levelkan dengan
-- backfill auth.identities sekaligus fungsi pendaftaran versi baru.
-- Gejala sekarang BERBEDA: 500 "Database error querying schema",
-- muncul ~1 ms bahkan dengan password salah -> GoTrue menemukan
-- akun-nya, lalu error SEBELUM perbandingan bcrypt berjalan.
--
-- Cara baca tabel 1 (satu baris per akun @cafe.internal):
--
--   email / role                 akun siapa; sebaiknya ada owner + kasir
--   jumlah_email_sama            kalau > 1: ada duplikasi email di auth.users
--   id                           penanda akun
--   aud / role_app               keduanya wajib 'authenticated'
--   instance_id                  wajib '00000000-0000-0000-0000-000000000000'
--   email_confirmed_at           wajib TIDAK NULL
--   banned_until                 wajib NULL (kalau ada isinya -> akun diblok)
--   hash_awal / panjang_hash     wajib diawali $2 ya/$2b$ dan panjang 60
--   jumlah_identity              wajib >= 1 (hasil backfill tadi)
--   identitas                    isi baris auth.identitas milik akun ini,
--                                dibandingkan dengan baris milik OWNER
--                                (satu-satunya akun yang login-nya terbukti)
--
-- Cara baca tabel 2 (satu baris per akun, dari sudut identitas):
--
--   baris penyebab 500 yang paling jauh... kalau jumlah_baris_identitas
--   bernilai 0 untuk kasir, berarti backfill TIDAK jalan di DB ini dan
--   500 pun berasal dari tempat lain — keduanya data yang valid.
-- =========================================================

select
  u.email,
  p.role,
  count(*) over (partition by lower(u.email)) as jumlah_email_sama,
  u.id::text                                  as id,
  u.aud                                       as aud,
  u."role"                                    as role_app,
  u.instance_id::text                         as instance_id,
  u.email_confirmed_at,
  u.banned_until,
  left(u.encrypted_password, 7)               as hash_awal,
  length(u.encrypted_password)                as panjang_hash,
  (select count(*)
     from auth.identities i
    where i.user_id = u.id)                   as jumlah_identity,
  (select jsonb_agg(to_jsonb(i) order by i.created_at)
     from auth.identities i
    where i.user_id = u.id)                   as identitas,
  u.raw_app_meta_data,
  u.is_sso_user,
  u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where u.email like '%@cafe.internal'
order by u.created_at;

-- =========================================================
-- Tabel 2: semuanya baris auth.identitas akun kasir VS owner,
-- dilihat dari kunci unik tabel-nya: (provider_id, provider).
-- Tujuan: mencari perbedaan yang bisa membuat query GoTrue gagal.
-- =========================================================

select
  i.provider,
  i.provider_id,
  u.email                                  as email_user,
  i.identity_data,
  i.email                                  as email_generated,
  i.last_sign_in_at,
  i.created_at,
  identity_data->>'email' = u.email        as email_identitas_cocok
from auth.identities i
join auth.users u on u.id = i.user_id
where u.email like '%@cafe.internal'
order by u.created_at, i.provider;
