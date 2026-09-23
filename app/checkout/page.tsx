import { Suspense } from "react";
import { CheckoutForm } from "@/components/customer/checkout-form";

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <Suspense fallback={null}>
        <CheckoutForm />
      </Suspense>
    </div>
  );
}