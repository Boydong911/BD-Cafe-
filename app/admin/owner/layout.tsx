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
    <div className="fixed inset-0 flex overflow-hidden bg-muted/30">
      <OwnerSidebar ownerName={ownerName} />
      <main className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10">
        {children}
      </main>
    </div>
  );
}