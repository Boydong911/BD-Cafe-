// File: components/admin/outlet-picker.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Pemilih outlet untuk halaman yang dikelola per outlet
 * (Menu / Meja / Karyawan / Penjualan / Riwayat). Pilihan dipasang di URL
 * supaya bisa di-bookmark dan tetap terpilih saat refresh.
 *
 * Dua cara navigasi:
 * - Default: `?outlet=<slug>` di halaman yang sama (parameter URL lain tetap
 *   dipertahankan, mis. rentang & granularitas laporan).
 * - `hrefBase`: pindah halaman `<hrefBase>/<value>` — dipakai halaman yang
 *   menyimpan scope di PATH (Riwayat Transaksi: /.../semua, /.../outlet-a).
 *
 * `allowSemua` menambah pilihan "Semua Outlet".
 */
export function OutletPicker({
  outlets,
  currentSlug,
  allowSemua = false,
  hrefBase,
}: {
  outlets: { slug: string; nama: string; is_pusat: boolean; is_active: boolean }[];
  currentSlug: string;
  allowSemua?: boolean;
  hrefBase?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(nextValue: string) {
    if (hrefBase) {
      router.replace(`${hrefBase}/${nextValue}`, { scroll: false });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("outlet", nextValue);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground sm:inline">
        Outlet:
      </span>
      <Select value={currentSlug} onValueChange={handleChange}>
        <SelectTrigger className="h-9 w-full sm:w-56">
          <SelectValue placeholder="Pilih outlet" />
        </SelectTrigger>
        <SelectContent>
          {allowSemua && <SelectItem value="semua">Semua Outlet</SelectItem>}
          {outlets.map((outlet) => (
            <SelectItem key={outlet.slug} value={outlet.slug}>
              {outlet.nama}
              {outlet.is_pusat
                ? " \u00b7 pusat"
                : outlet.is_active
                  ? ""
                  : " \u00b7 arsip"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
