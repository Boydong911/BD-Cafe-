-- ============================================================================
-- 01-CEK-KESEHATAN — DIAGNOSA AMAN, BOLEH JALAN KAPAN SAJA
--
-- Seluruh query di file ini hanya SELECT / pemanggilan function pemantau.
-- TIDAK SATU PUN yang mengubah data, policy, atau fungsi.
--
-- Cara pakai di Supabase SQL Editor:
--   1. Salin SATU bagian yang relevan (atau seluruh file), paste, Run.
--   2. Bandingkan hasilnya dengan "yang wajib benar" di komentar tiap bagian.
--
-- Sejarah: file ini melebur 7 file diagnosis lama yang dulu tersebar
-- (cek-dashboard-kosong, cek-identitas-karyawan, cek-login-karyawan,
--  cek-login-2, cek-login-3, cek-500-login-karyawan, cek-500-deep).
-- ============================================================================


-- ============================================================================
-- BAGIAN A — KESEHATAN DASHBOARD OWNER (kartu omzet / grafik kosong?)
-- ============================================================================

-- A1) Ada berapa pesanan di database?
--     CATATAN: kalau total_pesanan = 0, dashboard menampilkan Rp 0 itu NORMAL
--     (belum ada transaksi). Buat 1 pesanan lewat kasir lalu refresh.
select
  count(*)                                            as total_pesanan,
  count(*) filter (where status <> 'cancelled')       as tidak_dibatalkan,
  count(*) filter (where payment_status = 'paid')     as sudah_bayar,
  min(created_at)                                     as pesanan_terlama,
  max(created_at)                                     as pesanan_terbaru
from public.orders;

-- A2) Panggil function yang SAMA dengan yang dipakai dashboard.
--     Kosong padahal A1 berisi data -> kemungkinan semua order
--     berstatus 'cancelled' (function memfilter status itu).
select *
from public.get_sales_report('day', now() - interval '90 days', now())
order by bucket;

-- A3) Top menu — biasanya sinkron dengan A2.
select *
from public.get_top_menu(now() - interval '90 days', now(), 5);

-- A4) Verifikasi laporan WIB, bukan UTC.
--     WAJIB: jam_utc = 17 (bukan 0). Kalau 0, bucket bergeser 7 jam —
--     artinya fungsi laporan versi lama (sebelum migrasi WIB) yang
--     tertancap; jalankan ulang bagian [8/17] di installer? TIDAK —
--     di database yang sudah jalan, perbaiki dengan migrasi baru
--     (lihat 00-PROSEDUR.md, aturan "perbaikan = file baru").
select
  bucket,
  extract(hour from bucket at time zone 'UTC') as jam_utc
from public.get_sales_report('day', now() - interval '7 days', now())
order by bucket;


-- ============================================================================
-- BAGIAN B — KESEHATAN AKUN KARYAWAN & LOGIN
-- ============================================================================

-- B1) Pemeriksaan satu baris per akun @cafe.internal.
--
--     GANTI '123456' dengan password yang BENAR-BENAR dipakai sebelum Run.
--
--     Cara baca kolom:
--   jumlah_identity      wajib >= 1. 0 = akun tidak punya identitas,
--                        GoTrue tidak bisa memverifikasi password-nya.
--   email_ditemukan      harus terisi. Kosong = langkah pertama login
--                        (get_login_email) tidak menemukan username —
--                        masalah di CARI, bukan di password.
--   awal_hash            harus diawali "$2a$"/"$2b$", panjang 60.
--   pw_cocok             true = hash cocok dengan password yang diketik.
--   bcrypt_valid_pgcrypto true = hash bisa dibaca pgcrypto; false = rusak.
select
  u.email                                                      as email,
  p.username                                                   as username,
  p.role                                                       as role,
  (select count(*)
     from auth.identities i
    where i.user_id = u.id)                                    as jumlah_identity,
  public.get_login_email(p.username)                           as email_ditemukan,
  left(u.encrypted_password, 7)                                as awal_hash,
  (u.encrypted_password like '$2%')                            as format_bcrypt,
  length(u.encrypted_password)                                 as panjang_hash,
  coalesce(length(u.encrypted_password) = 60, false)           as panjang_bcrypt_60,
  (u.encrypted_password = crypt('123456', u.encrypted_password)) as pw_cocok,
  coalesce(crypt('123456', u.encrypted_password) is not null, false) as bcrypt_valid_pgcrypto
from auth.users u
join public.profiles p on p.id = u.id
where u.email like '%@cafe.internal'
order by u.created_at;

-- B2) Test langkah pertama login untuk SEMUA akun — bukan hardcode nama.
--     Baris kosong di kolom hasil = username tidak ketemu oleh RPC.
select
  p.username                          as diinput,
  public.get_login_email(p.username)  as hasil_email
from public.profiles p
order by p.created_at;

-- B3) Bandingkan kolom-kolom auth tiap akun vs akun OWNER
--     (pemilik login yang terbukti jalan). Kolom yang kosong di akun
--     kasir tapi terisi di owner = kandidat penyebab.
--     Owner dicari otomatis dari tabel profiles, tidak hardcode email.
select
  u.email                                                        as email,
  (to_jsonb(u) ->> 'instance_id') = (to_jsonb(o) ->> 'instance_id') as instance_sama,
  (to_jsonb(u) ->> 'is_anonymous')                               as is_anonymous,
  (to_jsonb(o) ->> 'is_anonymous')                               as owner_is_anonymous,
  (to_jsonb(u) ->> 'is_sso_user')                                as is_sso_user,
  (to_jsonb(o) ->> 'is_sso_user')                                as owner_is_sso_user,
  (to_jsonb(u) ->> 'confirmed_at')       is null                  as confirmed_at_kosong,
  (to_jsonb(o) ->> 'confirmed_at')       is null                  as owner_confirmed_kosong,
  (to_jsonb(u) ->> 'email_confirmed_at') is null                  as email_confirmed_kosong,
  (to_jsonb(o) ->> 'email_confirmed_at') is null                  as owner_email_confirmed_kosong,
  to_jsonb(u) ->> 'recovery_token'                               as recovery_token,
  to_jsonb(u) ->> 'email_change_token_new'                       as email_change_token
from auth.users u
cross join auth.users o
where o.email = (
        select min(u2.email)
        from auth.users u2
        join public.profiles p2 on p2.id = u2.id
        where p2.role = 'owner'
      )
  and u.email like '%@cafe.internal'
order by u.created_at;

-- B4) Struktur kolom auth.identities di database ini —
--     dipakai saat membandingkan bentuk baris identitas antar akun.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'auth'
  and table_name = 'identities'
order by ordinal_position;


-- ============================================================================
-- BAGIAN C — DIAGNOSA 500 "Database error querying schema" SAAT LOGIN
-- ============================================================================

-- C1) Integritas baris akun dari sudut GoTrue.
--
--     Kondisi wajib benar:
--   jumlah_email_sama = 1          (duplikat email -> GoTrue jadi bingung)
--   aud / role_app    = 'authenticated' keduanya
--   instance_id       = '00000000-0000-0000-0000-000000000000'
--   email_confirmed_at wajib TIDAK NULL
--   banned_until      wajib NULL
--   hash_awal / panjang_hash: "$2a$"/"$2b$" dan 60
--   jumlah_identity   >= 1
--   identitas         jsonb identitas milik akun ini (bandingkan antar akun)
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

-- C2) Baris auth.identities per akun, dilihat dari kunci unik
--     (provider, provider_id). Tujuan: perbedaan antar akun yang bisa
--     membuat query GoTrue gagal.
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

-- C3) Trigger yang menempel di tabel-tabel auth.
--     Repo ini TIDAK PERNAH membuat trigger di schema auth. Trigger asing
--     (terutama di users/identities/sessions/refresh_tokens) = kandidat
--     penyebab "500 hanya akun tertentu".
select
  n.nspname as schema,
  c.relname as tabel,
  t.tgname  as nama_trigger
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth'
  and c.relname in ('users','identities','sessions','refresh_tokens',
                     'mfa_factors','audit_log_entries','flow_state','codes')
  and not t.tgisinternal
order by c.relname, t.tgname;

-- C4) Versi schema auth milik GoTrue.
select * from auth.schema_migrations order by version desc limit 5;

-- C5) Dump baris auth.users semua akun @cafe.internal (hash diarsir).
select
  u.email,
  p.role,
  jsonb_build_object(
    'user', to_jsonb(u) || jsonb_build_object(
      'encrypted_password',
      left(u.encrypted_password, 7) || '***ARSI***'
    ),
    'identities',
    (select jsonb_agg(to_jsonb(i)) from auth.identities i where i.user_id = u.id)
  ) as dump
from auth.users u
left join public.profiles p on p.id = u.id
where u.email like '%@cafe.internal'
order by u.created_at;
