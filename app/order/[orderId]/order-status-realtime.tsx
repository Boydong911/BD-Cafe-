"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu Konfirmasi",
  confirmed: "Dikonfirmasi",
  preparing: "Sedang Dibuat",
  ready: "Siap Diambil/Diantar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export function OrderStatusRealtime({
  orderId,
  initialStatus,
}: {
  orderId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setStatus(payload.new.status as string);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return (
    <div className="flex items-center gap-2 rounded-lg border p-4">
      <span className="text-sm text-muted-foreground">Status:</span>
      <Badge variant={status === "cancelled" ? "destructive" : "default"}>
        {STATUS_LABEL[status] ?? status}
      </Badge>
    </div>
  );
}
