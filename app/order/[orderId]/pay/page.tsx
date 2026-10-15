import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PaymentPanel } from "./payment-panel";
import { getPaymentState } from "../actions";

export const revalidate = 0;

type PayRow = {
  id: string;
  order_number: string | null;
  customer_name: string;
  order_type: string;
  table_number: string | null;
  payment_method: "qris" | "cash";
  payment_status: "pending" | "paid";
  status: string;
  total: number | string;
  created_at: string;
};

export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, order_type, table_number, payment_method, payment_status, status, total, created_at"
    )
    .eq("id", orderId)
    .single();

  if (!data) notFound();

  const order = data as unknown as PayRow;

  // Kalau sudah dibayar / dibatalkan, langsung arahkan ke halaman antrean
  if (order.payment_status === "paid" || order.status === "cancelled") {
    return <PaymentPanel orderId={order.id} state="redirect" />;
  }

  // Kalau lewat batas waktu, batalkan sekalian
  const { expired } = await getPaymentState(orderId);

  return (
    <PaymentPanel
      orderId={order.id}
      state={expired ? "expired" : "waiting"}
      method={order.payment_method}
      total={Number(order.total)}
      customerName={order.customer_name}
      tableNumber={order.table_number}
      orderType={order.order_type}
      createdAt={order.created_at}
    />
  );
}
