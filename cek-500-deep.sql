-- =========================================================
-- CEK 500 DEEP: trigger di tabel auth + versi schema + dump baris user
--
-- Jalankan di Supabase SQL Editor (run semuanya, tiga SELECT di bawah),
-- lalu copy SEMUA hasil (tiga tabel) ke AI. Semuanya SELECT, tidak
-- mengubah apa pun.
-- =========================================================

-- ---------------------------------------------------------
-- 1) TRIGGER: apa saja yang menempel di tabel-tabel auth
--
--    GoTrue mengelola tabel auth* sendiri. Berkas repo TIDAK PERNAH membuat
--    trigger di sini. Trigger yang hanya error untuk baris kasir (misal
--    trigger UPDATE yang dibuat starter template / berkas lama) adalah
--    dugaan utama penyebab "500 hanya akun kasir".
--
--    Yang mencurigakan: trigger UPDATE di `users`, atau trigger apa pun di
--    `identities`, `sessions`, `refresh_tokens`, `mfa_factors`.
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- 2) VERSI SCHEMA AUTH yang dipakai GoTrue sekarang
-- ---------------------------------------------------------
select * from auth.schema_migrations order by version desc limit 5;

-- ---------------------------------------------------------
-- 3) DUMP BARIS AUTH.USERS semua akun @cafe.internal (hash diarsir)
--
--    Fokus beda antara baris owner (selalu jalan) dan baris kasir
--    (yang bergantian 500):
--      aud / role            harus 'authenticated'
--      instance_id           harus '00000000-0000-0000-0000-000000000000'
--      confirmed_at          sebaiknya ada (owner: selalu ada)
--      email_confirmed_at    wajib tidak NULL
--      raw_app_meta_data     sekurangnya {"provider":"email","providers":["email"]}
--      is_sso_user           sebaiknya false, BUKAN NULL
--    Identitas per akun ikut ditulis di kolom yang sama supaya bisa
--    dibandingkan berdampingan.
-- ---------------------------------------------------------
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
