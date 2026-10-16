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

  // Ada DUA halaman login: /login (owner) dan /login/kasir (kasir).
  // Plus /daftar untuk pendaftaran karyawan baru.
  const isOwnerLoginRoute = pathname === "/login";
  const isKasirLoginRoute = pathname === "/login/kasir";
  const isDaftarRoute = pathname === "/daftar";
  const isLoginRoute = isOwnerLoginRoute || isKasirLoginRoute || isDaftarRoute;

  // 1) Belum login tapi coba akses /admin/* -> tendang ke halaman login
  //    yang paling sesuai: kasir ke /admin/kasir, owner ke /admin/owner.
  //    Default-nya /login/kasir karena sebagian besar staff adalah kasir.
  if (isAdminRoute && !user) {
    const target =
      pathname.startsWith("/admin/owner") || pathname === "/login"
        ? "/login"
        : "/login/kasir";
    const redirectUrl = new URL(target, request.url);
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

    /*
      Sudah login tapi masih buka halaman login / pendaftaran -> lempar ke
      dashboard sesuai role. Halaman login kasirpun begitu, supaya kasir yang
      klik link "Daftar" tapi sebenarnya sudah punya sesi tidak terjebak di
      halaman daftar.
    */
    if (isLoginRoute) {
      const target = profile.role === "owner" ? "/admin/owner" : "/admin/kasir";
      return NextResponse.redirect(new URL(target, request.url));
    }

    // Cegah kasir mengakses area khusus owner, dan sebaliknya.
    // Semua /admin/owner/* hanya untuk owner (termasuk /admin/owner/karyawan).
    if (pathname.startsWith("/admin/owner") && profile.role !== "owner") {
      return NextResponse.redirect(new URL("/admin/kasir", request.url));
    }

    // Kasir DAN owner boleh buka /admin/kasir — owner sering perlu melihat
    // tampilan kasir untuk memastikan alurnya benar.
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
