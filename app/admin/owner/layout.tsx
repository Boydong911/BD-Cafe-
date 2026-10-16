import { OwnerSidebar } from "@/components/admin/owner-sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function OwnerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let ownerName: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .single();

    const profile = data as unknown as {
      full_name: string | null;
      username: string;
    } | null;

    if (profile) {
      ownerName = profile.full_name ?? profile.username;
    }
  }

  return (
    // mobile: halaman ikut scroll normal. `fixed inset-0 + overflow-hidden`
    // (yang dipakai sebelumnya) membekukan scroll di layar kecil, jadi konten
    // panjang tidak bisa digeser pakai jari.
    <div className="flex min-h-dvh flex-col bg-muted/30 lg:flex-row lg:overflow-hidden">
      <OwnerSidebar ownerName={ownerName} />
      <main className="flex-1 p-4 pt-16 sm:p-6 sm:pt-16 lg:overflow-y-auto lg:p-10 lg:pt-10">
        {children}
      </main>
    </div>
  );
}