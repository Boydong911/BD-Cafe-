import type { Metadata } from "next";
import DaftarForm from "./daftar-form";

export const metadata: Metadata = {
  title: "Daftar",
};

/*
 * Halaman ini dulu "use client" dan tidak bisa export metadata -- Next.js
 * melarang export metadata dari Client Component. Isinya dipindah ke
 * daftar-form.tsx supaya halaman ini bisa jadi Server Component dan
 * judul tab terisi di HTML, bukan hanya lewat JavaScript.
 */
export default function DaftarPage() {
  return <DaftarForm />;
}