"use server";

import { createClient } from "@/lib/supabase/server";
import { computeNotifications, type AppNotification } from "@/lib/notifications";

/** Recalcule les notifications de l'utilisateur courant (à l'ouverture du panneau). */
export async function fetchNotifications(): Promise<AppNotification[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return computeNotifications(supabase, user.id);
}

/** Marque des notifications comme lues pour l'utilisateur courant (RLS auth.uid()). */
export async function markNotificationsRead(keys: string[]): Promise<void> {
  const unique = Array.from(new Set(keys.filter(Boolean)));
  if (unique.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const rows = unique.map((k) => ({ user_id: user.id, notification_key: k }));
  await supabase
    .from("notification_reads")
    .upsert(rows, { onConflict: "user_id,notification_key", ignoreDuplicates: true });
}
