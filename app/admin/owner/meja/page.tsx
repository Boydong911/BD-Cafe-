// File: app/admin/owner/meja/page.tsx
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TableManager } from "@/components/admin/table-manager";

export const metadata: Metadata = {
  title: "Kelola Meja",
};

export default async function MejaPage() {
  const supabase = await createClient();
  const { data: tables } = await supabase
    .from("tables")
    .select("*")
    .order("table_number", { ascending: true });

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Manajemen Meja</h1>
      <p className="text-muted-foreground mb-6">
        Kelola nomor meja & generate QR Code untuk tiap meja.
      </p>
      <TableManager initialTables={tables ?? []} />
    </div>
  );
}