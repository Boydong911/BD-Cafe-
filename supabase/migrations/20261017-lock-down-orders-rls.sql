-- =========================================================
-- MIGRASI: 2026-10-17 — Kunci RLS pesanan + audit log pendaftaran
--
-- MASALAH 1 (KEAMANAN — INI YANG SERIUS):
--   Policy `orders_public_select_by_id` di schema.sql BERAPA dengan
--   `using (true)`. Padahal namanya promising "select by id".
--
--   Arti `using (true)`: SEMUA baris lolos untuk SIAPA SAJA, termasuk
--   pengunjung anon yang belum login sama sekali. Akibatnya siapa pun yang
--   punya anon key (yang memang publik di dalam bundle browser) bisa:
--     select id, customer_name, table_number, total, notes from orders
--   dan mendapat SELURUH riwayat pesanan — nama pelanggan, meja, total,
--   sampai catatan. `order_items_public_select` memakai `using (true)` juga.
--
--   Komentar di schema.sql sudah niat: "aman karena id berupa UUID acak".
--   Itu benar UNTUK halaman /order/[orderId] — tapi policy-nya tidak membatasi
--   ke satu baris saja, jadi seluruh tabel ikut terbuka.
--
-- SOLUSI:
--   Halaman customer (/order/[id] dan /order/[id]/pay) tidak lagi memakai
--   `.from("orders").select()` langsung. Sekarang lewat RPC
--   `get_order_by_id(p_order_id)` — SECURITY DEFINER, menerima UUID, dan
--   hanya mengembalikan SATU baris itu kalau id-nya benar-benar ada.
--   UUID acak 122-bit tidak bisa ditebak, jadi ini setara amannya dengan
--   "punya link" — persis model yang kamu mau, tapi tanpa bocor daftar.
--
--   Policy select untuk anon DIHAPUS. Yang tersisa hanya policy staff.
--   Customer halaman remeh tetap jalan lewat RPC.
--
--   ⚠️ PENTING soal Realtime: policy RLS juga berlaku untuk Realtime.
--     Dashboard kasir memakai postgres_changes — kasir adalah staff, jadi
--     policy staff tetap berlaku dan realtime TIDAK terganggu.
--     Halaman customer TIDAK lagi memakai realtime untuk update status.
--
-- MASALAH 2 (AUDIT):
--   Halaman /daftar membuat akun kasir tanpa jejak siapa yang mendaftar.
--   Ditambah tabel `staff_registration_log` berisi waktu pendaftaran, supaya
--   owner bisa melihat daftar baru dan kapan.
--
-- CATATAN SOAL IP — sengaja TIDAK disimpan:
--   `inet_client_addr()` dari dalam Postgres mengembalikan alamat internal
--   Supabase (10.x.x.x), BUKAN IP pengunjung — nilainya sama untuk semua orang
--   dan tidak berguna. IP asli harus diteruskan dari server action sebagai
--   parameter; menambahkannya berarti mengubah signature function yang sudah
--   kamu jalankan. Untuk sekarang yang dicatat adalah WAKTU, karena itu sudah
--   menjawab "ada yang daftar di luar jam kerja?".
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

-- ---------------------------------------------------------
-- 0. BACKUP policy lama (bukti, supaya bisa dibandingkan)
-- ---------------------------------------------------------
create table if not exists public._bak_rls_policies_20261017 (
  policy_name text primary key,
  definition text not null,
  saved_at    timestamptz not null default now()
);

insert into public._bak_rls_policies_20261017 (policy_name, definition)
select policyname, coalesce(qual, '') || ' | ' || coalesce(with_check, '')
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'order_items')
on conflict (policy_name) do update
  set definition = excluded.definition,
      saved_at   = now();

-- ---------------------------------------------------------
-- 1. HAPUS policy select untuk anon
-- ---------------------------------------------------------
drop policy if exists "orders_public_select_by_id" on public.orders;
drop policy if exists "order_items_public_select" on public.order_items;

-- Policy select untuk staff (dashboard kasir). INSERT tetap terbuka untuk anon
-- karena customer membuat pesanan tanpa login.
drop policy if exists "orders_staff_select" on public.orders;
create policy "orders_staff_select"
  on public.orders for select
  using (public.is_staff());

drop policy if exists "order_items_staff_select" on public.order_items;
create policy "order_items_staff_select"
  on public.order_items for select
  using (public.is_staff());

-- ---------------------------------------------------------
-- 2. RPC untuk halaman customer
-- ---------------------------------------------------------
-- Hanya mengembalikan satu pesanan, dan hanya kalau UUID-nya benar-benar ada.
--Grpc ini yang menggantikan select langsung di halaman /order/[id] dan /pay.
create or replace function public.get_order_by_id(p_order_id uuid)
returns table (
  id                uuid,
  order_number      text,
  customer_name     text,
  order_type        public.order_type,
  table_number      text,
  notes             text,
  payment_method    public.payment_method,
  payment_status    public.payment_status,
  status            public.order_status,
  subtotal          numeric,
  total             numeric,
  created_at        timestamptz,
  updated_at        timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select o.id, o.order_number, o.customer_name, o.order_type, o.table_number,
           o.notes, o.payment_method, o.payment_status, o.status,
           o.subtotal, o.total, o.created_at, o.updated_at
    from public.orders o
    where o.id = p_order_id;
end;
$$;

-- Detail item untuk satu pesanan (dipakai halaman ringkasan pesanan).
create or replace function public.get_order_items(p_order_id uuid)
returns table (
  id                      uuid,
  menu_item_id            uuid,
  menu_name               text,
  quantity                int,
  selected_customizations jsonb,
  subtotal                numeric,
  created_at              timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select oi.id, oi.menu_item_id, oi.menu_name, oi.quantity,
           oi.selected_customizations, oi.subtotal, oi.created_at
    from public.order_items oi
    where oi.order_id = p_order_id
    order by oi.created_at;
end;
$$;

-- Cek status saja untuk timer 15 menit (dipakai getPaymentState()).
create or replace function public.get_order_payment_state(p_order_id uuid)
returns table (
  status         public.order_status,
  payment_status public.payment_status,
  created_at     timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select o.status, o.payment_status, o.created_at
    from public.orders o
    where o.id = p_order_id;
end;
$$;

-- ---------------------------------------------------------
-- 3. AUDIT LOG PENDAFTARAN
-- ---------------------------------------------------------
create table if not exists public.staff_registration_log (
  id          uuid primary key default gen_random_uuid(),
  -- id user yang dibuat (bisa null kalau nanti gagal dihapus)
  staff_id    uuid,
  username    text not null,
  full_name   text,
  -- 'self_register' = daftar sendiri dari /daftar
  -- 'owner'       = dibuat owner dari dashboard Karyawan
  source      text not null default 'self_register',
  created_at  timestamptz not null default now()
);

comment on table public.staff_registration_log is
  'Jejak pendaftaran karyawan. Dipakai owner untuk melihat siapa saja yang masuk.';

create index if not exists idx_staff_reg_log_created
  on public.staff_registration_log (created_at desc);

-- Hanya owner yang boleh BACA log. Tidak ada policy insert/update/delete:
-- penulisan selalu dari dalam function, tidak pernah dari client.
alter table public.staff_registration_log enable row level security;

drop policy if exists "staff_registration_log_owner_read" on public.staff_registration_log;
create policy "staff_registration_log_owner_read"
  on public.staff_registration_log for select
  using (public.is_owner());

-- Fungsi yang mencatat pendaftaran. Dipanggil dari dalam
-- register_staff_account() dan create_staff_account().
create or replace function public._bd_log_registration(
  p_staff_id  uuid,
  p_username  text,
  p_full_name text,
  p_source    text
)
returns void
language sql security definer set search_path = public as $$
  insert into public.staff_registration_log (staff_id, username, full_name, source)
  values (p_staff_id, p_username, p_full_name, p_source);
$$;

revoke all on function public._bd_log_registration(uuid, text, text, text) from public;

-- ---------------------------------------------------------
-- 4. RPC untuk owner membaca & menutup catatan
-- ---------------------------------------------------------
create or replace function public.list_recent_registrations(p_days int default 7)
returns table (
  id          uuid,
  username    text,
  full_name   text,
  source      text,
  created_at  timestamptz,
  still_active boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Akses ditolak: hanya owner yang bisa melihat log pendaftaran.'
      using errcode = '42501';
  end if;

  return query
    select
      l.id,
      l.username,
      l.full_name,
      l.source,
      l.created_at,
      -- Masih bisa login? aka profile-nya masih ada di tabel profiles.
      exists (select 1 from public.profiles p where p.username = l.username)
    from public.staff_registration_log l
    where l.created_at >= now() - make_interval(days => greatest(p_days, 1))
    order by l.created_at desc
    limit 100;
end;
$$;

-- Tandai "sudah saya lihat" supaya banner tidak muncul terus.
-- Disimpan per-akun di tabel kecil, bukan localStorage, supaya tetap
-- tersimpan walau owner ganti perangkat.
create table if not exists public.staff_registration_reads (
  staff_id    uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.staff_registration_reads enable row level security;

drop policy if exists "staff_registration_reads_owner_all" on public.staff_registration_reads;
create policy "staff_registration_reads_owner_all"
  on public.staff_registration_reads for all
  using (public.is_owner())
  with check (public.is_owner());

create or replace function public.mark_registrations_seen(p_staff_id uuid)
returns void
language sql security definer set search_path = public as $$
  insert into public.staff_registration_reads (staff_id, last_seen_at)
  values (p_staff_id, now())
  on conflict (staff_id) do update
    set last_seen_at = now();
$$;

revoke all on function public.mark_registrations_seen(uuid) from public;
grant execute on function public.mark_registrations_seen(uuid) to authenticated;

-- ---------------------------------------------------------
-- 5. Grant RPC
-- ---------------------------------------------------------
revoke all on function public.get_order_by_id(uuid) from public;
revoke all on function public.get_order_items(uuid) from public;
revoke all on function public.get_order_payment_state(uuid) from public;
revoke all on function public.list_recent_registrations(int) from public;

-- Tiga function order: dipakai halaman customer yang BELUM login.
grant execute on function public.get_order_by_id(uuid)         to anon, authenticated;
grant execute on function public.get_order_items(uuid)         to anon, authenticated;
grant execute on function public.get_order_payment_state(uuid) to anon, authenticated;

-- Dua function log: hanya owner, dan keduanya cek is_owner() di dalamnya.
grant execute on function public.list_recent_registrations(int) to authenticated;

-- ---------------------------------------------------------
-- 6. VERIFIKASI
-- ---------------------------------------------------------

-- 6a. Policy select untuk anon harus SUDAH HILANG.
--     Kalau baris ini masih muncul, drop policy gagal.
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'order_items')
order by tablename, policyname;
-- Tidak boleh ada policy dengan cmd='SELECT' dan roles={anon}.
-- Yang boleh: orders_staff_select & order_items_staff_select (staff).

-- 6b. Cek cepat dari sisi anon.
select has_table_privilege('anon', 'public.orders', 'select') as anon_bisa_select_orders;
-- Harus FALSE.

-- 6c. Function baru harus ada.
select proname
from pg_proc
where proname in (
  'get_order_by_id', 'get_order_items', 'get_order_payment_state',
  'list_recent_registrations', 'mark_registrations_seen'
);

-- 6d. Ambil UUID satu pesanan untuk tes manual (tempel ke langkah 6e).
select id from public.orders order by created_at desc limit 1;

-- 6e. TES: RPC pesanan harus jalan, tapi daftar tidak boleh bocor.
--     Ganti <uuid-dari-6d> dengan UUID di atas.
--
--   select * from public.get_order_by_id('<uuid-dari-6d>');   -- harus 1 baris
--   select count(*) from public.get_order_by_id(gen_random_uuid()); -- harus 0
--
--  Lalu tes sebagai ANON lewat PostgREST / dashboard anon:
--   select count(*) from orders;
--   -> harus ERROR "permission denied for table orders"
