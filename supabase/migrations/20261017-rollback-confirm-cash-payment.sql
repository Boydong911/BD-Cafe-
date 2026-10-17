-- =========================================================
-- ROLLBACK: 2026-10-17 — Konfirmasi bayar TUNAI lewat RPC
--
-- Menghapus function confirm_cash_payment(). Kode aplikasi memakai RPC ini,
-- jadi setelah rollback tombol "Konfirmasi Bayar" di dashboard kasir akan
-- gagal lagi — kembalikan juga commit kodenya bila perlu.
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =========================================================

drop function if exists public.confirm_cash_payment(uuid);

-- ---------------------------------------------------------
-- VERIFIKASI: function harus hilang
-- ---------------------------------------------------------
select proname
from pg_proc
where proname = 'confirm_cash_payment';
-- Hasilnya harus kosong.
