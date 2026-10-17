-- Rollback 20261017-drink-sugar-options.sql
--
-- Mengembalikan customization_options ke nilai sebelum migration, dari tabel
-- backup_menu_options_20261017.
--
-- ⚠️ Tabel backup TIDAK dihapus, supaya migrasi ini masih bisa dijalankan
--    dua kali tanpa kehilangan data asal.

begin;

update menu_items m
set customization_options = b.customization_options
from backup_menu_options_20261017 b
where b.id = m.id
  and b.customization_options is distinct from m.customization_options;

commit;