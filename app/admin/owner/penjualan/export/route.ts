import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { fetchOrderList, type OrderListRow } from "@/lib/order-list";
import { fetchOutlets, resolveOutletScope } from "@/lib/outlets";
import {
  formatWibDateTime,
  resolveRange,
  parsePreset,
  wibDateKey,
} from "@/lib/format";

export const dynamic = "force-dynamic"; // selalu data terbaru

/**
 * Unduh CSV laporan transaksi — mahkluitnya dibuka di Excel.
 *
 * Route ini dijaga middleware (jalur /admin/owner hanya owner) — tapi di
 * dalam juga dicek ulang di sini: sesi kosong -> 401, bukan owner -> 403.
 *
 * Parameter (kue URL yang sama dengan halaman Penjualan):
 *   ?range=today|7d|30d|90d  -> transaksi pada rentang terpilih
 *   ?range=semua             -> seluruh sejarah (tanpa batas tanggal)
 *   ?outlet=<slug>|semua     -> lingkup outlet
 *   ?format=csv|xlsx         -> csv (default) atau Excel asli .xlsx
 *
 * Format dipilih ramah Excel Indonesia:
 *   - pemisah kolom ; (bukan koma, karena default regional Excel ID
 *     memakai ; — koma justru bikin semua nyempil satu kolom)
 *   - UTF-8 + BOM agar "·" dan nama pelanggan tidak jadi kacuang
 *   - semua sel dibungkus tanda petik supaya koma di rincian menu
 *     tidak dianggap pemisah
 *   - CRLF supaya Excel lama tetap paham barisnya
 *   - (xlsx: Total ditulis sebagai ANGKA sungguhan, langsung bisa
 *     dijumlah di Excel.)
 */

const HEADER = [
  "Tanggal & Jam",
  "Outlet",
  "Kode Order",
  "Nama Pemesan",
  "Total",
  "Tipe",
  "Menu Pesanan",
  "Bayar",
  "Status",
];

/** Bungkus sel: petik-jadi-ganda-petik, lalu bungkus satu pasang petik. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Label kolom Tipe — persis seperti yang tampil di tabel. */
function typeLabel(row: OrderListRow): string {
  return row.order_type === "dine_in"
    ? `Dine In · Meja ${row.table_number ?? "?"}`
    : "Take Away";
}

/** Label kolom Status — mirror StatusBadge di tabel. */
function statusLabel(row: OrderListRow): string {
  if (row.payment_status !== "paid") return "Belum bayar";
  if (row.status === "completed") return "Selesai";
  if (row.status === "cancelled") return "Dibatalkan";
  return "Sudah bayar, diproses";
}

export async function GET(request: NextRequest) {
  // 1) Gerbang: harus sedang bersesi OWNER.
  const supabase = await createClient("owner");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Login dulu ya.", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "owner") {
    return new NextResponse("Khusus owner.", { status: 403 });
  }

  // 2) Baca lingkup dari URL (sama seperti yang dipilih di halaman).
  const sp = request.nextUrl.searchParams;
  const rawRange = sp.get("range");
  const allTime = rawRange === "semua";
  const preset = allTime ? "30d" : parsePreset(rawRange, "30d");
  const range = allTime ? null : resolveRange(preset);

  const outlets = await fetchOutlets();
  const scope = resolveOutletScope(outlets, sp.get("outlet"));

  // 3) Ambil seluruh transaksi lingkup itu (bukan cuma 25 per halaman).
  const rows = await fetchOrderList(
    allTime ? null : range!.start,
    allTime ? null : range!.end,
    scope.outlet_id
  );

  // 4) Rakit file — CSV (terbuka di Excel apa pun) atau .xlsx asli.
  const stamp = wibDateKey(new Date());
  const rangeTag = allTime ? "semua" : preset;

  if (sp.get("format") === "xlsx") {
    /*
     * Sheet "Transaksi": kolom sama dengan CSV. Bedanya Total ditulis
     * sebagai ANGKA sungguhan (bukan teks) — langsung bisa di-SUM.
     */
    const aoa: (string | number)[][] = [
      HEADER,
      ...rows.map((row) => [
        formatWibDateTime(row.created_at),
        row.outletName,
        row.order_number ?? "—",
        row.customer_name,
        row.total,
        typeLabel(row),
        row.itemsSummary || "—",
        row.payment_method === "qris" ? "QRIS" : "Cash",
        statusLabel(row),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Lebar kolom manual, biar tabelnya enak dilihat saat dibuka.
    ws["!cols"] = [20, 16, 14, 18, 12, 20, 42, 8, 22].map((wch) => ({ wch }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transaksi");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(new Uint8Array(buf as Buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="penjualan-${scope.slug}-${rangeTag}-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const lines: string[] = [HEADER.map(csvCell).join(";")];
  for (const row of rows) {
    lines.push(
      [
        formatWibDateTime(row.created_at),
        row.outletName,
        row.order_number ?? "—",
        row.customer_name,
        String(row.total), // angka polos, biar Excel bisa dihitung
        typeLabel(row),
        row.itemsSummary || "—",
        row.payment_method === "qris" ? "QRIS" : "Cash",
        statusLabel(row),
      ]
        .map(csvCell)
        .join(";")
    );
  }

  const csv = `\uFEFF${lines.join("\r\n")}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="penjualan-${scope.slug}-${rangeTag}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
