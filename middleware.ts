import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, response } = createMiddlewareClient(request);

  // Wajib dipanggil supaya session ter-refresh (jangan dihapus).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginRoute = pathname === "/login";

  // 1) Belum login tapi coba akses /admin/* -> tendang ke /login
  if (isAdminRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 2) Sudah login (staff) -> ambil role untuk validasi & redirect yang tepat
  if (user && (isAdminRoute || isLoginRoute)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // User terautentikasi tapi bukan staff (tidak punya profile) -> tolak akses admin
    if (!profile) {
      if (isAdminRoute) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/login", request.url));
      }
      return response;
    }

    // Sudah login & buka /login lagi -> lempar ke dashboard sesuai role
    if (isLoginRoute) {
      const target = profile.role === "owner" ? "/admin/owner" : "/admin/kasir";
      return NextResponse.redirect(new URL(target, request.url));
    }

    // Cegah kasir mengakses area khusus owner, dan sebaliknya
    if (pathname.startsWith("/admin/owner") && profile.role !== "owner") {
      return NextResponse.redirect(new URL("/admin/kasir", request.url));
    }
    if (pathname.startsWith("/admin/kasir") && profile.role !== "kasir" && profile.role !== "owner") {
      return NextResponse.redirect(new URL("/admin/owner", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Jalankan middleware di semua path KECUALI asset statis,
     * supaya efisien. Sesuaikan jika ada folder public lain.
     */
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
