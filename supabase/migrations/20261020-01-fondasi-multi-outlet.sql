-- ============================================================================
-- [FONDASI MULTI-OUTLET] 2026-10-20
-- File   : supabase/migrations/20261020-01-fondasi-multi-outlet.sql
-- Tahap  : Tahap 1 dari BD-Coffee-Roadmap-Outlet.md
--
-- TUJUAN:
--   Sampai hari ini aplikasi menganggap cafe hanya satu outlet. Tahap 1
--   menanam pondasi:
--     1. Tabel `outlets` - slug dibuat sekali lalu DIBEKUKAN (slug tercetak
--        di QR, jadi tidak boleh berubah); nama & tanggal bangun bebas diedit.
--     2. `outlet_id` di: tables, menu_items, orders, profiles (staff), dan
--        log pendaftaran. Kategori tetap GLOBAL (dipakai semua outlet).
--     3. Semua data lama dipindahkan ke Outlet A (pusat), slug `outlet-a`.
--        Owner TIDAK diikat outlet (outlet_id NULL = bisa semua outlet).
--     4. Nomor antrean jadi per outlet per hari: tiap outlet mulai 01.
--     5. RLS: kasir hanya melihat/mengelola pesanan outletnya; owner semua.
--     6. RPC laporan & daftar karyawan mendapat parameter outlet (opsional,
--        null = semua) supaya UI Tahap 1 dan Tahap 3 tinggal memakai.
--   Meja 1 otomatis + halaman kasir per outlet + URL per outlet = Tahap 2.
--
-- ATURAN MAIN:
--   - Tidak ada data yang dihapus; kolom baru diisi Outlet A.
--   - Outlet A bernama "Outlet A" (owner bisa mengganti namanya dari
--     dashboard; slug-nya tetap `outlet-a` karena tercetak di QR).
--   - Idempoten: aman dijalankan dua kali; hasilnya sama.
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
--   Jalankan SEMUANYA sekaligus. Bila error, BERHENTI dan kirim pesannya.
--   Setelah selesai, jalankan cek di bagian 13 (paling bawah file ini).
-- ============================================================================

-- ---------------------------------------------------------
-- 1. TABEL OUTLETS
-- ---------------------------------------------------------
create table if not exists public.outlets (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nama           text not null,
  tanggal_bangun date,
  -- salinan = fotokopi menu pusat saat dibuat, lalu berdiri sendiri
  -- sendiri = menu mulai dari nol ("Maaf, menu belum ada.")
  menu_mode      text not null default 'salinan'
                 check (menu_mode in ('salinan', 'sendiri')),
  is_pusat       boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table public.outlets enable row level security;

drop policy if exists "outlets_public_read" on public.outlets;
create policy "outlets_public_read"
  on public.outlets for select
  using (true);

drop policy if exists "outlets_owner_write" on public.outlets;
create policy "outlets_owner_write"
  on public.outlets for all
  using (public.is_owner())
  with check (public.is_owner());

-- ---------------------------------------------------------
-- 2. SEED OUTLET A (PUSAT)
-- ---------------------------------------------------------
-- Semua data yang sudah ada punya akan dipindahkan ke outlet ini.
insert into public.outlets (slug, nama, menu_mode, is_pusat)
select 'outlet-a', 'Outlet A', 'salinan', true
where not exists (
  select 1 from public.outlets where slug = 'outlet-a'
);

-- ---------------------------------------------------------
-- 3. KOLOM OUTLET_ID DI TABEL LAMA
-- ---------------------------------------------------------
-- profiles: owner TIDAK wajib punya outlet (NULL = semua outlet).
--           kasir WAJIB punya outlet (check di bawah).
alter table public.tables     add column if not exists outlet_id uuid references public.outlets (id) on delete restrict;
alter table public.menu_items add column if not exists outlet_id uuid references public.outlets (id) on delete restrict;
alter table public.orders     add column if not exists outlet_id uuid references public.outlets (id) on delete restrict;
alter table public.profiles   add column if not exists outlet_id uuid references public.outlets (id) on delete restrict;
alter table public.staff_registration_log
  add column if not exists outlet_id uuid references public.outlets (id) on delete set null;

-- ---------------------------------------------------------
-- 4. BACKFILL: SEMUA DATA LAMA -> OUTLET A
-- ---------------------------------------------------------
update public.tables
   set outlet_id = (select id from public.outlets where slug = 'outlet-a')
 where outlet_id is null;

update public.menu_items
   set outlet_id = (select id from public.outlets where slug = 'outlet-a')
 where outlet_id is null;

update public.orders
   set outlet_id = (select id from public.outlets where slug = 'outlet-a')
 where outlet_id is null;

update public.profiles
   set outlet_id = (select id from public.outlets where slug = 'outlet-a')
 where role = 'kasir'
   and outlet_id is null;

update public.staff_registration_log
   set outlet_id = (select id from public.outlets where slug = 'outlet-a')
 where outlet_id is null;

-- Wajib diisi supaya tak ada meja/menu/pesanan tanpa rumah.
alter table public.tables     alter column outlet_id set not null;
alter table public.menu_items alter column outlet_id set not null;
alter table public.orders     alter column outlet_id set not null;

-- Baru setelah semua baris terisi: kasir wajib terikat outlet, owner bebas.
-- (Aturan ini tadinya terpasang SEBELUM backfill dan gagal dengan
-- "chk_profiles_outlet is violated" - kini digeser ke sini.)
alter table public.profiles drop constraint if exists chk_profiles_outlet;
alter table public.profiles add constraint chk_profiles_outlet
  check (role = 'owner' or outlet_id is not null);

-- ---------------------------------------------------------
-- 5. UNIK: NOMOR MEJA & NOMOR ANTREAN JADI PER OUTLET
-- ---------------------------------------------------------
-- Semula: table_number unik GLOBAL dan order_number unik GLOBAL.
-- Kini dua outlet boleh sama-sama punya Meja 01 / antrean 01.
alter table public.tables drop constraint if exists tables_table_number_key;
create unique index if not exists uq_tables_outlet_number
  on public.tables (outlet_id, table_number);

alter table public.orders drop constraint if exists orders_order_number_key;
create unique index if not exists uq_orders_outlet_number
  on public.orders (outlet_id, order_number);

-- Index pendamping untuk papan kasir & laporan per outlet.
create index if not exists idx_menu_items_outlet
  on public.menu_items (outlet_id);
create index if not exists idx_orders_outlet_created
  on public.orders (outlet_id, created_at desc);

-- ---------------------------------------------------------
-- 6. HELPER AKSES OUTLET
-- ---------------------------------------------------------
-- Owner = semua outlet. Kasir = tepat satu outlet (profilnya).
create or replace function public.staff_can_access_outlet(p_outlet_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'owner' or outlet_id = p_outlet_id)
  );
$$;

revoke all on function public.staff_can_access_outlet(uuid) from public;
grant execute on function public.staff_can_access_outlet(uuid) to authenticated;

-- ---------------------------------------------------------
-- 7. JARING PENGAMAN: OUTLET DITANAM SAAT PESANAN DIBUAT
-- ---------------------------------------------------------
-- Checkout pelanggan memasukkan outlet_id sendiri (server-side action
-- menentukannya dari URL QR). Trigger ini hanya pengaman bila kolom itu
-- kosong: dine-in mengikuti meja, takeaway masuk outlet pusat.
create or replace function public.trg_orders_set_outlet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outlet uuid;
begin
  if new.outlet_id is not null then
    return new;
  end if;

  select t.outlet_id
    into v_outlet
  from public.tables t
  join public.outlets o on o.id = t.outlet_id
  where t.table_number = new.table_number
    and t.is_active
  order by o.is_pusat desc, o.created_at asc
  limit 1;

  if v_outlet is null then
    select id into v_outlet from public.outlets where is_pusat limit 1;
  end if;

  new.outlet_id := v_outlet;
  return new;
end;
$$;

drop trigger if exists trg_orders_stamp_outlet on public.orders;
create trigger trg_orders_stamp_outlet
  before insert on public.orders
  for each row execute function public.trg_orders_set_outlet();

-- ---------------------------------------------------------
-- 8. NOMOR ANTREAN PER OUTLET PER HARI
-- ---------------------------------------------------------
-- Semula: satu buku untuk seluruh cafe. Kini tiap outlet punya buku sendiri
-- dan mulai dari 01 tiap hari (Asia/Jakarta). Lock advisory tetap global -
-- dua pesanan yang berbarengan tak akan terbalik menjilat nomor yang sama.
create or replace function public.next_order_number(p_outlet_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today  date := (now() at time zone 'Asia/Jakarta')::date;
  v_seq    int;
  v_outlet uuid := p_outlet_id;
begin
  perform pg_advisory_xact_lock(hashtext('bd_coffee_order_number')::bigint);

  if v_outlet is null then
    select id into v_outlet from public.outlets where is_pusat limit 1;
  end if;

  select count(*)::int + 1
    into v_seq
  from public.orders
  where outlet_id = v_outlet
    and (created_at at time zone 'Asia/Jakarta')::date = v_today
    and order_number is not null;

  return 'ORD-' || to_char(v_today, 'YYYYMMDD') || '-' || lpad(v_seq::text, 2, '0');
end;
$$;

-- Versi lama tanpa parameter dipensiunkan; pemanggil baru selalu satu argumen.
drop function if exists public.next_order_number();

create or replace function public.trg_orders_set_order_number()
returns trigger
language plpgsql
as $$
begin
  -- hanya saat pembayaran berganti 'paid' dan belum punya nomor
  if new.payment_status = 'paid'
     and (old.payment_status is distinct from 'paid')
     and new.order_number is null then
    new.order_number := public.next_order_number(new.outlet_id);

    if new.status = 'pending' then
      new.status := 'confirmed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_order_number on public.orders;
create trigger trg_orders_order_number
  before update on public.orders
  for each row execute function public.trg_orders_set_order_number();

-- ---------------------------------------------------------
-- 9. RLS: KASIR HANYA OUTLETNYA, OWNER SEMUA
-- ---------------------------------------------------------
drop policy if exists "orders_staff_select" on public.orders;
create policy "orders_staff_select"
  on public.orders for select
  using (public.is_owner() or public.staff_can_access_outlet(outlet_id));

drop policy if exists "orders_staff_update" on public.orders;
create policy "orders_staff_update"
  on public.orders for update
  using (public.is_owner() or public.staff_can_access_outlet(outlet_id))
  with check (public.is_owner() or public.staff_can_access_outlet(outlet_id));

-- order_items tidak punya kolom outlet: lewat pesanannya.
drop policy if exists "order_items_staff_select" on public.order_items;
create policy "order_items_staff_select"
  on public.order_items for select
  using (
    public.is_owner()
    or exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and public.staff_can_access_outlet(o.outlet_id)
    )
  );

drop policy if exists "order_items_staff_update" on public.order_items;
create policy "order_items_staff_update"
  on public.order_items for update
  using (
    public.is_owner()
    or exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and public.staff_can_access_outlet(o.outlet_id)
    )
  );

-- ---------------------------------------------------------
-- 10. RPC KARYAWAN: SADARI OUTLET
-- ---------------------------------------------------------
-- list_staff berubah kembaliannya (kolom outlet baru), jadi didrop dulu.
drop function if exists public.list_staff();

create or replace function public.list_staff()
returns table (
  id          uuid,
  username    text,
  full_name   text,
  role        public.user_role,
  outlet_id   uuid,
  outlet_nama text,
  created_at  timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.username, p.full_name, p.role,
         p.outlet_id, o.nama, p.created_at
  from public.profiles p
  left join public.outlets o on o.id = p.outlet_id
  order by p.role, p.username;
$$;

revoke all on function public.list_staff() from public;
grant execute on function public.list_staff() to authenticated;

-- Buat kasir dari dashboard owner: outlet WAJIB disebut (tidak ada default),
-- supaya tak pernah lahir kasir tanpa outlet.
drop function if exists public.create_staff_account(text, text, text);

-- PENTING (dari uji langsung): di skema auth Supabase versi baru, kolom
-- `confirmed_at` di auth.users dibuat OTOMATIS (generated) — mengisinya
-- manual memunculkan "cannot insert a non-DEFAULT value into column".
-- Jadi baris auth.users di bawah hanya memakai kolom pola lama 02-install
-- yang terbukti jalan di database ini.
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

  -- Kolom & nilai persis pola 02-install yang terbukti jalan di database ini:
  -- id diisi gen_random_uuid(), confirmed_at TIDAK diisi (skema auth yang urus).
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

  -- Baris auth.identities tidak dibuat manual — pola lama tanpa baris ini
  -- sudah terbukti jalan untuk login kasir di database ini.

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

-- Daftar mandiri (halaman /daftar): outlet boleh ditentukan halaman;
-- kalau halaman belum mengarahkan (Tahap 1), masuk ke outlet pusat.
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

  -- Kolom & nilai persis pola 02-install yang terbukti jalan di database ini:
  -- id diisi gen_random_uuid(), confirmed_at TIDAK diisi (skema auth yang urus).
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

  -- Baris auth.identities tidak dibuat manual — pola lama tanpa baris ini
  -- sudah terbukti jalan untuk login kasir di database ini.

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

-- Log pendaftaran kini mencatat outlet si pekerja (baca dari profil).
create or replace function public._bd_log_registration(
  p_staff_id  uuid,
  p_username  text,
  p_full_name text,
  p_source    text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.staff_registration_log (staff_id, username, full_name, source, outlet_id)
  values (
    p_staff_id, p_username, p_full_name, p_source,
    (select outlet_id from public.profiles where id = p_staff_id)
  );
$$;

revoke all on function public._bd_log_registration(uuid, text, text, text) from public;

-- ---------------------------------------------------------
-- 11. LAPORAN: PARAMETER OUTLET (NULL = SEMUA OUTLET)
-- ---------------------------------------------------------
-- Param outlet ditambahkan di belakang param lama dengan nilai default NULL.
-- Versi lama (tanpa param outlet) dihapus dulu; kalau masih ada bersamaan,
-- panggilan 3 argumen jadi bingung memilih antara dua versi
-- (error 42725 "function is not unique" saat verifikasi 12e).
-- Setelah versi lama hilang, pemanggil lama tetap jalan: param tambahan
-- terisi otomatis dengan NULL = semua outlet.
drop function if exists public.get_sales_report(text, timestamptz, timestamptz);
create or replace function public.get_sales_report(
  p_period    text,
  p_start     timestamptz,
  p_end       timestamptz,
  p_outlet_id uuid default null
)
returns table (
  bucket       timestamptz,
  omzet        numeric,
  cost         numeric,
  net_profit   numeric,
  total_orders bigint
)
language sql stable security definer set search_path = public as $$
  select
    date_trunc(p_period, o.created_at at time zone 'Asia/Jakarta')
      at time zone 'Asia/Jakarta' as bucket,
    coalesce(sum(oi.subtotal), 0) as omzet,
    coalesce(sum(oi.unit_cost * oi.quantity), 0) as cost,
    coalesce(sum(oi.subtotal - (oi.unit_cost * oi.quantity)), 0) as net_profit,
    count(distinct o.id) as total_orders
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.status <> 'cancelled'
    and o.created_at between p_start and p_end
    and (p_outlet_id is null or o.outlet_id = p_outlet_id)
  group by bucket
  order by bucket;
$$;

grant execute on function public.get_sales_report(text, timestamptz, timestamptz, uuid) to authenticated;
revoke execute on function public.get_sales_report(text, timestamptz, timestamptz, uuid) from anon;

-- Sama: versi lama dihapus supaya panggilan 3 argumen tidak bingung.
drop function if exists public.get_top_menu(timestamptz, timestamptz, int);
create or replace function public.get_top_menu(
  p_start     timestamptz,
  p_end       timestamptz,
  p_limit     int default 5,
  p_outlet_id uuid default null
)
returns table (
  menu_item_id uuid,
  menu_name    text,
  total_qty    bigint,
  total_omzet  numeric
)
language sql stable security definer set search_path = public as $$
  select
    oi.menu_item_id,
    oi.menu_name,
    sum(oi.quantity) as total_qty,
    sum(oi.subtotal) as total_omzet
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status <> 'cancelled'
    and o.created_at between p_start and p_end
    and (p_outlet_id is null or o.outlet_id = p_outlet_id)
  group by oi.menu_item_id, oi.menu_name
  order by total_qty desc
  limit p_limit;
$$;

grant execute on function public.get_top_menu(timestamptz, timestamptz, int, uuid) to authenticated;
revoke execute on function public.get_top_menu(timestamptz, timestamptz, int, uuid) from anon;

-- ---------------------------------------------------------
-- 11b. PINDAH KASIR ANTAR OUTLET (owner)
-- ---------------------------------------------------------
create or replace function public.move_staff_account(
  p_staff_id  uuid,
  p_outlet_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public._bd_require_owner();

  if not exists (
    select 1 from public.profiles where id = p_staff_id and role = 'kasir'
  ) then
    raise exception 'Karyawan (kasir) tidak ditemukan.';
  end if;

  if not exists (select 1 from public.outlets where id = p_outlet_id) then
    raise exception 'Outlet tidak ditemukan.';
  end if;
  if not exists (
    select 1 from public.outlets where id = p_outlet_id and is_active
  ) then
    raise exception 'Outlet sudah diarsipkan.';
  end if;

  update public.profiles
     set outlet_id = p_outlet_id
   where id = p_staff_id
     and role = 'kasir';

  if not found then
    raise exception 'Karyawan (kasir) tidak ditemukan.';
  end if;
end;
$$;

revoke all on function public.move_staff_account(uuid, uuid) from public;
grant execute on function public.move_staff_account(uuid, uuid) to authenticated;

-- ---------------------------------------------------------
-- 12. VERIFIKASI (harus semuanya 0 kecuali yang dicatat)
-- ---------------------------------------------------------
-- 12a. Harus tepat 1 outlet pusat dengan slug outlet-a.
select slug, nama, is_pusat, is_active
from public.outlets
order by is_pusat desc;

-- 12b. Tidak boleh ada meja/menu/pesanan tanpa outlet.
select
  (select count(*) from public.tables     where outlet_id is null) as meja_tanpa_outlet,
  (select count(*) from public.menu_items where outlet_id is null) as menu_tanpa_outlet,
  (select count(*) from public.orders     where outlet_id is null) as pesanan_tanpa_outlet;
-- Semua kolom di baris ini harus 0.

-- 12c. Tidak boleh ada kasir tanpa outlet (owner boleh NULL).
select username, role
from public.profiles
where role = 'kasir' and outlet_id is null;
-- Harus 0 baris.

-- 12d. Nomor meja sama boleh beda outlet, tapi tidak boleh ganda DALAM outlet.
select o.nama as outlet, t.table_number, count(*) as jumlah
from public.tables t
join public.outlets o on o.id = t.outlet_id
group by o.nama, t.table_number
having count(*) > 1;
-- Harus 0 baris.

-- 12e. Laporan masih jalan (3 argumen lama tetap hidup).
select count(*) as baris_laporan
from public.get_sales_report('day', now() - interval '7 days', now());
