import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchOutletBySlug } from "@/lib/outlets";
import KasirLoginForm from "./kasir-login-form";

export const metadata: Metadata = {
  title: "Login Kasir",
};

/*
 * Dulu "use client" dan tidak bisa export metadata. Isinya dipindah ke
 * kasir-login-form.tsx supaya file ini bisa jadi Server Component.
 *
 * Kini pintu ini per outlet: /outlet-a/login/kasir, /outlet-b/login/kasir.
 * URL lama /login/kasir otomatis dilompatkan middleware ke outlet pusat.
 *
 * Slug tidak dikenal -> 404, senada dengan board kasir: jangan sampai
 * muncul pintu login untuk outlet yang tidak pernah ada.
 */
export default async function OutletKasirLoginPage({
  params,
  searchParams,
}: {
  /** Next 15: params & searchParams berupa Promise di Server Component. */
  params: Promise<{ outlet: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ outlet: slug }, { notice }] = await Promise.all([params, searchParams]);

  const outlet = await fetchOutletBySlug((slug ?? "").toLowerCase());
  if (!outlet) notFound();

  /*
   * `notice` dioper sebagai KODE dari app/login/actions.ts (server action
   * login owner memindahkan akun kasir ke sini). Teks diambil dari daftar
   * ini — bukan ditampilkan mentah dari URL — supaya siapa pun yang menulis
   * ?notice=apa-saja tidak bisa memajang kata-kata sendiri di halaman login.
   */
  const TANDA: Record<string, string> = {
    "bukan-owner": "Anda bukan Owner, Silahkan segera tutup halaman ini",
    /*
     * Gerbang penugasan (ketat): kasir outlet lain mencoba login di pintu
     * ini — sesinya dilepah dan dia diarahkan ke pintu outlet tugasnya;
     * halaman inilah pindahannya.
     */
    "pintu-lain":
      "Kamu ditugaskan di outlet lain. Gunakan pintu masuk outlet tugasmu.",
  };

  return (
    <KasirLoginForm
      notice={TANDA[notice ?? ""]}
      outletSlug={(slug ?? "").toLowerCase()}
    />
  );
}
