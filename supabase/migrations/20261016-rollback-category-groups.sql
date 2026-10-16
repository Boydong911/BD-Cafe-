-- =========================================================
-- ROLLBACK: 2026-10-16 — Kategori dua tingkat
--
-- Mengembalikan:
--   - kolom parent_id & is_drink di BUANG
--   - "Kopi"        -> "Kopi Susu"
--   - "Ringan"      -> "Makanan Ringan"
--   - kategori "Berat" dihapus (kosong, jadi aman dihapus)
--   - kategori "Minuman" & "Makanan" dihapus (tidak pernah dipakai menu)
--   - opsi kustomisasi menu DIAMKALIKAN seperti semula:
--       * menu minum yang kita kasih default -> []
--       * menu makanan yang kita kosongkan      -> default
--
-- ⚠️ Rollback ini TIDAK bisa mengembalikan nilai kustomisasi asli bila
--    owner sempat mengubahnya lewat editor. Yang bisa dikembalikan hanya
--    perubahan yang dilakukan migrasi ini.
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =========================================================

do $$
declare
  v_default constant jsonb := '[{"name":"Gula","options":[{"label":"Non Gula","price_delta":0},{"label":"Gula","price_delta":0}]},{"name":"Suhu","options":[{"label":"Ice","price_delta":0},{"label":"Hot","price_delta":0}]}]'::jsonb;
begin
  -- Sebelum lepas kolom is_drink, kembalikan dulu nilai yang kita ubah.
  -- Minuman yang kita kasih default -> kosongkan kembali.
  update public.menu_items m
     set customization_options = '[]'::jsonb
    from public.categories c
   where m.category_id = c.id
     and c.is_drink
     and m.customization_options = v_default;

  -- Makanan yang kita kosongkan -> isi default kembali.
  update public.menu_items m
     set customization_options = v_default
    from public.categories c
   where m.category_id = c.id
     and not c.is_drink
     and m.customization_options = '[]'::jsonb;

  -- Buang kategori yang tidak pernah dipakai menu.
  delete from public.categories
   where name in ('Berat', 'Minuman', 'Makanan')
     and not exists (select 1 from public.menu_items m where m.category_id = categories.id);

  update public.categories set name = 'Kopi Susu' where name = 'Kopi';
  update public.categories set name = 'Makanan Ringan' where name = 'Ringan';
end;
$$;

drop index if exists public.idx_categories_parent;

alter table public.categories drop column if exists is_drink;
alter table public.categories drop column if exists parent_id;

drop function if exists public._bd_cat_id(text);

-- ---------------------------------------------------------
-- VERIFIKASI: kolom baru harus hilang
-- ---------------------------------------------------------
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'categories'
order by ordinal_position;
-- Tinggal id, name, sort_order, created_at.

select name, sort_order from public.categories order by sort_order;
