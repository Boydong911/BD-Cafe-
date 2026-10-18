-- =========================================================
-- CEK KILAT: apakah akun kasir punya baris di auth.identities
--
-- Jalankan di Supabase SQL Editor (role postgres).
-- Hanya SELECT, tidak mengubah apa pun.
--
-- Cara baca hasil:
--
--   jumlah_identity = 0
--       Dugaan terkonfirmasi. GoTrue tidak pernah diberi identitas untuk
--       akun ini, jadi tidak bisa memverifikasi password-nya. Penyebab
--       "Username atau password salah" ditemukan.
--
--   jumlah_identity = 1
--       Dugaan saya salah. Identitas sudah ada, jadi masalahnya di tempat
--       lain. Fokus ke isi_identitas.
--
--   isi_identitas
--       Bentuk baris milik akun yang SUDAH bisa login, yaitu akun owner.
--       Nilainya akan disalin mentah saat menulis perbaikannya, supaya
--       tidak mengarang nilai untuk tabel milik GoTrue.
--
-- Catatan: akun owner seharusnya punya jumlah_identity = 1. Kalau akun
-- owner juga 0, berarti masalahnya ada di sisi owner, bukan di akun
-- kasir yang baru didaftarkan.
-- =========================================================

select
  u.email                                          as email,
  p.username                                       as username,
  p.role                                           as role,
  (select count(*)
     from auth.identities i
    where i.user_id = u.id)                        as jumlah_identity,
  to_jsonb(i)                                      as isi_identitas
from auth.users u
left join public.profiles p on p.id = u.id
left join auth.identities i on i.user_id = u.id
where u.email like '%@cafe.internal'
order by u.created_at;