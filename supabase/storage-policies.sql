-- =========================================================
-- SUPABASE STORAGE — bucket `menu-images`
-- Buat bucket dulu lewat Dashboard atau SQL berikut:
-- =========================================================

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- Siapa saja boleh membaca (foto menu tampil publik di katalog)
create policy "menu_images_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-images');

-- Hanya user dengan role 'owner' yang boleh upload/update/hapus foto menu
create policy "menu_images_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'menu-images'
    and public.is_owner()
  );

create policy "menu_images_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'menu-images'
    and public.is_owner()
  );

create policy "menu_images_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'menu-images'
    and public.is_owner()
  );
