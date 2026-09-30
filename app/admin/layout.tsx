import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { IdleWarning } from "@/components/idle-warning";
import { getNotificationsForRequest } from "@/lib/notifications";
import type { NotificationsData } from "@/lib/tasks";

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
    ? await supabase.from("profiles").select("role, full_name").eq("id", user.id).single()
    : { data: null };

  // Notifications calculées à la volée au chargement du layout (source serveur).
  let notifications: NotificationsData | null = null;
  // Pastille « à traiter » de l'entrée Réservations : dossiers en attente.
  let pending = 0;
  if (user) {
    try {
      notifications = await getNotificationsForRequest(user.id, (profile as any)?.role ?? null);
    } catch (e) {
      console.error("[layout] centre d'actions :", e);
      notifications = null;
    }
    const { count } = await supabase.from("reservations").select("id", { count: "exact", head: true }).eq("status", "pending");
    pending = count ?? 0;
  }

  return (
    <>
      <AdminShell
        user={{ email: user?.email ?? "", name: (profile as any)?.full_name ?? null, role: (profile as any)?.role ?? "admin" }}
        counts={{ pending }}
        notifications={notifications}
      >
        {children}
      </AdminShell>
      <IdleWarning />
    </>
  );
}
