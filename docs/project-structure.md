# Struktur Folder — Cafe/Restoran App (Next.js App Router)

```
cafe-app/
├── middleware.ts                      # Proteksi route /admin/*
├── .env.local.example
├── package.json
├── components.json                    # config shadcn/ui
├── tailwind.config.ts
│
├── lib/
│   └── supabase/
│       ├── client.ts                  # Supabase client untuk Client Component
│       ├── server.ts                  # Supabase client untuk Server Component/Action
│       └── middleware.ts              # Helper refresh session di middleware
│
├── types/
│   └── database.types.ts              # Tipe hasil `supabase gen types typescript`
│
├── scripts/
│   └── seed-owner.ts                  # Script buat akun owner awal (boy123)
│
├── components/
│   ├── ui/                            # Komponen shadcn (button, input, card, dst)
│   ├── customer/
│   │   ├── hero-section.tsx
│   │   ├── menu-card.tsx
│   │   ├── menu-filter-bar.tsx
│   │   ├── cart-sheet.tsx
│   │   └── order-status-badge.tsx
│   └── admin/
│       ├── admin-sidebar.tsx
│       ├── menu-form.tsx
│       ├── sales-chart.tsx            # Recharts
│       └── stat-card.tsx
│
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                       # Landing page customer (hero, lokasi, galeri)
│   │                                   #   -> baca ?table=05 dari searchParams
│   │
│   ├── menu/
│   │   ├── page.tsx                   # Katalog menu (filter kategori + search)
│   │   └── [id]/
│   │       └── page.tsx               # Detail menu (dynamic route) + kustomisasi
│   │
│   ├── checkout/
│   │   ├── page.tsx                   # Form checkout (nama, meja/takeaway, bayar)
│   │   └── actions.ts                 # Server Action: createOrder()
│   │
│   ├── order/
│   │   └── [orderId]/
│   │       └── page.tsx               # Bukti pesanan + status realtime (Supabase Realtime)
│   │
│   ├── login/
│   │   ├── page.tsx                   # Form login kasir/owner
│   │   └── actions.ts                 # Server Action: loginAction()
│   │
│   └── admin/
│       ├── layout.tsx                 # Guard role + sidebar bersama
│       ├── kasir/
│       │   ├── page.tsx               # List order masuk realtime
│       │   └── actions.ts             # updateOrderStatus()
│       └── owner/
│           ├── page.tsx               # Dashboard analytics (Recharts)
│           ├── menu/
│           │   ├── page.tsx           # Tabel menu
│           │   ├── new/page.tsx       # Form tambah menu
│           │   ├── [id]/edit/page.tsx # Form edit menu
│           │   └── actions.ts         # uploadMenuImage(), createMenuItem(), dst
│           └── laporan/
│               └── page.tsx           # Laporan detail (opsional, pakai RPC report)
│
└── supabase/
    ├── schema.sql                     # Semua tabel, enum, RLS, function
    └── storage-policies.sql           # Policy bucket `menu-images`
```

## Catatan penting alur

1. **Auth pakai username, bukan email.**
   Supabase Auth mewajibkan email/phone untuk sign-in. Karena kredensial yang
   diminta berupa *username* (`boy123`), kita simpan mapping `username -> email`
   di tabel `profiles`, lalu pakai Postgres function `get_login_email(username)`
   (SECURITY DEFINER, bisa dipanggil publik) untuk menerjemahkan username jadi
   email internal (`boy123@cafe.internal`) sebelum memanggil
   `supabase.auth.signInWithPassword()`. Password tetap di-hash oleh Supabase
   Auth (bcrypt) di dalam `auth.users` — tidak pernah kita simpan manual.

2. **Role disimpan di `profiles.role`** (`owner` | `kasir`), diisi manual /
   lewat script seed. Middleware & layout admin membaca role ini untuk
   redirect ke `/admin/owner` atau `/admin/kasir`.

3. **QR Code meja**: landing page (`app/page.tsx`) membaca
   `searchParams.table`, simpan ke state/cookie, lalu dibawa terus sampai ke
   halaman checkout untuk auto-fill nomor meja.

4. **Realtime status pesanan** memakai
   `supabase.channel(...).on('postgres_changes', ...)` pada tabel `orders`,
   dipakai di `/order/[orderId]` (customer) dan `/admin/kasir` (kasir).
