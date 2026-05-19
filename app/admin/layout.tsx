import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "@/components/admin-header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="bg-sand-50 min-h-screen">
      <AdminHeader userEmail={user?.email} />
      <main>{children}</main>
    </div>
  );
}
