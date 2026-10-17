import type { Metadata } from "next";
import KasirLoginForm from "./kasir-login-form";

export const metadata: Metadata = {
  title: "Login Kasir",
};

/*
 * Dulu "use client" dan tidak bisa export metadata. Isinya dipindah ke
 * kasir-login-form.tsx supaya file ini bisa jadi Server Component.
 */
export default function KasirLoginPage() {
  return <KasirLoginForm />;
}