import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/customer/checkout-form";
import { fetchOutletBySlug } from "@/lib/outlets";

export const metadata: Metadata = {
  title: "Checkout",
};

/*
 * Checkout ber-outlet: /outlet-a/checkout, /outlet-b/checkout, dst.
 *
 * Slug dari URL adalah sumber outlet pesanan — form mengirimkannya ke
 * server action, yang mencocokkannya lagi dengan tabel outlets sebelum
 * menempelkan outlet_id ke pesanan. Slug tak dikenal tidak sampai ke
 * form; halaman ini langsung 404 supaya tidak ada checkout yang jatuh
 * ke outlet salah.
 */
export default async function OutletCheckoutPage({
  params,
}: {
  params: Promise<{ outlet: string }>;
}) {
  const { outlet: slug } = await params;
  const outlet = await fetchOutletBySlug((slug ?? "").toLowerCase());

  if (!outlet || outlet.is_active === false) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <Suspense fallback={null}>
        <CheckoutForm outletSlug={outlet.slug} />
      </Suspense>
    </div>
  );
}
