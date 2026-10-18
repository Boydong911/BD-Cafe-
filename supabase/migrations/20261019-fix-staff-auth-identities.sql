-- =========================================================
-- MIGRASI: 2026-10-19 - Karyawan tidak bisa login: tanpa auth.identities
--
-- GEJALA:
--   Karyawan hasil daftar (boykeren, boytampan) selalu gagal login
--   dengan "Username atau password salah", padahal passwordnya benar.
--
-- BUKTI (hasil cek-identitas-karyawan.sql):
--   boy123@cafe.internal  owner  jumlah_identity = 1   bisa login
--   boytampan@cafe.internal kasir jumlah_identity = 0   tidak bisa
--   boykeren@cafe.internal  kasir jumlah_identity = 0   tidak bisa
--
-- AKAR MASALAH:
--   Akun owner dibuat lewat Supabase Admin API
--   (scripts/seed-owner.ts memakai auth.admin.createUser), dan API itu
--   membuat baris auth.identities secara otomatis.
--
--   Dua akun kasir dibuat lewat INSERT mentah ke auth.users. GoTrue
--   tidak pernah melihat proses itu, jadi tidak ada baris
--   auth.identities. GoTrue modern memakai tabel itu saat memverifikasi
--   login, sehingga password yang benar tetap ditolak.
--
-- PERBAIKAN:
--   1. Mengisi auth.identities untuk akun kasir yang sudah terlanjur
--      dibuat dan belum punya identitas.
--   2. Membuat kedua fungsi pendaftaran ikut menyisipkan baris
--      identitas, supaya karyawan berikutnya langsung bisa login.
--
-- NILAI BUKTI BUKAN KARANGAN:
--   Bentuk baris disalin dari identitas milik akun owner, satu-satunya
--   akun yang login-nya sudah terbukti jalan di database ini:
--     provider       'email'
--     provider_id    user_id sebagai teks
--     identity_data  sub, email, email_verified false, phone_verified
--                    false
--     email          email akun
--   created_at, updated_at, dan last_sign_in_at diisi now(), sama
--   seperti baris owner. id memakai gen_random_uuid(), sesuai default
--   kolomnya di database ini.
--
-- TIDAK ADA perubahan pada password, role, atau profil. Satu-satunya
-- kolom yang disentuh di luar auth.identities adalah tidak ada.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Perbaiki akun yang sudah terlanjur dibuat
-- ---------------------------------------------------------
-- Dua akun (boykeren, boytampan) sudah ada di auth.users tapi tidak
-- punya baris auth.identities, jadi tidak bisa login sama sekali.
--
-- Idempoten: hanya mengisi akun yang identitasnya memang belum ada.
-- Akun owner yang identitasnya sudah benar TIDAK tersentuh.
insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at,
  email
)
select
  gen_random_uuid(),
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', false,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now(),
  u.email
from auth.users u
where u.email like '%@cafe.internal'
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id
  );


-- ---------------------------------------------------------
-- 2. Buat pendaftaran berikutnya langsung menyertakan identitas
-- ---------------------------------------------------------
-- Tanpa bagian ini, setiap karyawan baru harus menjalankan migrasi
-- ini secara manual. Bagian 1 hanya menutup akun yang sudah ada.
--
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

  -- Password di-hash dengan bcrypt (cost 10, default Supabase).
  -- `crypt()` menghasilkan string $2a$/$2b$ yang persis format yang
  -- diharapkan func verify_password() bawaan Supabase Auth.
  v_hash := crypt(p_password, gen_salt('bf'));

  -- 2a) Baris di auth.users
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', btrim(p_username)),
    'authenticated',
    'authenticated'
  )
  returning id into v_user_id;

  -- Baris di auth.identities.
  --
  -- GoTrue MEMBUTUKH baris ini untuk memverifikasi login. Menebaknya
  -- dari auth.users saja tidak cukup: akun yang dibuat lewat INSERT
  -- mentah tidak pernah dibuatkan baris ini, dan akibatnya password yang
  -- benar pun ditolak dengan pesan 'Invalid login credentials'.
  --
  -- Nilai di bawah disalin apa adanya dari baris identitas milik akun
  -- owner, satu-satunya akun yang login-nya sudah terbukti jalan:
  -- provider 'email', provider_id berisi user_id sebagai teks,
  -- identity_data berisi sub, email, email_verified false, dan
  -- phone_verified false. Tidak ada satu pun nilai yang dikarang.
  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    email
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
    now(),
    v_email
  );

  -- 2b) Trigger Supabase Auth membuat baris di public.profiles otomatis
  --     dengan role default 'kasir', jadi tidak perlu insert manual di sini.
  --     Tapi kalau trigger-nya belum terpasang (mis. di project lama), tetap
  --     pastikan barisnya ada.
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

  -- Jaring pengaman role.
  --
  -- Fungsi ini tidak pernah menerima role dari pemanggil, jadi satu-satunya
  -- cara baris di atas berakhir punya role selain kasir adalah trigger di
  -- auth.users yang membuat baris profile dengan nilai yang salah. Repo ini
  -- tidak punya trigger seperti itu, tapi database bisa saja berbeda dari
  -- yang tertulis di sini, dan kalau begitu cabang update di atas hanya
  -- menyentuh full_name, bukan role.
  --
  -- v_user_id adalah uuid yang baru dibuat di fungsi ini, jadi aman untuk
  -- dipaksa tanpa syarat.
  update public.profiles
     set role = 'kasir'
   where id = v_user_id;

  -- 2c) Catat jejak pendaftaran supaya owner bisa melihat siapa yang masuk.
  --     Source 'owner' karena dipanggil dari dashboard Karyawan.
  --     Fungsi log-nya dibuat di 20261017-lock-down-orders-rls.sql.
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

  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', v_clean),
    'authenticated',
    'authenticated'
  )
  returning id into v_user_id;

  -- Baris di auth.identities.
  --
  -- GoTrue MEMBUTUKH baris ini untuk memverifikasi login. Menebaknya
  -- dari auth.users saja tidak cukup: akun yang dibuat lewat INSERT
  -- mentah tidak pernah dibuatkan baris ini, dan akibatnya password yang
  -- benar pun ditolak dengan pesan 'Invalid login credentials'.
  --
  -- Nilai di bawah disalin apa adanya dari baris identitas milik akun
  -- owner, satu-satunya akun yang login-nya sudah terbukti jalan:
  -- provider 'email', provider_id berisi user_id sebagai teks,
  -- identity_data berisi sub, email, email_verified false, dan
  -- phone_verified false. Tidak ada satu pun nilai yang dikarang.
  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    email
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
    now(),
    v_email
  );

  -- Role di-hardcode 'kasir' di sini. Kalau trigger auth sudah membuat
  -- baris profile dengan default 'kasir', baris itu dipakai; kalau belum,
  -- kita insert sendiri.
  if exists (select 1 from public.profiles where id = v_user_id) then
    update public.profiles
       set full_name = btrim(p_full_name)
     where id = v_user_id;
  else
    insert into public.profiles (id, username, full_name, role)
    values (v_user_id, v_clean, btrim(p_full_name), 'kasir');
  end if;

  -- Jaring pengaman role.
  --
  -- Fungsi ini tidak pernah menerima role dari pemanggil, jadi satu-satunya
  -- cara baris di atas berakhir punya role selain kasir adalah trigger di
  -- auth.users yang membuat baris profile dengan nilai yang salah. Repo ini
  -- tidak punya trigger seperti itu, tapi database bisa saja berbeda dari
  -- yang tertulis di sini, dan kalau begitu cabang update di atas hanya
  -- menyentuh full_name, bukan role.
  --
  -- v_user_id adalah uuid yang baru dibuat di fungsi ini, jadi aman untuk
  -- dipaksa tanpa syarat.
  update public.profiles
     set role = 'kasir'
   where id = v_user_id;

  -- Catat jejak pendaftaran. Source 'self_register' karena berasal dari
  -- halaman /daftar yang terbuka untuk umum — ini yang perlu diawasi owner.
  perform public._bd_log_registration(
    v_user_id,
    v_clean,
    btrim(p_full_name),
    'self_register'
  );

  return v_user_id;
end;
$$;
