import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient, hasStaffSession } from "@/lib/supabase/server";
import { PaymentPanel } from "./payment-panel";
import { getPaymentState } from "../actions";

export const revalidate = 0;

/*
 * Judul statis, bukan generateMetadata. Halaman ini sudah memanggil
 * get_order_by_id() dan getPaymentState(); menambah generateMetadata
 * berarti satu panggilan database lagi tanpa manfaat yang sebanding.
 */
export const metadata: Metadata = {
  title: "Pembayaran",
};

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

  // RPC, bukan select langsung — policy RLS select untuk anon sudah dikunci
  // (lihat 20261017-lock-down-orders-rls.sql).
  const { data, error } = await supabase.rpc("get_order_by_id", {
    p_order_id: orderId,
  });

  if (error || !data || data.length === 0) notFound();

  const order = data[0] as unknown as PayRow;

  // Kasir yang memesan lewat tab "Pesan Menu" butuh jalan keluar yang
  // berbeda: "Batal Pembayaran" yang membatalkan sungguhan, bukan sekadar
  // "Kembali ke Menu".
  const staff = await hasStaffSession();

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
      staff={staff}
    />
  );
}
