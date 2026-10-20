import type { Metadata } from "next";
import DaftarForm from "./daftar-form";

export const metadata: Metadata = {
  title: "Daftar",
};

/*
 * Pendaftaran karyawan kini per outlet (mis. /outlet-b/daftar). Slug dari
 * URL diselip ke form sebagai input tersembunyi; server action memvalidasi
 * ulang slug-nya sebelum mengikat akun baru ke outlet itu.
 *
 * URL lama /daftar otomatis dilompatkan middleware ke outlet pusat.
 */
export default async function OutletDaftarPage({
  params,
}: {
  params: Promise<{ outlet: string }>;
}) {
  const { outlet: slug } = await params;
  return <DaftarForm outletSlug={(slug ?? "").toLowerCase()} />;
}
