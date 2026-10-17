-- =========================================================
-- MIGRASI: 2026-10-17 — Konfirmasi bayar TUNAI lewat RPC
--
-- MASALAH (dari laporan owner):
--   Tombol "Konfirmasi Bayar" di dashboard kasir gagal untuk pesanan TUNAI.
--   Jalur QRIS (tombol "Sudah Bayar" di halaman customer) jalan normal.
--
-- PENYEBAB:
--   Dua jalur pembayaran memakai cara berbeda untuk mengubah payment_status:
--
--     QRIS  -> app/order/[id]/actions.ts memanggil RPC confirm_qris_payment()
--              Function itu SECURITY DEFINER, jadi BYPASS RLS.
--
--     TUNAI -> app/admin/kasir/actions.ts memakai `.from("orders").update()`
--              Update langsung WAJIB lolos policy RLS.
--
--   Setelah policy select/insert untuk anon dibersihkan di
--   20261017-lock-down-orders-rls.sql, jalur TUNAI jadi satu-satunya yang
--   bergantung penuh pada policy RLS, dan di situlah ia tersandung.
--
--   Perbaikannya bukan loosen policy RLS (itu akan membuka data pesanan lagi),
--   tapi menyamakan jalur TUNAI dengan QRIS: sama-sama lewat function
--   SECURITY DEFINER yang sempit cakupannya.
--
-- ⚠️ Jalankan SETELAH 20261016-queue-number-on-confirmation.sql
--    (function ini memicu trigger penomoran antrean, sama seperti QRIS).
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Fungsi: konfirmasi bayar TUNAI oleh kasir
-- ---------------------------------------------------------
create or replace function public.confirm_cash_payment(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text;
  v_found integer;
begin
  -- Hanya staff (owner atau kasir) yang boleh mengonfirmasi pembayaran.
  -- Sengaja dicek di dalam function, bukan hanya lewat grant, karena
  -- SECURITY DEFINER membuat contextberganti menjadi hak function, bukan hak caller.
  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_role is null or v_role not in ('owner', 'kasir') then
    raise exception 'Hanya kasir atau owner yang boleh mengonfirmasi pembayaran.'
      using errcode = '42501';
  end if;

  -- Syarat yang BOLEH diubah, persis seperti confirm_qris_payment():
  --   - hanya pesanan TUNAI
  --   - belum dibayar
  --   - belum dibatalkan
  -- Kolom lain (total, table_number, status) tidak disentuh. Nomor antrean
  -- tetap dibuat oleh trigger trg_orders_order_number.
  update public.orders
     set payment_status = 'paid'
   where id = p_order_id
     and payment_method = 'cash'
     and payment_status = 'pending'
     and status <> 'cancelled';

  get diagnostics v_found = row_count;
  return v_found > 0;
end;
$$;

-- ---------------------------------------------------------
-- 2. Grant hanya ke yang sudah login
-- ---------------------------------------------------------
revoke all on function public.confirm_cash_payment(uuid) from public;
grant execute on function public.confirm_cash_payment(uuid) to authenticated;

-- ---------------------------------------------------------
-- 3. Verifikasi
-- ---------------------------------------------------------

-- 3a. Function harus ada
select proname as nama_fungsi, prosecdef as security_definer
from pg_proc
where proname = 'confirm_cash_payment';
-- security_definer harus true.

-- 3b. anon TIDAK boleh memanggil
select
  has_function_privilege('anon', 'confirm_cash_payment(uuid)', 'execute') as anon_bisa;
-- Harus FALSE.

-- 3c. Update langsung ke tabel orders oleh anon harus tetap GAGAL.
--     Ini yang menjaga agar jalur baru tidak membuka celah baru.
select has_table_privilege('anon', 'public.orders', 'update') as anon_bisa_update;
-- Harus FALSE.
