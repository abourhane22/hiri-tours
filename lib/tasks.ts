// Centre d'actions — modèle partagé (client-safe) entre la cloche, la page
// /admin/actions et le calcul serveur (lib/notifications.ts).
//
// Deux natures :
//  - TÂCHE : action requise. Ne disparaît QUE quand sa cause est résolue (jamais
//    parce qu'on l'a lue). Reportable (« Plus tard », par utilisateur) et
//    assignable (commune à l'équipe).
//  - INFORMATION : se marque comme lue, ne compte jamais dans la pastille.

import { addDays, agencyDate, agencyInstant, agencyTime, daysFromToday, weekdayShort } from "@/lib/tz";

export type TaskFamily = "logistique" | "paiements" | "reservations" | "stock";
export type TaskPriority = "overdue" | "urgent" | "today" | "week";
export type TaskRule = "logistique-j2" | "solde-j7" | "lien-expire" | "confirmer" | "hors-allotement" | "voyageurs-j3" | "vol-arrivee-j5";

export type Task = {
  /** Clé stable `règle:reservation_id` — report, assignation et journal s'y rattachent. */
  key: string;
  rule: TaskRule;
  family: TaskFamily;
  /** Verbe d'action : « Relancer le solde de 1 540 MAD ». */
  title: string;
  /** Complément (centre d'actions). */
  detail: string | null;
  reservationId: string;
  reference: string | null;
  product: string | null;
  pax: number | null;
  client: string | null;
  /** Échéance (instant ISO) — base du tri et de la priorité. */
  dueAt: string;
  /** Échéance en clair : « Départ jeudi 24/09 · J-2 », « Expiré hier 14:20 ». */
  dueLabel: string;
  priority: TaskPriority;
  group: "today" | "week";
  /** Bouton primaire : le verbe, et le lien direct (ancre de la fiche). */
  action: { label: string; href: string };
  /** Report de l'utilisateur COURANT (null = non reportée). */
  snoozedUntil: string | null;
  assignee: { id: string; name: string } | null;
};

export type InfoKind = "departures" | "payment" | "stock";

export type InfoItem = {
  key: string;
  kind: InfoKind;
  title: string;
  description: string;
  href: string;
  hrefLabel?: string;
  at: string;
  read: boolean;
  /** Départs de demain : une ligne par dossier (agrégat dépliable). */
  lines?: { label: string; detail: string; href: string }[];
};

export type NotificationsData = {
  userId: string;
  tasks: Task[];
  infos: InfoItem[];
  computedAt: string;
};

export const PRIORITY_RANK: Record<TaskPriority, number> = { overdue: 0, urgent: 1, today: 2, week: 3 };

/**
 * Priorités distinguables AUSSI en luminosité (sombre → clair), contrastes AA :
 * blanc sur #791F1F ≈ 9:1 ; blanc sur #C84B31 ≈ 5:1 ; #7A4B00 sur #FAEEDA ≈ 7:1 ;
 * #58524A sur #F1EFE8 ≈ 7:1.
 */
export const PRIORITY_META: Record<TaskPriority, { label: string; bg: string; color: string }> = {
  overdue: { label: "En retard", bg: "#791F1F", color: "#FFFFFF" },
  urgent: { label: "Urgent", bg: "#C84B31", color: "#FFFFFF" },
  today: { label: "Aujourd'hui", bg: "#FAEEDA", color: "#7A4B00" },
  week: { label: "Cette semaine", bg: "#F1EFE8", color: "#58524A" },
};

export const FAMILY_META: Record<TaskFamily, { label: string; tint: string; color: string }> = {
  logistique: { label: "Logistique", tint: "#E3F0F4", color: "#0C6B8A" },
  paiements: { label: "Paiements", tint: "#FAEEDA", color: "#8A5200" },
  reservations: { label: "Réservations", tint: "#ECEBEF", color: "#1A1F2E" },
  stock: { label: "Stock", tint: "#FBEBE6", color: "#A33A24" },
};

export const FAMILIES: TaskFamily[] = ["logistique", "paiements", "reservations", "stock"];

/**
 * Priorité d'échéance : En retard (échéance dépassée) · Urgent (départ aujourd'hui
 * ou J-2 et moins) · Aujourd'hui (échéance dans la journée) · Cette semaine.
 */
export function taskPriority(dueAt: Date, departureDate: string | null, now: number): TaskPriority {
  if (dueAt.getTime() < now) return "overdue";
  if (departureDate) {
    const d = daysFromToday(departureDate, now);
    if (d <= 2) return "urgent";
  }
  if (agencyDate(dueAt) === agencyDate(now)) return "today";
  return "week";
}

export const priorityGroup = (p: TaskPriority): "today" | "week" => (p === "week" ? "week" : "today");

/** Fin de journée (23:59, Casablanca) d'un jour civil — échéance « avant le départ ». */
export function endOfAgencyDay(ymd: string): Date {
  return new Date(agencyInstant(addDays(ymd, 1), 0, 0).getTime() - 60_000);
}

/** « Départ aujourd'hui » · « Départ demain · J-1 » · « Départ jeudi 24/09 · J-2 ». */
export function departureLabel(ymd: string, now: number): string {
  const d = daysFromToday(ymd, now);
  if (d === 0) return "Départ aujourd'hui";
  if (d === 1) return "Départ demain · J-1";
  return `Départ ${weekdayShort(ymd)} · J-${d}`;
}

/** « Expiré aujourd'hui 14:20 » · « Expiré hier 14:20 » · « Expiré le 22/09 14:20 ». */
export function expiredLabel(iso: string, now: number): string {
  const d = -daysFromToday(agencyDate(iso), now);
  const t = agencyTime(iso);
  if (d <= 0) return `Expiré aujourd'hui ${t}`;
  if (d === 1) return `Expiré hier ${t}`;
  const ymd = agencyDate(iso);
  return `Expiré le ${ymd.slice(8, 10)}/${ymd.slice(5, 7)} ${t}`;
}

/** « avant aujourd'hui 14:20 » · « avant demain 09:00 » · « avant le 02/10 09:00 ». */
export function beforeLabel(iso: string, now: number): string {
  const d = daysFromToday(agencyDate(iso), now);
  const t = agencyTime(iso);
  if (d === 0) return `avant aujourd'hui ${t}`;
  if (d === 1) return `avant demain ${t}`;
  const ymd = agencyDate(iso);
  return `avant le ${ymd.slice(8, 10)}/${ymd.slice(5, 7)} ${t}`;
}

/** « depuis 3 h » · « depuis 2 j ». */
export function sinceLabel(iso: string, now: number): string {
  const h = Math.max(1, Math.floor((now - Date.parse(iso)) / 3_600_000));
  return h < 48 ? `depuis ${h} h` : `depuis ${Math.floor(h / 24)} j`;
}

/** « véhicule, chauffeur et guide ». */
export function joinFr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

/** Une tâche compte pour MOI : non reportée par moi, et non assignée ou assignée à moi. */
export function isMine(t: Task, userId: string, now: number = Date.now()): boolean {
  const snoozed = t.snoozedUntil !== null && Date.parse(t.snoozedUntil) > now;
  return !snoozed && (!t.assignee || t.assignee.id === userId);
}

/** Pastille de la cloche : tâches ouvertes non reportées, non assignées ou assignées à moi. Rien d'autre. */
export function badgeCount(data: Pick<NotificationsData, "tasks" | "userId">, now: number = Date.now()): number {
  return data.tasks.filter((t) => isMine(t, data.userId, now)).length;
}

export const isUrgent = (t: Task) => t.priority === "overdue" || t.priority === "urgent";
