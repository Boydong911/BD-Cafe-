-- =========================================================
-- MIGRASI: 2026-10-19 - GoTrue tidak bisa membaca baris kasir: kolom token NULL
--
-- GEJALA:
--   Login SEMUA akun kasir gagal: 500 "Database error querying schema",
--   bahkan sebelum password benar-benar dihitung. Akun owner selalu sehat.
--
-- BUKTI ASLI (log Auth Supabase, dicari lewat error_id):
--   error finding user: sql: Scan error on column index 3,
--   name "confirmation token": converting NULL to string is unsupported
--
--   Ditempel tabel proyek → Kode GoTrue menerima error ini bukan saat
--   INSERT, tapi saat MENYCAN baris: GoTrue membaca kolom token itu sebagai
--   "string pasti terisi" (bukan NULL-able). Scan gagal -> generic 500.
--
-- PERBANDINGAN BARIS (cek-500-deep.sql):
--   Baris owner dibuat lewat Supabase Admin API - semua kolom token terisi
--   string kosong ''. Baris kasir dibuat lewat INSERT manual (fungsi
--   pendaftaran) yang TIDAK menyebut kolom-kolom ini - hasilnya NULL.
--
--     kolom                  owner   kasir(salah)
--     confirmation_token     ''      NULL  <-- kolom index 3 di pesan scan
--     email_change           ''      NULL
--     recovery_token         ''      NULL
--     email_change_token_new ''      NULL
--     created_at / updated_at  ada   NULL (timestamp juga harus ada)
--
--   Kolom yang memang sah NULL tidak disentuh: phone, banned_until,
--   last_sign_in_at (belum pernah login), semua *_sent_at, phone_confirmed_at,
--   is_super_admin. Begitulah bentuk baris milik user yang baru dibuat
--   Supabase sendiri.
--
-- PERBAIKAN:
--   1. Mengisi kolom yang bermasalah pada baris yang sudah terlanjur dibuat,
--      hanya bila kolomnya memang masih NULL (idempoten; baris owner yang
--      sudah berisi '' tidak tersentuh).
--   2. Kedua fungsi pendaftaran ditulis ulang supaya INSERT sejak awal
--      mengisi kolom-kolom ini, jadi karyawan berikutnya langsung sah.
--
-- YANG TIDAK BERUBAH: password (hash tidak disentuh), role, profil,
-- auth.identities.
-- =========================================================

-- ---------------------------------------------------------
-- 1) BACKFILL baris yang sudah ada
-- ---------------------------------------------------------

-- Kolom teks yang GoTrue baca sebagai string mantap.
update auth.users
   set confirmation_token = '',
       recovery_token = '',
       email_change = '',
       email_change_token_new = ''
 where confirmation_token is null
    or recovery_token is null
    or email_change is null
    or email_change_token_new is null;

-- created_at / updated_at: diarsir di sini dari confirmed_at (siap dipakai,
-- semua baris kasir punya confirmed_at dari pendaftarannya). Baris owner
-- tidak tersentuh karena tidak memenuhi syarat (created_at sudah ada).
update auth.users
   set created_at = confirmed_at,
       updated_at = confirmed_at
 where created_at is null
   and confirmed_at is not null;

-- ---------------------------------------------------------
-- 2) Fungsi pendaftaran versi lengkap
--
--    Disalin dari 20261019-fix-staff-auth-identities.sql (yang sudah
--    menyertakan baris auth.identities), lalu kolom INSERT auth.users
--    ditambah: created_at, updated_at, email_change, recovery_token,
--    confirmation_token, email_change_token_new.
--    id tetap gen_random_uuid() (perbaikan 20261019-fix-staff-insert-id).
-- ---------------------------------------------------------

create or replace function public.create_staff_account(
  p_username text,
  p_password text,
  p_full_name text default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
begin
  perform public._bd_require_owner();

  if p_username is null or btrim(p_username) = '' then
    raise exception 'Username wajib diisi.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;

  -- Username dipakai sebagai email internal dengan suffix '@cafe.internal',
  -- sama seperti akun owner. Email tidak pernah dikirim ke mana pun.
  v_email := lower(btrim(p_username)) || '@cafe.internal';

  if exists (select 1 from public.profiles where username = btrim(p_username)) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;

  -- Password di-hash dengan bcrypt (cost 10).
  v_hash := crypt(p_password, gen_salt('bf'));

  -- 2a) Baris di auth.users - kolom tokennya WAJIB disebut dengan ''.
  --     Tanpa itu, GoTrue gagal scan (NULL string) dan login 500.
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    last_sign_in_at,
    created_at,
    updated_at,
    email_change,
    email_change_token_new,
    recovery_token,
    confirmation_token,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_hash,
    now(),
    now(),
    null,
    now(),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', btrim(p_username))
  )
  returning id into v_user_id;

  -- Baris di auth.identities (wajib: GoTrue memverifikasi login lewat sini).
  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', false,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- 2b) public.profiles: trigger membuat baris dengan role default 'kasir';
  --     kalau belum ada, buat sendiri.
  if not exists (select 1 from public.profiles where id = v_user_id) then
    insert into public.profiles (id, username, full_name, role)
    values (
      v_user_id,
      btrim(p_username),
      nullif(btrim(coalesce(p_full_name, '')), ''),
      'kasir'
    );
  else
    update public.profiles
       set full_name = nullif(btrim(coalesce(p_full_name, '')), '')
     where id = v_user_id
       and full_name is null;
  end if;

  -- Jaring penganalisis role: pastikan barisnya kasir walau trigger berbeda.
  update public.profiles set role = 'kasir' where id = v_user_id;

  -- 2c) Catat jejak pendaftaran (source 'owner').
  perform public._bd_log_registration(
    v_user_id,
    btrim(p_username),
    nullif(btrim(coalesce(p_full_name, '')), ''),
    'owner'
  );

  return v_user_id;
end;
$$;

create or replace function public.register_staff_account(
  p_username text,
  p_password text,
  p_full_name text
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
  v_clean   text;
begin
  v_clean := lower(btrim(coalesce(p_username, '')));

  if length(v_clean) < 3 then
    raise exception 'Username minimal 3 karakter.';
  end if;
  if length(v_clean) > 30 then
    raise exception 'Username maksimal 30 karakter.';
  end if;
  if v_clean !~ '^[a-z0-9._-]+$' then
    raise exception 'Username hanya boleh huruf kecil, angka, titik, _ dan -.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;
  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'Nama lengkap wajib diisi.';
  end if;

  v_email := v_clean || '@cafe.internal';

  if exists (select 1 from public.profiles where username = v_clean) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;

  v_hash := crypt(p_password, gen_salt('bf'));

  -- INSERT lengkap - alasan yang sama dengan create_staff_account di atas.
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    last_sign_in_at,
    created_at,
    updated_at,
    email_change,
    email_change_token_new,
    recovery_token,
    confirmation_token,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_hash,
    now(),
    now(),
    null,
    now(),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', v_clean)
  )
  returning id into v_user_id;

  -- Baris di auth.identities (wajib).
  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', false,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- Role di-hardcode 'kasir'.
  if exists (select 1 from public.profiles where id = v_user_id) then
    update public.profiles
       set full_name = btrim(p_full_name)
     where id = v_user_id;
  else
    insert into public.profiles (id, username, full_name, role)
    values (v_user_id, v_clean, btrim(p_full_name), 'kasir');
  end if;

  update public.profiles set role = 'kasir' where id = v_user_id;

  -- Jejak pendaftaran (source 'self_register').
  perform public._bd_log_registration(
    v_user_id,
    v_clean,
    btrim(p_full_name),
    'self_register'
  );

  return v_user_id;
end;
$$;

-- ---------------------------------------------------------
-- 3) VERIFIKASI - semuanya harus 0
-- ---------------------------------------------------------
select
  count(*) filter (where confirmation_token is null)         as konfirmasi_null,
  count(*) filter (where recovery_token is null)             as recovery_null,
  count(*) filter (where email_change is null)               as email_change_null,
  count(*) filter (where email_change_token_new is null)     as token_baru_null,
  count(*) filter (where created_at is null)                 as created_null,
  count(*) filter (where updated_at is null)                 as updated_null
from auth.users
where email like '%@cafe.internal';
