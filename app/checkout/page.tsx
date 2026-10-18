import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckoutForm } from "@/components/customer/checkout-form";
import { hasStaffSession } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage() {
  // Kasir yang memesan lewat tab "Pesan Menu" tidak punya meja dan tidak
  // perlu ke katalog. Tombol "Batal"-nya langsung balik ke board.
  const staff = await hasStaffSession();

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <Suspense fallback={null}>
        <CheckoutForm staff={staff} />
      </Suspense>
    </div>
  );
}