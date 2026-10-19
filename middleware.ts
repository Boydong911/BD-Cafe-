import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import type { Seat } from "@/lib/supabase/seats";

/*
 * Pemilihan SEAT sesi untuk request ini (lihat lib/supabase/seats.ts):
 *
 *   /admin/owner/*, /login          -> owner  (cookie sesi "owner")
 *   /admin/kasir/*, /login/kasir, /daftar -> kasir (cookie sesi "kasir")
 *   sisanya (halaman pelanggan)     -> owner (default; halaman ini tidak
 *   bergantung pada sesi, cookie hanya dibaca, tidak diubah kecuali refresh)
 *
 * Dengan pemecahan ini login/logout di dashboard owner tidak menyentuh
 * sesi di halaman kasir, dan sebaliknya.
 */
function seatForPath(pathname: string): Seat {
  if (pathname === "/login") return "owner";
  if (pathname === "/login/kasir") return "kasir";
  if (pathname === "/daftar") return "kasir";
  if (pathname.startsWith("/admin/owner")) return "owner";
  if (pathname.startsWith("/admin/kasir")) return "kasir";
  return "owner";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, response } = createMiddlewareClient(request, seatForPath(pathname));

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

    // User terautentikasi tapi bukan staff (tidak punya profile) -> tolak akses admin.
    // signOut LOCAL, bukan global: 'global' mencabut SEMUA refresh token milik
    // user itu di semua seat/perangkat, sedangkan yang ingin dibersihkan di
    // sini hanya sesi yang tampak di seat ini.
    if (!profile) {
      if (isAdminRoute) {
        await supabase.auth.signOut({ scope: "local" });
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
