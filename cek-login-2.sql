-- =========================================================
-- DIAGNOSA 2: karyawan tetap tidak bisa login setelah auth.identities
-- diperbaiki
--
-- Jalankan di Supabase SQL Editor (role postgres).
-- Hanya SELECT, tidak mengubah apa pun.
--
-- Gambaran sekarang:
--   boykeren, boytampan  -> tidak bisa login
--   boykece (baru)       -> tidak bisa login
--   boy123 (owner)       -> bisa login
--
-- Jadiakisunya bukan data akun-akun itu, tapi sesuatu yang berlaku
-- untuk SEMUA akun yang dibuat lewat fungsi SQL, dan tidak berlaku
-- untuk akun yang dibuat lewat Supabase Admin API.
--
-- Strategi file ini: bandingkan tiap akun langsung dengan akun owner,
-- kolom demi kolom. Akun owner adalah satu-satunya yang login-nya
-- terbukti jalan, jadi setiap perbedaan adalah petunjuk.
-- =========================================================


-- ---------------------------------------------------------
-- BAGIAN A: apakah baris auth.identities benar-benar ada sekarang?
-- ---------------------------------------------------------
-- Kalau jumlah_identity masih 0, migrasi belum berefek sama sekali
-- dan tidak perlu lanjut ke bagian lain.
--
-- Kalau sudah 1 tapi login tetap gagal, berarti identitas bukan
-- penyebabnya. Lanjut ke bagian B.
select
  u.email                                          as email,
  p.username                                       as username,
  p.role                                           as role,
  (select count(*) from auth.identities i
    where i.user_id = u.id)                        as jumlah_identity,
  to_jsonb(i) ->> 'provider'                       as provider,
  to_jsonb(i) ->> 'provider_id'                    as provider_id,
  to_jsonb(i) ->> 'email'                          as kolom_email,
  to_jsonb(i) -> 'identity_data' ->> 'email'       as email_di_identity_data,
  (to_jsonb(i) -> 'identity_data' ->> 'sub') = u.id::text as sub_cocok,
  to_jsonb(i) -> 'identity_data' ->> 'email_verified' as email_verified
from auth.users u
left join public.profiles p on p.id = u.id
left join auth.identities i on i.user_id = u.id
where u.email like '%@cafe.internal'
order by u.created_at;


-- ---------------------------------------------------------
-- BAGIAN B: apakah langkahlama login sudah bisa menemukan email?
-- ---------------------------------------------------------
-- Ini meniru langkah pertama verifyCredentials():
--   get_login_email('boykeren')
--
-- Kalau hasilnya NULL, masalahnya ada SEBELUM password, di pencarian
-- username. Kalau ada email-nya, masalahnya ada di password.
--
-- Jalankan sebagai rpc supaya sama persis dengan yang dipanggil aplikasi.
-- lastik: baris kosong berarti rpc-nya tidak mengembalikan apa-apa.
select 'boykeren' as diinput, public.get_login_email('boykeren') as hasil;
select 'boytampan' as diinput, public.get_login_email('boytampan') as hasil;
select 'boykece' as diinput, public.get_login_email('boykece') as hasil;
select 'boy123' as diinput, public.get_login_email('boy123') as hasil;


-- ---------------------------------------------------------
-- BAGIAN C: apakah hash password cocok dengan yang diketik?
-- ---------------------------------------------------------
-- GANTI 123456 dengan password yang benar-benar dipakai.
select
  u.email,
  left(u.encrypted_password, 7)                     as awalhash,
  (u.encrypted_password like '$2%')                 as format_bcrypt,
  length(u.encrypted_password)                     as panjang_hash,
  (u.encrypted_password = crypt('123456', u.encrypted_password)) as password_cocok
from auth.users u
where u.email like '%@cafe.internal'
order by u.created_at;


-- ---------------------------------------------------------
-- BAGIAN D: bandingkan tiap akun dengan akun owner
-- ---------------------------------------------------------
-- Ini bagian terpenting. Semua nilai diambil lewat to_jsonb()->>'nama'
-- supaya kalau suatu kolom tidak ada, hasilnya NULL dan query TIDAK
-- gagal. Itulah gunanya, bukan sekadar catching error.
--
-- Yang dicari: kolom yang kosong di akun kasir tapi terisi di akun
-- owner. GoTrue/lowercase bisa menyaring baris berdasarkan kolom
-- tertentu, jadi kolom kosong = akun tidak pernah terlihat.
select
  u.email                                                        as email,
  to_jsonb(u) ->> 'instance_id'                                  as instance_id,
  (to_jsonb(u) ->> 'instance_id') = (to_jsonb(o) ->> 'instance_id') as instance_sama,
  (to_jsonb(u) ->> 'is_anonymous')                               as is_anonymous,
  (to_jsonb(o) ->> 'is_anonymous')                               as owner_is_anonymous,
  (to_jsonb(u) ->> 'is_sso_user')                                as is_sso_user,
  (to_jsonb(o) ->> 'is_sso_user')                                as owner_is_sso_user,
  (to_jsonb(u) ->> 'confirmed_at')       is null                  as confirmed_at_kosong,
  (to_jsonb(o) ->> 'confirmed_at')       is null                  as owner_confirmed_kosong,
  (to_jsonb(u) ->> 'email_confirmed_at') is null                  as email_confirmed_kosong,
  (to_jsonb(o) ->> 'email_confirmed_at') is null                  as owner_email_confirmed_kosong,
  (to_jsonb(u) ->> 'confirmation_sent_at') is null                as sent_at_kosong,
  (to_jsonb(o) ->> 'confirmation_sent_at') is null                as owner_sent_at_kosong,
  to_jsonb(u) ->> 'last_sign_in_at'                               as last_sign_in_at,
  to_jsonb(o) ->> 'last_sign_in_at'                               as owner_last_sign_in_at,
  to_jsonb(u) ->> 'recovery_token'                                as recovery_token,
  to_jsonb(u) ->> 'email_change_token_new'                        as email_change_token,
  to_jsonb(u) ->> 'is_super_admin'                                as is_super_admin
from auth.users u
cross join auth.users o
where o.email = 'boy123@cafe.internal'
  and u.email like '%@cafe.internal'
order by u.created_at;
