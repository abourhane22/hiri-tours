import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { formatMAD } from "@/lib/utils";
import { addDays, agencyDate, daysFromToday, startOfAgencyToday, weekdayShort } from "@/lib/tz";
import { getDossierProfile, travelersStatus } from "@/lib/dossier-profile";
import {
  beforeLabel,
  departureLabel,
  endOfAgencyDay,
  expiredLabel,
  joinFr,
  priorityGroup,
  sinceLabel,
  sortTasks,
  taskPriority,
  type InfoItem,
  type NotificationsData,
  type Task,
  type TaskFamily,
  type TaskRule,
} from "@/lib/tasks";

// Centre d'actions — calcul serveur, À LA VOLÉE (aucune table de notifications).
// Une tâche dont la cause disparaît n'est plus calculée : elle disparaît partout.
// Tables d'état autour des clés stables : task_snoozes (report par utilisateur),
// task_assignments (assignation), task_log (journal → « Résolues aujourd'hui »),
// notification_reads (lu / non lu des INFORMATIONS uniquement).
//
// Un seul calcul par chargement de page du backoffice et par ouverture du
// panneau : toutes les requêtes sont groupées, aucune par item.

const DAY = 86_400_000;
const STAFF_ROLES = ["admin", "commercial", "comptable"];
const HORIZON_DAYS = 14;

type Resa = {
  id: string;
  reference: string;
  status: string;
  circuit_id: string;
  departure_date: string;
  adults: number;
  children: number;
  total_amount_mad: number | string;
  paid_amount_mad: number | string;
  vehicle_id: string | null;
  guide_id: string | null;
  driver_id: string | null;
  intended_payment_channel: string | null;
  arrival_flight_number: string | null;
  created_at: string;
  circuits: { title: string | null; category: string | null; category_fields: Record<string, unknown> | null; identity_documents_required: boolean | null } | null;
  customers: { full_name: string | null } | null;
};

const RESA_SELECT =
  "id, reference, status, circuit_id, departure_date, adults, children, total_amount_mad, paid_amount_mad, vehicle_id, guide_id, driver_id, " +
  "intended_payment_channel, arrival_flight_number, created_at, " +
  "circuits(title, category, category_fields, identity_documents_required), customers(full_name)";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function normalizeResa(r: any): Resa {
  return { ...r, circuits: one(r.circuits), customers: one(r.customers) } as Resa;
}

function paymentLabel(method: string | null, source: string | null): string {
  if (source === "stripe" || method === "stripe") return "Stripe · carte internationale";
  return "Attijari Payment";
}

export async function computeNotifications(
  supabase: SupabaseClient,
  userId: string,
  opts: { role?: string | null } = {},
): Promise<NotificationsData> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const today = agencyDate(now);
  const tomorrow = addDays(today, 1);
  const horizon = addDays(today, HORIZON_DAYS);
  // Le journal n'est tenu que par un calcul COMPLET d'un membre du staff : un calcul
  // partiel (requête en erreur, rôle sans accès aux dossiers) ferait passer pour
  // « résolues » des tâches simplement non vues.
  let complete = true;
  const check = <T,>(res: { data: T | null; error: unknown }, label: string): T | null => {
    if (res.error) {
      complete = false;
      console.error(`[notifications] ${label} :`, res.error);
    }
    return res.data;
  };

  const [resaRes, linksRes, paymentsRes, readsRes, daysRes, snoozeRes, assignRes] = await Promise.all([
    // Départs d'aujourd'hui à J+14, plus TOUS les dossiers en attente (à confirmer, quelle que soit la date).
    supabase
      .from("reservations")
      .select(RESA_SELECT)
      .in("status", ["pending", "confirmed", "paid"])
      .or(`status.eq.pending,and(departure_date.gte.${today},departure_date.lte.${horizon})`),
    supabase
      .from("payment_links")
      .select("id, reservation_id, created_at, expires_at")
      .is("used_at", null)
      .is("revoked_at", null)
      .lt("expires_at", nowIso),
    supabase
      .from("payments")
      .select("id, reservation_id, method, source, amount_mad, paid_at, created_at, reservations(reference)")
      .gte("created_at", new Date(now - 2 * DAY).toISOString()),
    supabase.from("notification_reads").select("notification_key").eq("user_id", userId),
    supabase.from("allotment_days").select("product_id, day, quota, sold").gte("day", today).lte("day", horizon),
    supabase.from("task_snoozes").select("task_key, snoozed_until").eq("user_id", userId).gt("snoozed_until", nowIso),
    supabase.from("task_assignments").select("task_key, assignee_id"),
  ]);

  const resas = ((check(resaRes, "dossiers") ?? []) as any[]).map(normalizeResa);
  const expiredLinks = (check(linksRes, "liens") ?? []) as { id: string; reservation_id: string; created_at: string; expires_at: string }[];
  const recentPayments = (check(paymentsRes, "paiements") ?? []) as any[];
  const readSet = new Set(((check(readsRes, "lus") ?? []) as any[]).map((r) => r.notification_key as string));
  const allotDays = (check(daysRes, "allotements") ?? []) as { product_id: string; day: string; quota: number; sold: number }[];
  const snoozes = new Map(((check(snoozeRes, "reports") ?? []) as any[]).map((s) => [s.task_key as string, s.snoozed_until as string]));
  const assignRows = (check(assignRes, "assignations") ?? []) as { task_key: string; assignee_id: string }[];

  const fiche = (id: string, anchor?: string) => `/admin/reservations/${id}${anchor ? `#${anchor}` : ""}`;
  const tasks: Omit<Task, "snoozedUntil" | "assignee">[] = [];
  const push = (
    r: Resa,
    rule: TaskRule,
    family: TaskFamily,
    title: string,
    detail: string | null,
    dueAt: Date,
    dueLabel: string,
    action: { label: string; href: string },
    departureDate: string | null,
  ) => {
    const priority = taskPriority(dueAt, departureDate, now);
    tasks.push({
      key: `${rule}:${r.id}`,
      rule,
      family,
      title,
      detail,
      reservationId: r.id,
      reference: r.reference,
      product: r.circuits?.title ?? null,
      pax: Number(r.adults) + Number(r.children),
      client: r.customers?.full_name ?? null,
      dueAt: dueAt.toISOString(),
      dueLabel,
      priority,
      group: priorityGroup(priority),
      action,
    });
  };

  const voyageurCandidates: { r: Resa; profile: ReturnType<typeof getDossierProfile> }[] = [];

  for (const r of resas) {
    const dDep = daysFromToday(r.departure_date, now);
    const remaining = Number(r.total_amount_mad) - Number(r.paid_amount_mad);
    const profile = getDossierProfile({ category: r.circuits?.category, identity_documents_required: r.circuits?.identity_documents_required });
    const depEnd = endOfAgencyDay(r.departure_date);

    // Logistique J-2 — dossiers confirmés ET payés ; ressources attendues selon le profil de dossier.
    if ((r.status === "confirmed" || r.status === "paid") && dDep >= 0 && dDep <= 2) {
      const missing: string[] = [];
      if (profile.logistics.vehicle && !r.vehicle_id) missing.push("véhicule");
      if (profile.logistics.driver && !r.driver_id) missing.push("chauffeur");
      if (profile.logistics.guide && !r.guide_id) missing.push("guide");
      if (missing.length > 0) {
        push(r, "logistique-j2", "logistique", `Affecter ${joinFr(missing)}`, `Ressources manquantes pour le départ.`, depEnd, departureLabel(r.departure_date, now), { label: "Affecter", href: fiche(r.id, "logistique") }, r.departure_date);
      }
    }

    // Solde J-7 — reste à payer, départ dans 7 jours ou moins. Échéance : la limite J-7.
    if (remaining > 0.01 && dDep >= 0 && dDep <= 7) {
      const limit = addDays(r.departure_date, -7);
      const dueLabel =
        dDep === 7
          ? "Limite J-7 aujourd'hui"
          : `Limite J-7 dépassée · ${dDep === 0 ? "départ aujourd'hui" : `départ ${weekdayShort(r.departure_date)} · J-${dDep}`}`;
      push(r, "solde-j7", "paiements", `Relancer le solde de ${formatMAD(remaining)}`, `Reste ${formatMAD(remaining)} sur ${formatMAD(Number(r.total_amount_mad))}.`, endOfAgencyDay(limit), dueLabel, { label: "Relancer", href: fiche(r.id, "paiements") }, r.departure_date);
    }

    // Confirmer la réservation — UNE tâche par dossier en attente (fusion resa-web / attente-48h).
    // Réservation web = canal de règlement annoncé par le tunnel public. Échéance : création + 24 h (web) / + 48 h.
    if (r.status === "pending") {
      const web = r.intended_payment_channel != null;
      const due = new Date(Date.parse(r.created_at) + (web ? 1 : 2) * DAY);
      const dueLabel = due.getTime() < now ? `En attente ${sinceLabel(r.created_at, now)}` : `À confirmer ${beforeLabel(due.toISOString(), now)}`;
      push(r, "confirmer", "reservations", web ? "Confirmer la réservation web" : "Confirmer la réservation", `Départ ${weekdayShort(r.departure_date)}.`, due, dueLabel, { label: "Traiter", href: fiche(r.id, "statut") }, r.departure_date >= today ? r.departure_date : null);
    }

    // Voyageurs incomplets J-3 — UNIQUEMENT si le profil exige une pièce d'identité.
    if (dDep >= 0 && dDep <= 3 && profile.travelerRequired.includes("id_document")) {
      voyageurCandidates.push({ r, profile });
    }

    // Transfert sans n° de vol d'arrivée J-5.
    if (profile.extraCard === "arrival" && !(r.arrival_flight_number ?? "").trim() && dDep >= 0 && dDep <= 5) {
      push(r, "vol-arrivee-j5", "logistique", "Renseigner le vol d'arrivée", "Le chauffeur a besoin du vol et de l'heure d'arrivée.", depEnd, departureLabel(r.departure_date, now), { label: "Renseigner", href: fiche(r.id, "arrivee") }, r.departure_date);
    }
  }

  const resaById = new Map(resas.map((r) => [r.id, r]));

  // Second tour de requêtes, groupées et conditionnelles.
  const linkResaIds = Array.from(new Set(expiredLinks.map((l) => l.reservation_id)));
  const piloted = new Set(allotDays.map((d) => `${d.product_id}|${d.day}`));
  const alloCandidates = resas.filter((r) => r.departure_date >= today && piloted.has(`${r.circuit_id}|${r.departure_date}`));
  const lowStock = allotDays.filter((d) => d.quota > 0 && d.quota - d.sold <= 2);
  const missingLinkResaIds = linkResaIds.filter((id) => !resaById.has(id));

  const [allLinksRes, linkPaysRes, linkResasRes, consumedRes, travRes, stockProdRes] = await Promise.all([
    linkResaIds.length ? supabase.from("payment_links").select("reservation_id, created_at").in("reservation_id", linkResaIds) : null,
    linkResaIds.length ? supabase.from("payments").select("reservation_id, created_at").in("reservation_id", linkResaIds) : null,
    missingLinkResaIds.length ? supabase.from("reservations").select(RESA_SELECT).in("id", missingLinkResaIds).in("status", ["pending", "confirmed", "paid"]) : null,
    alloCandidates.length ? supabase.from("allotment_movements").select("reservation_id").eq("kind", "consume").in("reservation_id", alloCandidates.map((r) => r.id)) : null,
    // Complétude uniquement (compte) : aucune donnée de pièce n'est renvoyée au client.
    voyageurCandidates.length
      ? supabase
          .from("reservation_travelers")
          .select("reservation_id, full_name, date_of_birth, nationality, passport_number, gender, passport_expires_on, id_document_type")
          .in("reservation_id", voyageurCandidates.map((c) => c.r.id))
      : null,
    lowStock.length ? supabase.from("circuits").select("id, title").in("id", Array.from(new Set(lowStock.map((d) => d.product_id)))) : null,
  ]);

  // Lien de paiement expiré — UNE tâche par dossier : le dernier lien, s'il est expiré,
  // qu'aucun lien plus récent n'existe et qu'aucun règlement n'est arrivé depuis.
  if (linkResaIds.length) {
    const allLinks = (check(allLinksRes!, "liens (tous)") ?? []) as { reservation_id: string; created_at: string }[];
    const pays = (check(linkPaysRes!, "paiements (liens)") ?? []) as { reservation_id: string; created_at: string }[];
    for (const r of ((missingLinkResaIds.length ? check(linkResasRes!, "dossiers (liens)") : []) ?? []) as any[]) {
      const n = normalizeResa(r);
      resaById.set(n.id, n);
    }
    const latestExpired = new Map<string, { created_at: string; expires_at: string }>();
    for (const l of expiredLinks) {
      const cur = latestExpired.get(l.reservation_id);
      if (!cur || l.created_at > cur.created_at) latestExpired.set(l.reservation_id, l);
    }
    for (const [resaId, l] of latestExpired) {
      const r = resaById.get(resaId);
      if (!r) continue; // dossier annulé ou hors statuts actifs
      const newer = allLinks.some((x) => x.reservation_id === resaId && x.created_at > l.created_at);
      const paidSince = pays.some((p) => p.reservation_id === resaId && Date.parse(p.created_at) > Date.parse(l.created_at));
      if (newer || paidSince) continue;
      push(r, "lien-expire", "paiements", "Renvoyer le lien de paiement expiré", "Aucun règlement reçu depuis l'envoi du lien.", new Date(l.expires_at), expiredLabel(l.expires_at, now), { label: "Renvoyer", href: fiche(r.id, "paiements") }, r.departure_date >= today ? r.departure_date : null);
    }
  }

  // Hors allotement — produit piloté par allotement ce jour-là, aucune place décomptée.
  if (alloCandidates.length) {
    const consumed = new Set(((check(consumedRes!, "mouvements allotement") ?? []) as any[]).map((m) => m.reservation_id as string));
    for (const r of alloCandidates) {
      if (consumed.has(r.id)) continue;
      push(r, "hors-allotement", "stock", "Confirmer la place auprès du prestataire", "Produit piloté par allotement mais aucune place décomptée (accepté sur demande, ou décompte non abouti).", endOfAgencyDay(r.departure_date), departureLabel(r.departure_date, now), { label: "Traiter", href: fiche(r.id) }, r.departure_date);
    }
  }

  // Voyageurs incomplets J-3 — même règle de complétude que le badge de la fiche.
  if (voyageurCandidates.length) {
    const trav = (check(travRes!, "voyageurs") ?? []) as any[];
    for (const { r, profile } of voyageurCandidates) {
      const pax = Number(r.adults) + Number(r.children);
      if (pax <= 0) continue;
      const list = trav.filter((t) => t.reservation_id === r.id);
      const { status, complete: done } = travelersStatus(profile, list, pax);
      if (status !== "incomplete") continue;
      const todo = pax - done;
      push(r, "voyageurs-j3", "reservations", `Compléter ${todo} voyageur${todo > 1 ? "s" : ""} sur ${pax}`, "Pièce d'identité exigée pour ce dossier.", endOfAgencyDay(r.departure_date), departureLabel(r.departure_date, now), { label: "Compléter", href: fiche(r.id, "voyageurs") }, r.departure_date);
    }
  }

  // Report (utilisateur courant) et assignation (équipe) + noms des assignés.
  const assignMap = new Map(assignRows.map((a) => [a.task_key, a.assignee_id]));
  const assigneeIds = Array.from(new Set(tasks.map((t) => assignMap.get(t.key)).filter(Boolean) as string[]));
  const names = new Map<string, string>();
  if (assigneeIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", assigneeIds);
    for (const p of (profs ?? []) as any[]) names.set(p.id, p.full_name || "Membre de l'équipe");
  }
  const fullTasks: Task[] = sortTasks(
    tasks.map((t) => {
      const a = assignMap.get(t.key);
      return { ...t, snoozedUntil: snoozes.get(t.key) ?? null, assignee: a ? { id: a, name: names.get(a) ?? "Membre de l'équipe" } : null };
    }),
  );

  // ---------------------------------------------------------------- informations
  const infos: InfoItem[] = [];

  const departing = resas.filter((r) => r.departure_date === tomorrow && r.status !== "pending");
  if (departing.length > 0) {
    const paxTotal = departing.reduce((s, r) => s + Number(r.adults) + Number(r.children), 0);
    infos.push({
      key: `departs:${tomorrow}`,
      kind: "departures",
      title: `${departing.length} départ${departing.length > 1 ? "s" : ""} demain · ${paxTotal} voyageur${paxTotal > 1 ? "s" : ""}`,
      description: weekdayShort(tomorrow),
      href: `/admin/manifestes/${tomorrow}`,
      hrefLabel: "Imprimer les manifestes du jour",
      at: agencyDate(now) + "T00:00:00",
      read: readSet.has(`departs:${tomorrow}`),
      lines: departing
        .map((r) => {
          const t = (r.circuits?.category_fields as any)?.departure_time as string | undefined;
          const pax = Number(r.adults) + Number(r.children);
          return { label: `${t ? `${t} · ` : ""}${r.circuits?.title ?? "Prestation"}`, detail: `${pax} pax · ${r.reference}`, href: fiche(r.id), t: t ?? "99:99" };
        })
        .sort((a, b) => a.t.localeCompare(b.t))
        .map(({ t: _t, ...l }) => l),
    });
  }

  for (const p of recentPayments) {
    const online = p.source === "stripe" || p.source === "attijari_test" || p.method === "stripe" || p.method === "attijari" || p.method === "cmi";
    if (!online) continue;
    const ref = one<{ reference: string }>(p.reservations)?.reference ?? "";
    infos.push({
      key: `paiement-recu:${p.id}`,
      kind: "payment",
      title: `Paiement reçu — ${formatMAD(Number(p.amount_mad))}${ref ? ` · ${ref}` : ""}`,
      description: paymentLabel(p.method, p.source),
      href: fiche(p.reservation_id, "paiements"),
      at: p.paid_at ?? p.created_at,
      read: readSet.has(`paiement-recu:${p.id}`),
    });
  }

  if (lowStock.length) {
    const titles = new Map(((check(stockProdRes!, "produits (stock)") ?? []) as any[]).map((c) => [c.id as string, c.title as string]));
    for (const d of lowStock) {
      const left = d.quota - d.sold;
      infos.push({
        key: `stock:${d.product_id}|${d.day}`,
        kind: "stock",
        title: `${left === 0 ? "Complet" : `${left} place${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""}`} — ${titles.get(d.product_id) ?? "Produit"}`,
        description: `${weekdayShort(d.day)} · ${d.sold}/${d.quota} vendues`,
        href: "/admin/allotements",
        at: d.day + "T00:00:00",
        read: readSet.has(`stock:${d.product_id}|${d.day}`),
      });
    }
  }
  infos.sort((a, b) => Number(a.read) - Number(b.read) || Date.parse(b.at) - Date.parse(a.at));

  if (complete && opts.role && STAFF_ROLES.includes(opts.role)) {
    await syncTaskLog(supabase, fullTasks, today, assignMap).catch((e) => console.error("[task_log] synchronisation :", e));
  }

  return { userId, tasks: fullTasks, infos, computedAt: nowIso };
}

/**
 * Journal des tâches, en DIFFÉRENTIEL (écritures seulement si quelque chose change) :
 *  - nouvelle clé → insertion ;
 *  - clé revenue → réouverture ;
 *  - clé disparue → resolved_at = maintenant, motif DÉDUIT des données :
 *      cancelled (dossier annulé ou supprimé), expired (départ passé — sortie de fenêtre
 *      sans traitement), resolved (la cause a disparu). Seul « resolved » est compté.
 * « Résolues aujourd'hui » = résolutions CONSTATÉES aujourd'hui (heure de Casablanca).
 */
async function syncTaskLog(supabase: SupabaseClient, tasks: Task[], today: string, assignMap: Map<string, string>) {
  const keys = tasks.map((t) => t.key);
  const [openRes, knownRes] = await Promise.all([
    supabase.from("task_log").select("task_key, reservation_id").is("resolved_at", null),
    keys.length ? supabase.from("task_log").select("task_key, resolved_at").in("task_key", keys) : Promise.resolve({ data: [], error: null }),
  ]);
  if (openRes.error || knownRes.error) {
    console.error("[task_log] lecture :", openRes.error ?? knownRes.error);
    return;
  }
  const known = new Map(((knownRes.data ?? []) as any[]).map((r) => [r.task_key as string, r.resolved_at as string | null]));
  const current = new Set(keys);

  const inserts = tasks
    .filter((t) => !known.has(t.key))
    .map((t) => ({ task_key: t.key, reservation_id: t.reservationId, family: t.family, title: t.title, reference: t.reference }));
  const reopened = tasks.filter((t) => known.has(t.key) && known.get(t.key) !== null).map((t) => t.key);
  const vanished = ((openRes.data ?? []) as { task_key: string; reservation_id: string | null }[]).filter((r) => !current.has(r.task_key));

  const writes: PromiseLike<unknown>[] = [];
  if (inserts.length) writes.push(supabase.from("task_log").upsert(inserts, { onConflict: "task_key", ignoreDuplicates: true }));
  if (reopened.length) writes.push(supabase.from("task_log").update({ resolved_at: null, outcome: null }).in("task_key", reopened));

  if (vanished.length) {
    const ids = Array.from(new Set(vanished.map((v) => v.reservation_id).filter(Boolean) as string[]));
    const { data: rows, error } = ids.length
      ? await supabase.from("reservations").select("id, status, departure_date").in("id", ids)
      : { data: [], error: null };
    if (error) {
      console.error("[task_log] classement :", error);
    } else {
      const byId = new Map(((rows ?? []) as any[]).map((r) => [r.id as string, r]));
      const resolvedAt = new Date().toISOString();
      for (const v of vanished) {
        const r = v.reservation_id ? byId.get(v.reservation_id) : null;
        const outcome = !r || r.status === "cancelled" ? "cancelled" : r.departure_date < today ? "expired" : "resolved";
        writes.push(
          supabase
            .from("task_log")
            .update({ resolved_at: resolvedAt, outcome, assignee_id: assignMap.get(v.task_key) ?? null })
            .eq("task_key", v.task_key)
            .is("resolved_at", null),
        );
      }
      // L'assignation suit la tâche : close, elle est retirée (sa trace reste dans le journal).
      writes.push(supabase.from("task_assignments").delete().in("task_key", vanished.map((v) => v.task_key)));
    }
  }
  await Promise.all(writes);
}

/** Tâches dont la résolution a été constatée aujourd'hui (Casablanca), motif « resolved » uniquement. */
export async function resolvedTasksToday(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("task_log")
    .select("task_key, reservation_id, family, title, reference, resolved_at, assignee_id")
    .eq("outcome", "resolved")
    .gte("resolved_at", startOfAgencyToday().toISOString())
    .order("resolved_at", { ascending: false });
  if (error) console.error("[task_log] résolues :", error);
  return { rows: (data ?? []) as { task_key: string; reservation_id: string | null; family: TaskFamily; title: string; reference: string | null; resolved_at: string; assignee_id: string | null }[], error };
}

/**
 * Calcul mémoïsé pour la REQUÊTE en cours (React cache) : le layout (pastille) et
 * la page /admin/actions partagent un seul calcul par chargement de page.
 */
export const getNotificationsForRequest = cache(async (userId: string, role: string | null): Promise<NotificationsData> => {
  const supabase = await createClient();
  return computeNotifications(supabase, userId, { role });
});
