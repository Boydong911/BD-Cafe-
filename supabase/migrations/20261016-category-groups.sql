-- =========================================================
-- MIGRASI: 2026-10-16 — Kategori dua tingkat (Minuman / Makanan)
--
-- TUJUAN:
--   1. Kategori jadi dua tingkat. "Minuman" dan "Makanan" adalah induk
--      (parent_id IS NULL), sub-kategori nempel ke induknya:
--        Minuman -> Kopi, Non-Kopi, Manual Brew
--        Makanan -> Berat, Ringan
--   2. Kolom `is_drink` menandai sub-kategori yang_is_minuman. Ini yang
--      membuat menu minuman otomatis dapat tombol Gula + Ice/Hot, sementara
--      menu makanan tidak.
--
--   Tanpa `is_drink`, kita hanya bisa menebak dari NAMA kategori — rapuh,
--   dan langsung salah begitu ada kategori baru seperti "Kue" atau "Dessert".
--
-- PERUBAHAN DATA:
--   - "Kopi Susu"     -> "Kopi"
--   - "Makanan Ringan"-> "Ringan"  (menu di dalamnya tetap nempel, karena
--                                    yang diubah cuma nama barisnya)
--   - tambah "Berat" (kosong, siap diisi)
--   - tambah induk "Minuman" & "Makanan"
--   - tiap menu MINUMAN yang belum punya opsi kustomisasi dikasih Gula + Suhu
--   - tiap menu MAKANAN yang opsinya persis sama dengan default minum
--     dikosongkan (kexcepta opsi khusus yang sengaja dibuat owner, itu
--     tidak disentuh)
--
-- ⚠️ Jalankan setelah 20261016-queue-number-on-confirmation.sql
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

-- ---------------------------------------------------------
-- 1. KOLOM BARU
-- ---------------------------------------------------------
alter table public.categories
  add column if not exists parent_id uuid
    references public.categories (id) on delete set null;

alter table public.categories
  add column if not exists is_drink boolean not null default false;

comment on column public.categories.parent_id is
  'Kategori induk. NULL = kategori tingkat atas (Minuman / Makanan).';
comment on column public.categories.is_drink is
  'True bila kategori ini minuman -> menu-nya dapat opsi Gula + Ice/Hot.';

create index if not exists idx_categories_parent
  on public.categories (parent_id);

-- Fungsi bantu: ambil id kategori berdasarkan nama (aman kalau belum ada).
-- Dipakai ulang supaya seluruh migrasi ini bisa dijalankan berulang.
create or replace function public._bd_cat_id(p_name text)
returns uuid
language sql stable as $$
  select id from public.categories where name = p_name limit 1;
$$;

-- ---------------------------------------------------------
-- 2. INDUK: Minuman & Makanan
-- ---------------------------------------------------------
insert into public.categories (name, sort_order, is_drink)
values ('Minuman', 1, false), ('Makanan', 2, false)
on conflict (name) do nothing;

-- ---------------------------------------------------------
-- 3. GANTI NAMA + TAMBAH KATEGORI BARU
-- ---------------------------------------------------------
update public.categories set name = 'Kopi' where name = 'Kopi Susu';
update public.categories set name = 'Ringan' where name = 'Makanan Ringan';

insert into public.categories (name, sort_order, is_drink)
values ('Berat', 20, false)
on conflict (name) do nothing;

-- ---------------------------------------------------------
-- 4. SAMBUNGKAN SUB-KATEGORI KE INDUKNYA
-- ---------------------------------------------------------
update public.categories
   set parent_id = public._bd_cat_id('Minuman'),
       is_drink  = true
 where name in ('Kopi', 'Non-Kopi', 'Manual Brew');

update public.categories
   set parent_id = public._bd_cat_id('Makanan'),
       is_drink  = false,
       sort_order = case name when 'Berat' then 20 else 21 end
 where name in ('Berat', 'Ringan');

-- Rapikan urutan sub-kategori minuman.
update public.categories set sort_order = 10 where name = 'Kopi';
update public.categories set sort_order = 11 where name = 'Non-Kopi';
update public.categories set sort_order = 12 where name = 'Manual Brew';

-- ---------------------------------------------------------
-- 5. BACKFILL OPSI KUSTOMISASI MENU
-- ---------------------------------------------------------
do $$
declare
  v_default constant jsonb := '[{"name":"Gula","options":[{"label":"Non Gula","price_delta":0},{"label":"Gula","price_delta":0}]},{"name":"Suhu","options":[{"label":"Ice","price_delta":0},{"label":"Hot","price_delta":0}]}]'::jsonb;
begin
  -- Menu MINUMAN tanpa opsi (null / bukan array / array kosong) -> dapat default.
  --
  -- `jsonb_array_length()` melempar error kalau kolomnya bukan array, jadi
  -- json_typeof harus dicek lebih dulu. CASE dipakai (bukan OR) karena CASE
  -- dijamin Postgres evaluating cabangnya berurutan.
  update public.menu_items m
     set customization_options = v_default
    from public.categories c
   where m.category_id = c.id
     and c.is_drink
     and case
           when jsonb_typeof(m.customization_options) = 'array'
             then jsonb_array_length(m.customization_options) = 0
           else true
         end;

  -- Menu MAKANAN: kosongkan HANYA kalau isinya persis sama dengan default
  -- minum (mis. sisa seed lama). Opsi lain yang sengaja dibuat owner
  -- (mis. "Extra Shot" Rp 5.000) TIDAK disentuh.
  update public.menu_items m
     set customization_options = '[]'::jsonb
    from public.categories c
   where m.category_id = c.id
     and not c.is_drink
     and m.customization_options = v_default;
end;
$$;

-- ---------------------------------------------------------
-- 6. VERIFIKASI
-- ---------------------------------------------------------

-- 6a. Pohon kategori harus jadi dua tingkat, tanpa sub-kategori yatim.
select
  coalesce(p.name, '(tingkat atas)') as induk,
  c.name                          as kategori,
  c.is_drink,
  c.sort_order,
  (select count(*) from public.menu_items m where m.category_id = c.id) as jumlah_menu
from public.categories c
left join public.categories p on p.id = c.parent_id
order by coalesce(p.sort_order, c.sort_order), p.name nulls last, c.sort_order;

-- 6b. Tidak boleh ada kategori tingkat atas yang sudah punya menu langsung
--     (menu harus selalu di sub-kategori, bukan langsung di Minuman/Makanan).
select c.name, count(m.id) as jumlah_menu
from public.categories c
join public.menu_items m on m.category_id = c.id
where c.parent_id is null
group by c.name;
-- Hasilnya harus kosong. Kalau tidak, pindahkan menu itu ke sub-kategori.

-- 6c. Semua menu minuman harus punya 2 grup (Gula + Suhu).
--     CASE dipakai agar aman pada kolom yang bukan array.
with per_menu as (
  select
    c.is_drink,
    case
      when jsonb_typeof(m.customization_options) = 'array'
        then jsonb_array_length(m.customization_options)
      else 0
    end as jumlah_grup
  from public.menu_items m
  join public.categories c on c.id = m.category_id
)
select
  count(*) filter (where not is_drink)                        as total_makanan,
  count(*) filter (where is_drink and jumlah_grup = 2)         as minuman_lengkap,
  count(*) filter (where is_drink and jumlah_grup <> 2)        as minuman_belum_lengkap,
  count(*) filter (where not is_drink and jumlah_grup > 0)     as makanan_yg_punya_opsi
from per_menu;
-- minuman_belum_lengkap harus 0.
-- makanan_yg_punya_opsi boleh > 0 kalau memang ada opsi khusus (mis. Extra Shot).
