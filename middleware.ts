import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import type { Seat } from "@/lib/supabase/seats";
import { PUSAT_SLUG, isOutletSlug } from "@/lib/outlet-routes";

/*
 * Pemilihan SEAT sesi untuk request ini (lihat lib/supabase/seats.ts):
 *
 *   /login, /admin/owner/*            -> owner  (cookie sesi "owner")
 *   /login/kasir, /daftar, /admin/kasir/*, {slug}/login/kasir,
 *   {slug}/daftar, {slug}/admin/kasir -> kasir (cookie sesi "kasir")
 *   sisanya (halaman pelanggan)       -> owner (default; halaman ini tidak
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

  // Halaman ber-outlet: /outlet-a/login/kasir, /outlet-a/daftar,
  // /outlet-a/admin/kasir harus membaca seat kasir.
  const prefix = outletPrefix(pathname);
  if (prefix) {
    const rest = pathname.slice(prefix.length + 1);
    if (rest === "/login/kasir" || rest === "/daftar") return "kasir";
    if (rest.startsWith("/admin/kasir")) return "kasir";
  }
  return "owner";
}

/** Slug di segmen pertama path, kalau berbentuk slug outlet yang sah. */
function outletPrefix(pathname: string): string | null {
  const slug = pathname.split("/")[1] ?? "";
  return isOutletSlug(slug) ? slug : null;
}

/**
 * URL LAMA (sebelum multi-outlet) pertama-tama dipetakan ke outlet pusat.
 *
 * Semua QR meja yang sudah tercetak menunjuk `/menu?table=N`, dan link-bookmark
 * lama menunjuk /login/kasir, /daftar, /admin/kasir. Alih-alih membiarkan 404,
 * middleware menuntun mereka ke `/outlet-a/...` (URL baru yang punya banyak
 * outlet). Query string (?table, ?notice, dsb.) tetap dibawa.
 *
 * Hanya jalur LAMA yang dimapping: jalur yang sudah ber-outlet lewat begitu saja
 * dan ditolak 404 kalau slug-nya tak dikenal (di halaman rutenya).
 */
function legacyPusatPath(pathname: string): string | null {
  if (pathname === "/daftar") return `/${PUSAT_SLUG}/daftar`;
  if (pathname === "/login/kasir") return `/${PUSAT_SLUG}/login/kasir`;
  if (pathname === "/menu" || pathname.startsWith("/menu/")) {
    return `/${PUSAT_SLUG}${pathname}`;
  }
  if (pathname === "/admin/kasir" || pathname.startsWith("/admin/kasir/")) {
    return `/${PUSAT_SLUG}${pathname}`;
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0) Jalur lama -> outlet pusat (sebelum apapun, semurah mungkin).
  const mapped = legacyPusatPath(pathname);
  if (mapped) {
    const url = request.nextUrl.clone();
    url.pathname = mapped; // search (?table= dst.) tetap dipertahankan
    return NextResponse.redirect(url);
  }

  const { supabase, response } = createMiddlewareClient(
    request,
    seatForPath(pathname)
  );

  // Wajib dipanggil supaya session ter-refresh (jangan dihapus).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const prefix = outletPrefix(pathname);
  const outletBoardPath = prefix ? `${prefix}/admin/kasir` : null;
  const pathnameKasirBoard =
    pathname.startsWith("/admin/kasir") ||
    (outletBoardPath !== null && pathname === `/${outletBoardPath}`);

  const isAdminRoute = pathname.startsWith("/admin");
  const isRouteAdminish = isAdminRoute || pathnameKasirBoard;

  // Ada DUA halaman login: /login (owner) dan /login/kasir (kasir),
  // kini masing-masing ada versi ber-outlet juga. Plus /daftar untuk
  // pendaftaran karyawan baru.
  const isOwnerLoginRoute = pathname === "/login";
  let isKasirLoginRoute = pathname === "/login/kasir";
  let isDaftarRoute = pathname === "/daftar";
  if (prefix) {
    const rest = pathname.slice(prefix.length + 1);
    if (rest === "/login/kasir") isKasirLoginRoute = true;
    if (rest === "/daftar") isDaftarRoute = true;
  }
  const isLoginRoute = isOwnerLoginRoute || isKasirLoginRoute || isDaftarRoute;

  // 1) Belum login tapi coba akses area staff -> tendang ke halaman login
  //    yang paling sesuai: kasir ke login kasir, owner ke /login.
  //    Default-nya kasir karena sebagian besar staff adalah kasir.
  if (isRouteAdminish && !user) {
    let target: string;
    if (pathname.startsWith("/admin/owner")) {
      target = "/login";
    } else if (prefix && pathnameKasirBoard) {
      target = `/${prefix}/login/kasir`; // board ber-outlet
    } else {
      target = "/login/kasir"; // legacy /admin/kasir sudah dimap di step 0,
      //                            tapi tetap disiapkan sebagai jalan aman.
    }
    const redirectUrl = new URL(target, request.url);
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 2) Sudah login (staff) -> ambil role untuk validasi & redirect yang tepat
  if (user && (isRouteAdminish || isLoginRoute)) {
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
      if (isRouteAdminish) {
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.redirect(new URL("/login", request.url));
      }
      return response;
    }

    /*
      Sudah login tapi masih buka halaman login / pendaftaran -> lempar ke
      dashboard sesuai role. Halaman login kasir pun begitu, supaya kasir yang
      klik link "Daftar" tapi sebenarnya sudah punya sesi tidak terjebak di
      halaman daftar. Target legacy dibalikkan di redirect step 0 ->
      kemudian balik ke outlet pusat, jadi tidak ada loop.
    */
    if (isLoginRoute) {
      const target = profile.role === "owner" ? "/admin/owner" : "/admin/kasir";
      return NextResponse.redirect(new URL(target, request.url));
    }

    // Cegah kasir mengakses area khusus owner, dan sebaliknya.
    // Semua /admin/owner/* hanya untuk owner.
    if (pathname.startsWith("/admin/owner") && profile.role !== "owner") {
      return NextResponse.redirect(new URL("/admin/kasir", request.url));
    }

    // Kasir DAN owner boleh buka board kasir — owner sering perlu melihat
    // tampilan kasir untuk memastikan alurnya benar.
    if (pathnameKasirBoard && profile.role !== "kasir" && profile.role !== "owner") {
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
