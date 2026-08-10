import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "@/components/admin-header";
import { IdleWarning } from "@/components/idle-warning";
import { computeNotifications, type AppNotification } from "@/lib/notifications";

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

  // Notifications calculées à la volée au chargement du layout (source serveur).
  let notifications: AppNotification[] = [];
  if (user) {
    try {
      notifications = await computeNotifications(supabase, user.id);
    } catch {
      notifications = [];
    }
  }

  return (
    <div className="bg-sand-50 min-h-screen">
      <AdminHeader
        userEmail={user?.email}
        userRole={profile?.role ?? undefined}
        notifications={notifications}
      />
      <main>{children}</main>
      <IdleWarning />
    </div>
  );
}
