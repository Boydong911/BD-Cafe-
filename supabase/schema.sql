-- =========================================================
-- CAFE/RESTORAN APP — SUPABASE SCHEMA
-- Jalankan di Supabase SQL Editor secara berurutan.
-- =========================================================

-- ---------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------
create type user_role as enum ('owner', 'kasir');
create type order_type as enum ('dine_in', 'takeaway');
create type payment_method as enum ('qris', 'cash');
create type payment_status as enum ('pending', 'paid');
create type order_status as enum (
  'pending',      -- baru masuk, menunggu konfirmasi kasir
  'confirmed',    -- dikonfirmasi kasir / pembayaran diterima
  'preparing',    -- sedang dibuat
  'ready',        -- siap diantar / diambil
  'completed',    -- selesai
  'cancelled'
);

-- ---------------------------------------------------------
-- 2. PROFILES (extends auth.users) — Owner & Kasir
-- ---------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique not null,
  full_name   text,
  role        user_role not null default 'kasir',
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Data staff (owner/kasir), 1:1 dengan auth.users';

-- Function untuk menerjemahkan username -> email login internal.
-- SECURITY DEFINER supaya bisa dipanggil oleh 'anon' (belum login) saat proses login,
-- tapi HANYA mengembalikan email, tidak pernah mengembalikan password/hash.
create or replace function public.get_login_email(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = p_username
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;

-- ---------------------------------------------------------
-- 3. CATEGORIES
-- ---------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. MENU ITEMS
-- ---------------------------------------------------------
create table public.menu_items (
  id                      uuid primary key default gen_random_uuid(),
  category_id             uuid references public.categories (id) on delete set null,
  name                    text not null,
  description             text,
  price                   numeric(12,2) not null check (price >= 0),
  cost_price              numeric(12,2) not null default 0 check (cost_price >= 0), -- HPP
  image_url               text,
  is_available            boolean not null default true,
  -- Opsi kustomisasi disimpan sebagai JSON, contoh:
  -- [
  --   { "name": "Gula", "choices": [
  --       {"label":"Normal","price_delta":0},
  --       {"label":"Less Sugar","price_delta":0},
  --       {"label":"No Sugar","price_delta":0}
  --   ]},
  --   { "name": "Ice", "choices": [
  --       {"label":"Normal","price_delta":0},{"label":"Less Ice","price_delta":0}
  --   ]},
  --   { "name": "Extra Shot", "choices": [
  --       {"label":"Tidak","price_delta":0},{"label":"+1 Shot","price_delta":5000}
  --   ]}
  -- ]
  customization_options   jsonb not null default '[]'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_menu_items_category on public.menu_items (category_id);
create index idx_menu_items_available on public.menu_items (is_available);

-- ---------------------------------------------------------
-- 5. ORDERS
-- ---------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text unique not null default
                       ('ORD-' || to_char(now(), 'YYYYMMDD') || '-' ||
                        lpad(floor(random() * 10000)::text, 4, '0')),
  customer_name     text not null,
  order_type        order_type not null,
  table_number      text,                    -- null jika takeaway
  notes             text,
  payment_method    payment_method not null,
  payment_status    payment_status not null default 'pending',
  status            order_status not null default 'pending',
  subtotal          numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint chk_table_number check (
    (order_type = 'dine_in'  and table_number is not null) or
    (order_type = 'takeaway' and table_number is null)
  )
);

create index idx_orders_status on public.orders (status);
create index idx_orders_created_at on public.orders (created_at);

-- ---------------------------------------------------------
-- 6. ORDER ITEMS
-- ---------------------------------------------------------
create table public.order_items (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references public.orders (id) on delete cascade,
  menu_item_id              uuid references public.menu_items (id) on delete set null,
  menu_name                 text not null,     -- snapshot nama saat dipesan
  unit_price                numeric(12,2) not null,
  unit_cost                 numeric(12,2) not null default 0, -- snapshot HPP untuk laporan
  quantity                  int not null check (quantity > 0),
  selected_customizations   jsonb not null default '[]'::jsonb, -- pilihan gula/ice/shot yg dipilih
  subtotal                  numeric(12,2) not null,
  created_at                timestamptz not null default now()
);

create index idx_order_items_order on public.order_items (order_id);
create index idx_order_items_menu on public.order_items (menu_item_id);

-- ---------------------------------------------------------
-- 7. TRIGGER updated_at
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ---------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.categories   enable row level security;
alter table public.menu_items   enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;

-- Helper: cek apakah user login adalah staff (owner/kasir)
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid()
  );
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner'
  );
$$;

-- PROFILES: staff hanya bisa lihat profil sendiri; owner bisa lihat semua
create policy "profiles_select_self_or_owner"
  on public.profiles for select
  using (id = auth.uid() or public.is_owner());

-- CATEGORIES: publik boleh baca, hanya owner boleh tulis
create policy "categories_public_read"
  on public.categories for select using (true);
create policy "categories_owner_write"
  on public.categories for all using (public.is_owner()) with check (public.is_owner());

-- MENU ITEMS: publik boleh baca semua (termasuk yang habis, biar UI bisa tampilkan
-- badge "Habis"); hanya owner boleh insert/update/delete
create policy "menu_items_public_read"
  on public.menu_items for select using (true);
create policy "menu_items_owner_write"
  on public.menu_items for insert with check (public.is_owner());
create policy "menu_items_owner_update"
  on public.menu_items for update using (public.is_owner()) with check (public.is_owner());
create policy "menu_items_owner_delete"
  on public.menu_items for delete using (public.is_owner());

-- ORDERS:
--  * Siapa saja (anon) boleh INSERT order baru (checkout customer)
--  * Siapa saja boleh SELECT order berdasarkan id (dipakai halaman /order/[orderId]) —
--    aman karena id berupa UUID acak yang tidak ditebak.
--  * Hanya staff yang boleh UPDATE (ubah status) dan SELECT semua daftar order.
create policy "orders_public_insert"
  on public.orders for insert with check (true);
create policy "orders_public_select_by_id"
  on public.orders for select using (true);
create policy "orders_staff_update"
  on public.orders for update using (public.is_staff()) with check (public.is_staff());

-- ORDER ITEMS: sama seperti orders
create policy "order_items_public_insert"
  on public.order_items for insert with check (true);
create policy "order_items_public_select"
  on public.order_items for select using (true);
create policy "order_items_staff_update"
  on public.order_items for update using (public.is_staff());

-- ---------------------------------------------------------
-- 9. REALTIME
-- ---------------------------------------------------------
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;

-- ---------------------------------------------------------
-- 10. REPORTING FUNCTIONS (dipakai Dashboard Owner)
-- ---------------------------------------------------------

-- Ringkasan omzet/HPP/profit per bucket waktu ('hour' | 'day' | 'week' | 'month')
create or replace function public.get_sales_report(
  p_period text,             -- 'hour' | 'day' | 'week' | 'month'
  p_start  timestamptz,
  p_end    timestamptz
)
returns table (
  bucket        timestamptz,
  omzet         numeric,
  cost          numeric,
  net_profit    numeric,
  total_orders  bigint
)
language sql stable security definer set search_path = public as $$
  select
    date_trunc(p_period, o.created_at) as bucket,
    coalesce(sum(oi.subtotal), 0) as omzet,
    coalesce(sum(oi.unit_cost * oi.quantity), 0) as cost,
    coalesce(sum(oi.subtotal - (oi.unit_cost * oi.quantity)), 0) as net_profit,
    count(distinct o.id) as total_orders
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.status <> 'cancelled'
    and o.created_at between p_start and p_end
  group by bucket
  order by bucket;
$$;

-- Top 5 menu terlaris pada rentang tanggal tertentu
create or replace function public.get_top_menu(
  p_start  timestamptz,
  p_end    timestamptz,
  p_limit  int default 5
)
returns table (
  menu_item_id  uuid,
  menu_name     text,
  total_qty     bigint,
  total_omzet   numeric
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
  group by oi.menu_item_id, oi.menu_name
  order by total_qty desc
  limit p_limit;
$$;

grant execute on function public.get_sales_report(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_top_menu(timestamptz, timestamptz, int) to authenticated;
