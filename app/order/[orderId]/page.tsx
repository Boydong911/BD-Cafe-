import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { OrderStatusRealtime } from "./order-status-realtime";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();

  if (!order) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Pesanan #{order.order_number}</h1>
        <p className="text-sm text-muted-foreground">
          {order.order_type === "dine_in"
            ? `Meja ${order.table_number}`
            : "Takeaway"}{" "}
          · {order.customer_name}
        </p>
      </div>

      {/* Client Component: subscribe ke perubahan status via Supabase Realtime */}
      <OrderStatusRealtime orderId={order.id} initialStatus={order.status} />

      <div className="rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Ringkasan Pesanan</h2>
        <ul className="space-y-2 text-sm">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>
                {item.quantity}x {item.menu_name}
              </span>
              <span>Rp {item.subtotal.toLocaleString("id-ID")}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t pt-3 font-semibold">
          <span>Total</span>
          <span>Rp {order.total.toLocaleString("id-ID")}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pembayaran: {order.payment_method === "qris" ? "QRIS" : "Tunai di Kasir"}
        </p>
      </div>
    </div>
  );
}
