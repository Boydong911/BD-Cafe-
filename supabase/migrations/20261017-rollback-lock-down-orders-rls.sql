-- =========================================================
-- ROLLBACK: 2026-10-17 — Kunci RLS pesanan + audit log
--
-- ⚠️ MENGEMBALIKAN KE KONDISI YANG TIDAK AMAN.
--
--    Policy select yang dipulihkan di bawah (`using (true)`) BERARTI siapa
--    saja tanpa login bisa membaca SELURUH tabel pesanan: nama pelanggan,
--    nomor meja, total, catatan, sampai menu yang dipesan. Itu kebocoran data
--    pelanggan yang nyata.
--
--    Jangan menjalankan rollback ini di database yang sudah dipakai customer
--    sungguhan. File ini hanya untuk emergency — misalnya kalau RPC
--    get_order_by_id()-nya rusak dan halaman customer tidak bisa jalan
--    sama sekali.
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =========================================================

-- 1) Pulihkan policy select versi lama (TIDAK AMAN — hanya untuk emergency)
drop policy if exists "orders_staff_select" on public.orders;
create policy "orders_public_select_by_id"
  on public.orders for select using (true);

drop policy if exists "order_items_staff_select" on public.order_items;
create policy "order_items_public_select"
  on public.order_items for select using (true);

-- 2) Buang RPC pemesanan
drop function if exists public.get_order_payment_state(uuid);
drop function if exists public.get_order_items(uuid);
drop function if exists public.get_order_by_id(uuid);

-- 3) Buang tabel audit
drop table if exists public.staff_registration_reads;
drop table if exists public.staff_registration_log;
drop function if exists public._bd_log_registration(uuid, text, text, text);
drop function if exists public.list_recent_registrations(int);
drop function if exists public.mark_registrations_seen(uuid);

-- 4) Buang tabel backup policy lama (opsional, boleh disimpan sebagai arsip)
--    Uncomment kalau memang tidak ingin disimpan lagi:
-- drop table if exists public._bak_rls_policies_20261017;

-- ---------------------------------------------------------
-- VERIFIKASI
-- ---------------------------------------------------------
-- Policy select yang kembali ke `using (true)` — inilah yang SEHARUSNYA
-- tidak ada di database produksi:
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'order_items')
  and cmd = 'SELECT';
