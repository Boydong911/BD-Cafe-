import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OrderStatusRealtime } from "./order-status-realtime";

export const revalidate = 0;

type OrderRow = {
  id: string;
  order_number: string | null;
  customer_name: string;
  order_type: string;
  table_number: string | null;
  payment_method: "qris" | "cash";
  payment_status: "pending" | "paid";
  status: string;
  subtotal: number | string;
  total: number | string;
  created_at: string;
  order_items: {
    id: string;
    quantity: number;
    menu_name: string;
    subtotal: number | string;
    selected_customizations: unknown;
  }[];
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();

  /*
   * Pakai RPC, bukan `.from("orders").select()`.
   *
   * Alasannya: policy RLS select untuk anon sudah dihapus (lihat migrasi
   * 20261017-lock-down-orders-rls.sql) karena `using (true)` berarti siapa
   * saja bisa membaca SELURUH riwayat pesanan. Halaman customer sekarang
   * lewat `get_order_by_id()` yang hanya mengembalikan satu baris kalau
   * UUID-nya benar-benar ada — UUID acak 122-bit tidak bisa ditebak.
   */
  const [{ data: orderData, error: orderError }, { data: itemsData }] =
    await Promise.all([
      supabase.rpc("get_order_by_id", { p_order_id: orderId }),
      supabase.rpc("get_order_items", { p_order_id: orderId }),
    ]);

  if (orderError || !orderData || orderData.length === 0) notFound();

  const items = (itemsData ?? []) as unknown as OrderRow["order_items"];

  const order = {
    ...(orderData[0] as unknown as Omit<OrderRow, "order_items">),
    order_items: items,
  };

  const paid = order.payment_status === "paid";
  const hasQueueNumber = paid && !!order.order_number;

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      {hasQueueNumber ? (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Nomor Antrian
          </p>
          <p className="mt-1 font-serif text-4xl font-bold tracking-tight">
            {order.order_number}
          </p>

          <div className="mt-5 border-t pt-4">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Pesanan Atas Nama
            </p>
            <p className="mt-1 text-2xl font-semibold">{order.customer_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.order_type === "dine_in" ? `Meja ${order.table_number}` : "Takeaway"}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed p-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Nomor Antrian
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-muted-foreground">
            Menunggu pembayaran
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {order.payment_method === "cash"
              ? "Bayar di kasir, lalu kasir mengonfirmasi agar nomor antrean keluar."
              : "Selesaikan pembayaran dulu untuk mendapat nomor antrean."}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={`/order/${order.id}/pay`}>Buka Halaman Pembayaran</Link>
          </Button>
        </div>
      )}

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
              <span>Rp {Number(item.subtotal).toLocaleString("id-ID")}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t pt-3 font-semibold">
          <span>Total</span>
          <span>Rp {Number(order.total).toLocaleString("id-ID")}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pembayaran: {order.payment_method === "qris" ? "QRIS" : "Tunai di Kasir"}
          {order.payment_status === "paid" ? " — LUNAS" : " — belum lunas"}
        </p>
      </div>
    </div>
  );
}
