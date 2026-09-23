import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

/**
 * Dipakai di Server Component, Server Action, dan Route Handler.
 * Wajib dipanggil ulang di setiap request (bukan singleton) karena
 * bergantung pada cookies() request yang sedang berjalan.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as CookieOptions)
            );
          } catch {
            // Bisa diabaikan jika dipanggil dari Server Component (read-only).
            // Middleware yang akan meng-handle refresh session di kasus ini.
          }
        },
      },
    }
  );
}
