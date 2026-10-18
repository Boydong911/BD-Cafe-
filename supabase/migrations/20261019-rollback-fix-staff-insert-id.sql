-- =========================================================
-- ROLLBACK: 2026-10-19 - auth.users tidak bisa di-insert tanpa kolom id
--
-- PERINGATAN: rollback mengembalikan BUG ASAL. Pendaftaran karyawan
-- gagal lagi dengan:
--   null value in column "id" of relation "users" violates not-null
--   constraint
--
-- search_path TIDAK ikut dibalik ke public di sini. Itu bug yang BERBEDA,
-- punya file rollbacknya sendiri:
-- 20261019-rollback-pgcrypto-search-path.sql
--
-- Kalau 20261019-rollback-pgcrypto-search-path.sql dijalankan, barulah
-- search_path ikut kembali ke public. Urutan itu penting.
--
-- Data: tidak ada yang perlu dibersih. Tidak satu pun INSERT pernah
-- berhasil sebelum migrasi aslinya, semuanya gagal di kolom id.
-- =========================================================
-- =========================================================


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
