import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckoutForm } from "@/components/customer/checkout-form";

export const metadata: Metadata = {
  title: "Checkout",
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <Suspense fallback={null}>
        <CheckoutForm />
      </Suspense>
    </div>
  );
}