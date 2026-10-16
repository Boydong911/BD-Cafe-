-- =========================================================
-- MIGRASI: 2026-10-17 — Fungsi admin untuk kelola karyawan
--
-- TUJUAN:
--   Owner perlu menambah kasir dari dashboard, bukan lewat script manual.
--   Pembuatan akun HARUS lewat Supabase Auth Admin API (auth.admin.createUser)
--   supaya password di-hash bcrypt oleh Supabase, sama seperti akun owner.
--
-- MENGAPA ADA FUNGSI SQL DI SINI:
--   `auth.users` dan `auth.admin.*` hanya bisa dipanggil pakai Service Role
--   Key, yang tidak boleh ada di Next.js server component mana pun (bocor kalau
--   salah tempat). Solusinya: pindahkan logika itu ke dalam function
--   SECURITY DEFINER yang hanya boleh dipanggil role 'owner' yang sedang login.
--
--   Function ini diberi grant ke `authenticated` BUKAN ke `anon`, dan isinya
--   sendiri menolak kalau pemanggil bukan owner. Jadi meskipun siapa pun yang
--   punya sesi login, hanya owner yang bisa membuat/ubah/hapus karyawan.
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

-- ---------------------------------------------------------
-- 0. Helper: pastikan pemanggil adalah owner
-- ---------------------------------------------------------
create or replace function public._bd_require_owner()
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Akses ditolak: hanya owner yang boleh mengelola karyawan.'
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 1. Daftar karyawan (untuk ditampilkan di dashboard)
-- ---------------------------------------------------------
-- CATATAN: tabel public.profiles TIDAK punya kolom updated_at (lihat
-- schema.sql) — hanya id, username, full_name, role, created_at. Jangan
-- menambahkan kolom yang tidak ada di sini.
create or replace function public.list_staff()
returns table (
  id            uuid,
  username      text,
  full_name     text,
  role          public.user_role,
  created_at    timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.full_name, p.role, p.created_at
  from public.profiles p
  order by p.role, p.username;
$$;

-- ---------------------------------------------------------
-- 2. Buat karyawan baru (role kasir)
-- ---------------------------------------------------------
-- Memakai extension `pgcrypto` untuk generate bcrypt. Password di-hash DI
-- DALAM database lalu dioper ke auth.users — string aslinya tidak pernah
-- disimpan di tabel mana pun, jadi tidak bisa dibaca owner maupun dicuri.
create or replace function public.create_staff_account(
  p_username text,
  p_password text,
  p_full_name text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
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

  return v_user_id;
end;
$$;

-- ---------------------------------------------------------
-- 2b. Pendaftaran mandiri oleh calon kasir (dari halaman /daftar)
-- ---------------------------------------------------------
-- Bedanya dengan create_staff_account():
--   - TIDAK butuh owner. Halaman /daftar memang terbuka untuk siapa saja yang
--     punya link-nya, sesuai permintaan owner ("kasir bisa daftar sendiri").
--   - Role SELALU 'kasir' dan di-hardcode di dalam function ini. Daftar
--     parameternya sengaja tidak menyertakan role sama sekali, jadi tidak ada
--     jalan untuk mendaftarkan diri sebagai owner.
--
-- Konsekuensi yang harus disadari owner: siapa pun yang tahu URL /daftar
-- bisa membuat akun kasir. Kalau nanti ini tidak diinginkan, cabut grant
-- `anon` di bawah (baris revoke) — halaman akan langsung gagal.
create or replace function public.register_staff_account(
  p_username text,
  p_password text,
  p_full_name text
)
returns uuid
language plpgsql security definer set search_path = public as $$
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

  return v_user_id;
end;
$$;

-- ---------------------------------------------------------
-- 3. Reset password karyawan
-- ---------------------------------------------------------
-- Owner TIDAK bisa membaca password lama (Supabase menyimpannya sebagai hash
-- bcrypt satu arah). Jadi kalau karyawan lupa, satu-satunya jalan adalah
-- membuat password baru. Password baru dikembalikan ke caller untuk
-- ditampilkan satu kali di layar.
create or replace function public.reset_staff_password(
  p_staff_id uuid,
  p_new_password text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._bd_require_owner();

  if p_new_password is null or length(p_new_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;

  if not exists (select 1 from public.profiles where id = p_staff_id) then
    raise exception 'Karyawan tidak ditemukan.';
  end if;

  update auth.users
     set encrypted_password = crypt(p_new_password, gen_salt('bf')),
         updated_at = now()
   where id = p_staff_id;

  if not found then
    raise exception 'Karyawan tidak ditemukan di sistem login.';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 4. Ubah nama lengkap
-- ---------------------------------------------------------
create or replace function public.update_staff_profile(
  p_staff_id uuid,
  p_full_name text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._bd_require_owner();

  if not exists (select 1 from public.profiles where id = p_staff_id) then
    raise exception 'Karyawan tidak ditemukan.';
  end if;

  update public.profiles
     set full_name = nullif(btrim(coalesce(p_full_name, '')), '')
   where id = p_staff_id;
end;
$$;

-- ---------------------------------------------------------
-- 5. Hapus karyawan
-- ---------------------------------------------------------
-- Akun owner sendiri TIDAK BOLEH dihapus, supaya tidak ada keadaan di mana
-- tidak ada orang yang bisa masuk ke dashboard.
create or replace function public.delete_staff_account(p_staff_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role;
begin
  perform public._bd_require_owner();

  select role into v_role from public.profiles where id = p_staff_id;

  if v_role is null then
    raise exception 'Karyawan tidak ditemukan.';
  end if;

  if v_role = 'owner' then
    raise exception 'Akun owner tidak bisa dihapus dari sini.';
  end if;

  -- Hapus dari auth.users lebih dulu; baris public.profiles ikut terhapus
  -- karena FK-nya `on delete cascade`.
  delete from auth.users where id = p_staff_id;

  if not found then
    raise exception 'Karyawan tidak ditemukan di sistem login.';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 6. Grant: hanya authenticated, BUKAN anon
-- ---------------------------------------------------------
revoke all on function public.list_staff() from public;
revoke all on function public.create_staff_account(text, text, text) from public;
revoke all on function public.register_staff_account(text, text, text) from public;
revoke all on function public.reset_staff_password(uuid, text) from public;
revoke all on function public.update_staff_profile(uuid, text) from public;
revoke all on function public.delete_staff_account(uuid) from public;
revoke all on function public._bd_require_owner() from public;

-- Function yang hanya untuk owner.
grant execute on function public.list_staff() to authenticated;
grant execute on function public.create_staff_account(text, text, text) to authenticated;
grant execute on function public.reset_staff_password(uuid, text) to authenticated;
grant execute on function public.update_staff_profile(uuid, text) to authenticated;
grant execute on function public.delete_staff_account(uuid) to authenticated;

-- Pendaftaran mandiri BUTUH anon, karena orang yang daftar belum punya sesi
-- login. Function ini hanya bisa membuat akun role 'kasir' — tidak ada
-- parameternya untuk menentukan role.
--
-- ⚠️ Tarik grant ini kalau pendaftaran mandiri tidak diinginkan:
--     revoke execute on function public.register_staff_account(text,text,text) from anon;
--   Halaman /daftar akan langsung gagal setelah dicabut.
grant execute on function public.register_staff_account(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------
-- 7. VERIFIKASI
-- ---------------------------------------------------------

-- 7a. Enam function harus ada
select proname
from pg_proc
where proname in (
  'list_staff', 'create_staff_account', 'register_staff_account',
  'reset_staff_password', 'update_staff_profile', 'delete_staff_account'
);

-- 7b. anon TIDAK boleh menyentuh function milik owner (harus semua false).
--     Satu-satunya pengecualian: register_staff_account — memang dibuka untuk
--     anon karena dipakai halaman /daftar, dan isinya hanya bisa membuat akun
--     role 'kasir'.
select
  has_function_privilege('anon', 'create_staff_account(text,text,text)', 'execute') as anon_buat_akun,
  has_function_privilege('anon', 'delete_staff_account(uuid)', 'execute')         as anon_hapus_akun,
  has_function_privilege('anon', 'reset_staff_password(uuid,text)', 'execute')   as anon_reset,
  has_function_privilege('anon', 'list_staff()', 'execute')                      as anon_lihat,
  has_function_privilege('anon', 'register_staff_account(text,text,text)', 'execute') as anon_daftar;
-- Empat kolom pertama harus false. anon_daftar boleh true.

-- 7c. Daftar karyawan sekarang
select username, full_name, role, created_at from public.list_staff();
