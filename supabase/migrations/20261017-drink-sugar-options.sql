-- Ubah opsi kustomisasi menu MINUMAN jadi 3 pilihan gula.
--
--Owner minta label Bahasa Inggris dan menambah satu tingkat di tengah:
--   Non Sugar / Less Sugar / Sugar
--   Ice / Hot
--
-- Menu MAKANAN tidak disentuh: kategori `is_drink = false` tetap `[]`.
--
-- ⚠️ Jalankan SETELAH 20261016-category-groups.sql (butuh kolom categories.is_drink).

begin;

-- Simpan dulu nilai lama supaya bisa dikembalikan oleh file rollback.
create table if not exists backup_menu_options_20261017 as
select id, customization_options from menu_items;

update menu_items m
set customization_options = jsonb_build_array(
      jsonb_build_object(
        'name', 'Gula',
        'options', jsonb_build_array(
          jsonb_build_object('label', 'Non Sugar',  'price_delta', 0),
          jsonb_build_object('label', 'Less Sugar', 'price_delta', 0),
          jsonb_build_object('label', 'Sugar',      'price_delta', 0)
        )
      ),
      jsonb_build_object(
        'name', 'Suhu',
        'options', jsonb_build_array(
          jsonb_build_object('label', 'Ice', 'price_delta', 0),
          jsonb_build_object('label', 'Hot', 'price_delta', 0)
        )
      )
    )
where exists (
  select 1
  from categories c
  join menu_items mi on mi.category_id = c.id
  where mi.id = m.id
    and c.is_drink = true
);

commit;

-- Cek hasil: menu minuman harus punya 2 grup, makanan harus 0 grup.
select
  c.name                                    as kategori,
  c.is_drink,
  jsonb_array_length(m.customization_options) as jumlah_grup
from menu_items m
join categories c on c.id = m.category_id
order by c.is_drink desc, c.name, m.name;