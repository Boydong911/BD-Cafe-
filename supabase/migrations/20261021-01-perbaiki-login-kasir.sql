-- ============================================================================
-- 20261021-01: PERBAIKI LOGIN KASIR (HTTP 500 "Database error querying schema")
-- ============================================================================
-- Gejala: login kasir (dibuat lewat dashboard owner maupun halaman /daftar)
-- selalu "Username atau password salah", padahal RPC get_login_email membaca
-- username dengan baik. Uji langsung ke endpoint auth Supabase dengan
-- password APA PUN tetap menghasilkan HTTP 500 -> error terjadi SEBELUM
-- password dicek, yaitu saat GoTrue membaca baris user dari database.
--
-- Akar masalah (dibuktikan lewat dump skema & isi baris, 20261021):
--   1. Kolom created_at & updated_at di auth.users TIDAK punya default.
--      Insert manual kita tidak mengisinya -> NULL -> GoTrue gagal
--      memindai baris (error pembacaan NULL) -> 500.
--   2. Sejumlah kolom teks (confirmation_token, recovery_token, dst) juga
--      dibiarkan NULL oleh insert manual — GoTrue memindai kolom tersebut
--      sebagai string yang tidak boleh NULL.
--   3. Baris auth.identities tidak dibuat — GoTrue versi baru membaca user
--      lewat JOIN ke tabel ini saat login.
--
-- Catatan penting: kolom `phone` punya indeks unik yang menganggap '' tabrakan,
-- jadi `phone` SENGAJA TIDAK diisi (dibiarkan NULL) — dibuktikan akun owner
-- dengan phone NULL bisa login normal.
--
-- Solusi:
--   A. Tambal akun lama (@cafe.internal).
--   B. Perbaiki kedua fungsi pembuat akun supaya akun BARU lahir lengkap.
--
-- Idempoten: aman dijalankan lebih dari sekali.
-- ============================================================================

-- ------------------------------------------------------------------
-- A. TAMBAL AKUN LAMA
-- ------------------------------------------------------------------

-- A1. Semua kolom TEKS yang bisa NULL -> '' untuk akun buatan SQL.
--     KECUALI `phone` (indeks uniknya menolak '' — dan phone NULL terbukti
--     aman: akun owner dengan phone NULL bisa login). Kalau ada kolom lain
--     yang menabrak indeks unik, dilewati saja.
do $$
declare
  r record;
begin
  for r in
    select column_name
      from information_schema.columns
     where table_schema = 'auth'
       and table_name   = 'users'
       and data_type    in ('text', 'character varying', 'character')
       and is_nullable  = 'YES'
       and column_name <> 'phone'
     order by ordinal_position
  loop
    begin
      execute format(
        'update auth.users set %I = coalesce(%I, %s) where email like %L and %I is null',
        r.column_name, r.column_name, quote_literal(''), '%@cafe.internal', r.column_name
      );
    exception when unique_violation then
      null;
    end;
  end loop;
end
$$;

-- A2. Kolom ANGKA yang bisa NULL -> 0.
do $$
declare
  r record;
begin
  for r in
    select column_name
      from information_schema.columns
     where table_schema = 'auth'
       and table_name   = 'users'
       and data_type    in ('smallint', 'integer', 'bigint',
                            'numeric', 'double precision', 'real')
       and is_nullable  = 'YES'
     order by ordinal_position
  loop
    execute format(
      'update auth.users set %I = coalesce(%I, 0) where email like %L and %I is null',
      r.column_name, r.column_name, '%@cafe.internal', r.column_name
    );
  end loop;
end
$$;

-- A3. Kolom BOOLEAN yang bisa NULL -> false (termasuk is_sso_user kalau ada).
do $$
declare
  r record;
begin
  for r in
    select column_name
      from information_schema.columns
     where table_schema = 'auth'
       and table_name   = 'users'
       and data_type    = 'boolean'
       and is_nullable  = 'YES'
     order by ordinal_position
  loop
    execute format(
      'update auth.users set %I = coalesce(%I, false) where email like %L and %I is null',
      r.column_name, r.column_name, '%@cafe.internal', r.column_name
    );
  end loop;
end
$$;

-- A4. created_at & updated_at TIDAK boleh NULL (kolom ini tanpa default;
--     inilah penyebab utama 500). Diisi sekarang kalau masih NULL.
update auth.users
   set created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, now())
 where email like '%@cafe.internal';

-- A5. Buat baris auth.identities untuk akun yang belum punya.
--     Tipe kolom id/provider_id berbeda antar versi skema auth (uuid atau
--     teks) — dicek dulu, lalu insert dibangun sesuai tipe aslinya.
do $$
declare
  v_id_type   text;
  v_pid_type  text;
  v_id_expr   text;
  v_pid_expr  text;
begin
  select data_type into v_id_type
    from information_schema.columns
   where table_schema = 'auth'
     and table_name   = 'identities'
     and column_name  = 'id';

  select data_type into v_pid_type
    from information_schema.columns
   where table_schema = 'auth'
     and table_name   = 'identities'
     and column_name  = 'provider_id';

  v_id_expr  := case when v_id_type = 'uuid' then 'u.id' else 'u.id::text' end;
  v_pid_expr := case when v_pid_type = 'uuid' then 'u.id' else 'u.id::text' end;

  execute format(
    'insert into auth.identities (
        id, user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
      )
      select
        %s, u.id, %s, ''email'',
        jsonb_build_object(
          ''sub'', u.id,
          ''email'', u.email,
          ''email_verified'', (u.email_confirmed_at is not null)
        ),
        coalesce(u.last_sign_in_at, now()),
        coalesce(u.created_at, now()),
        now()
      from auth.users u
      where u.email like ''%%@cafe.internal''
        and not exists (
          select 1 from auth.identities i
           where i.user_id = u.id
             and i.provider = ''email''
        )',
    v_id_expr, v_pid_expr
  );
end
$$;

-- ------------------------------------------------------------------
-- B. PERBAIKI FUNGSI PEMBUAT AKUN
-- ------------------------------------------------------------------

-- Buat kasir dari dashboard owner: outlet WAJIB disebut (tidak ada default),
-- supaya tak pernah lahir kasir tanpa outlet.
drop function if exists public.create_staff_account(text, text, text);
drop function if exists public.create_staff_account(text, text, text, uuid);

create or replace function public.create_staff_account(
  p_username  text,
  p_password  text,
  p_full_name text,
  p_outlet_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
  r         record;
begin
  perform public._bd_require_owner();

  if p_username is null or btrim(p_username) = '' then
    raise exception 'Username wajib diisi.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;

  if p_outlet_id is null then
    raise exception 'Outlet wajib dipilih.';
  end if;
  if not exists (select 1 from public.outlets where id = p_outlet_id) then
    raise exception 'Outlet tidak ditemukan.';
  end if;
  if not exists (
    select 1 from public.outlets
    where id = p_outlet_id and is_active
  ) then
    raise exception 'Outlet sudah diarsipkan.';
  end if;

  v_email := lower(btrim(p_username)) || '@cafe.internal';

  if exists (select 1 from public.profiles where username = btrim(p_username)) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;

  v_hash := crypt(p_password, gen_salt('bf'));

  -- PENTING (perbaikan 20261021-01):
  --   - created_at & updated_at WAJIB diisi (kolomnya tanpa default; NULL
  --     membuat GoTrue gagal memindai baris saat login -> 500).
  --   - `phone` SENGAJA tidak diisi (indeks unik menolak ''; NULL terbukti aman).
  --   - Kolom generated (confirmed_at) tetap TIDAK diisi.
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
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
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', btrim(p_username)),
    'authenticated',
    'authenticated'
  )
  returning id into v_user_id;

  -- Tambalan aman versi skema apa pun: isi sisa kolom teks/angka/boolean yang
  -- masih NULL dengan nilai kosong ('' / 0 / false), KECUALI `phone`.
  -- (GoTrue memindai kolom-kolom itu saat login; NULL = error 500.)
  for r in
    select column_name, data_type
      from information_schema.columns
     where table_schema = 'auth'
       and table_name   = 'users'
       and is_nullable  = 'YES'
       and column_name <> 'phone'
       and data_type in (
         'text', 'character varying', 'character',
         'smallint', 'integer', 'bigint', 'numeric', 'double precision', 'real',
         'boolean'
       )
  loop
    begin
      execute format(
        'update auth.users set %I = coalesce(%I, %s) where id = %L and %I is null',
        r.column_name,
        r.column_name,
        case when r.data_type = 'boolean' then 'false'
             when r.data_type in ('smallint', 'integer', 'bigint', 'numeric',
                                  'double precision', 'real') then '0'
             else quote_literal('')
        end,
        v_user_id,
        r.column_name
      );
    exception when unique_violation then
      null;
    end;
  end loop;

  -- GoTrue versi baru membaca user lewat JOIN ke auth.identities saat login,
  -- jadi baris identities WAJIB dibuat bersamaan dengan user-nya.
  -- Semua nilai dikirim sebagai literal teks (%L): Postgres meng-cast-nya
  -- sendiri ke tipe kolom yang benar, apa pun versi skemanya.
  execute format(
    'insert into auth.identities (
        id, user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
      )
      values (
        %L, %L, %L, ''email'',
        jsonb_build_object(''sub'', %L, ''email'', %L, ''email_verified'', true),
        now(), now(), now()
      )',
    v_user_id, v_user_id, v_user_id, v_user_id, v_email
  );

  if not exists (select 1 from public.profiles where id = v_user_id) then
    -- outlet_id WAJIB sejak baris pertama: chk_profiles_outlet menolak
    -- baris kasir tanpa outlet.
    insert into public.profiles (id, username, full_name, role, outlet_id)
    values (
      v_user_id,
      btrim(p_username),
      nullif(btrim(coalesce(p_full_name, '')), ''),
      'kasir',
      p_outlet_id
    );
  else
    update public.profiles
       set full_name = nullif(btrim(coalesce(p_full_name, '')), '')
     where id = v_user_id
       and full_name is null;
  end if;

  update public.profiles
     set role = 'kasir',
         outlet_id = p_outlet_id
   where id = v_user_id;

  perform public._bd_log_registration(
    v_user_id,
    btrim(p_username),
    nullif(btrim(coalesce(p_full_name, '')), ''),
    'owner'
  );

  return v_user_id;
end;
$$;

revoke all on function public.create_staff_account(text, text, text, uuid) from public;
grant execute on function public.create_staff_account(text, text, text, uuid) to authenticated;

-- Daftar mandiri (halaman /daftar): outlet WAJIB mengarah ke outlet halaman
-- pendaftaran; kalau kosong, masuk ke outlet pusat.
drop function if exists public.register_staff_account(text, text, text);

create or replace function public.register_staff_account(
  p_username  text,
  p_password  text,
  p_full_name text,
  p_outlet_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
  v_clean   text;
  v_outlet  uuid := p_outlet_id;
  r         record;
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

  if v_outlet is null then
    select id into v_outlet from public.outlets where is_pusat limit 1;
  end if;
  if v_outlet is null or not exists (
    select 1 from public.outlets where id = v_outlet and is_active
  ) then
    raise exception 'Outlet tidak ditemukan atau sudah diarsipkan.';
  end if;

  v_email := v_clean || '@cafe.internal';

  if exists (select 1 from public.profiles where username = v_clean) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;

  v_hash := crypt(p_password, gen_salt('bf'));

  -- PENTING (perbaikan 20261021-01): created_at & updated_at WAJIB diisi;
  -- `phone` sengaja tidak diisi; kolom generated tetap tidak diisi.
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
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
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', v_clean),
    'authenticated',
    'authenticated'
  )
  returning id into v_user_id;

  -- Tambalan aman versi skema apa pun: isi sisa kolom scalar yang masih NULL
  -- ('' / 0 / false), KECUALI `phone`. Lihat komentar di create_staff_account.
  for r in
    select column_name, data_type
      from information_schema.columns
     where table_schema = 'auth'
       and table_name   = 'users'
       and is_nullable  = 'YES'
       and column_name <> 'phone'
       and data_type in (
         'text', 'character varying', 'character',
         'smallint', 'integer', 'bigint', 'numeric', 'double precision', 'real',
         'boolean'
       )
  loop
    begin
      execute format(
        'update auth.users set %I = coalesce(%I, %s) where id = %L and %I is null',
        r.column_name,
        r.column_name,
        case when r.data_type = 'boolean' then 'false'
             when r.data_type in ('smallint', 'integer', 'bigint', 'numeric',
                                  'double precision', 'real') then '0'
             else quote_literal('')
        end,
        v_user_id,
        r.column_name
      );
    exception when unique_violation then
      null;
    end;
  end loop;

  -- Baris identities WAJIB dibuat bersamaan dengan user-nya.
  execute format(
    'insert into auth.identities (
        id, user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
      )
      values (
        %L, %L, %L, ''email'',
        jsonb_build_object(''sub'', %L, ''email'', %L, ''email_verified'', true),
        now(), now(), now()
      )',
    v_user_id, v_user_id, v_user_id, v_user_id, v_email
  );

  if exists (select 1 from public.profiles where id = v_user_id) then
    update public.profiles
       set full_name = btrim(p_full_name),
           outlet_id = v_outlet
     where id = v_user_id;
  else
    -- outlet_id WAJIB sejak baris pertama: chk_profiles_outlet menolak
    -- baris kasir tanpa outlet.
    insert into public.profiles (id, username, full_name, role, outlet_id)
    values (v_user_id, v_clean, btrim(p_full_name), 'kasir', v_outlet);
  end if;

  update public.profiles
     set role = 'kasir',
         outlet_id = v_outlet
   where id = v_user_id;

  perform public._bd_log_registration(
    v_user_id,
    v_clean,
    btrim(p_full_name),
    'self_register'
  );

  return v_user_id;
end;
$$;

revoke all on function public.register_staff_account(text, text, text, uuid) from public;
grant execute on function public.register_staff_account(text, text, text, uuid) to anon, authenticated;
