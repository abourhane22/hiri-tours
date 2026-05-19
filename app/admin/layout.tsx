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

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  return (
    <div className="bg-sand-50 min-h-screen">
      <AdminHeader userEmail={user?.email} userRole={profile?.role ?? undefined} />
      <main>{children}</main>
    </div>
  );
}
