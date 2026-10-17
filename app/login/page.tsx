import type { Metadata } from "next";
import OwnerLoginForm from "./owner-login-form";

export const metadata: Metadata = {
  title: "Login Owner",
};

/*
 * Dulu "use client" dan tidak bisa export metadata. Isinya dipindah ke
 * owner-login-form.tsx supaya file ini bisa jadi Server Component.
 */
export default function OwnerLoginPage() {
  return <OwnerLoginForm />;
}