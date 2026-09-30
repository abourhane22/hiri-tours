"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeNotifications } from "@/lib/notifications";
import { tomorrowAt8 } from "@/lib/tz";
import type { NotificationsData } from "@/lib/tasks";

const STAFF_ROLES = ["admin", "commercial", "comptable"];
// Clé de tâche : `règle:reservation_id` (lib/notifications.ts).
const TASK_KEY = /^[a-z0-9-]+:[0-9a-f-]{36}$/;

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { supabase, user, role: (profile as { role?: string } | null)?.role ?? null };
}

/** Recalcule tâches et informations de l'utilisateur courant (ouverture du panneau). */
export async function fetchNotifications(): Promise<NotificationsData | null> {
  const s = await session();
  if (!s) return null;
  return computeNotifications(s.supabase, s.user.id, { role: s.role });
}

/** Informations uniquement : les tâches n'ont pas d'état « lu ». */
export async function markInfosRead(keys: string[]): Promise<void> {
  const unique = Array.from(new Set(keys.filter((k) => k && !TASK_KEY.test(k))));
  if (unique.length === 0) return;
  const s = await session();
  if (!s) return;
  const rows = unique.map((k) => ({ user_id: s.user.id, notification_key: k }));
  await s.supabase.from("notification_reads").upsert(rows, { onConflict: "user_id,notification_key", ignoreDuplicates: true });
}

export type SnoozeResult = { ok: true; until: string } | { ok: false; error: string };

/** « Plus tard » : reporte la tâche pour MOI jusqu'à demain 08:00 (Casablanca). */
export async function snoozeTask(key: string): Promise<SnoozeResult> {
  if (!TASK_KEY.test(key)) return { ok: false, error: "Tâche invalide." };
  const s = await session();
  if (!s) return { ok: false, error: "Session expirée — reconnectez-vous." };
  const until = tomorrowAt8().toISOString();
  const { error } = await s.supabase
    .from("task_snoozes")
    .upsert({ user_id: s.user.id, task_key: key, snoozed_until: until }, { onConflict: "user_id,task_key" });
  if (error) {
    console.error("[snoozeTask]", error);
    return { ok: false, error: "Report impossible." };
  }
  // Ménage de mes reports échus (la table ne grossit pas indéfiniment).
  await s.supabase.from("task_snoozes").delete().eq("user_id", s.user.id).lt("snoozed_until", new Date().toISOString());
  revalidatePath("/admin/actions");
  return { ok: true, until };
}

/** Annuler le report (toast « Annuler »). */
export async function unsnoozeTask(key: string): Promise<{ ok: boolean }> {
  if (!TASK_KEY.test(key)) return { ok: false };
  const s = await session();
  if (!s) return { ok: false };
  const { error } = await s.supabase.from("task_snoozes").delete().eq("user_id", s.user.id).eq("task_key", key);
  revalidatePath("/admin/actions");
  return { ok: !error };
}

export type AssignResult = { ok: true } | { ok: false; error: string };

/** Assigne la tâche à un membre ACTIF du staff (admin, commercial, comptable) — ou la désassigne (null). */
export async function assignTask(key: string, assigneeId: string | null): Promise<AssignResult> {
  if (!TASK_KEY.test(key)) return { ok: false, error: "Tâche invalide." };
  const s = await session();
  if (!s) return { ok: false, error: "Session expirée — reconnectez-vous." };
  if (!s.role || !STAFF_ROLES.includes(s.role)) return { ok: false, error: "Action réservée à l'équipe." };

  if (assigneeId === null) {
    const { error } = await s.supabase.from("task_assignments").delete().eq("task_key", key);
    if (error) return { ok: false, error: "Désassignation impossible." };
  } else {
    const { data: target } = await s.supabase.from("profiles").select("id, role, is_active").eq("id", assigneeId).maybeSingle();
    const t = target as { role: string; is_active: boolean | null } | null;
    if (!t || !STAFF_ROLES.includes(t.role) || t.is_active === false) return { ok: false, error: "Ce membre ne peut pas recevoir de tâche." };
    const { error } = await s.supabase
      .from("task_assignments")
      .upsert({ task_key: key, assignee_id: assigneeId, assigned_by: s.user.id, assigned_at: new Date().toISOString() }, { onConflict: "task_key" });
    if (error) {
      console.error("[assignTask]", error);
      return { ok: false, error: "Assignation impossible." };
    }
  }
  revalidatePath("/admin/actions");
  return { ok: true };
}
