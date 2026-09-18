import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMAD, formatDateShort } from "@/lib/utils";

// Notifications DÉRIVÉES des données (aucune table de notifications, aucun job).
// Chaque notification a une clé déterministe stable, croisée avec
// notification_reads pour l'état lu/non-lu par utilisateur. Une notification
// dont la condition disparaît n'est tout simplement plus calculée.

export type NotifPriority = "terracotta" | "amber" | "info" | "success";
export type NotifFamily = "logistique" | "paiements" | "reservations" | "stock";

export type AppNotification = {
  key: string;
  priority: NotifPriority;
  family: NotifFamily;
  title: string;
  description: string;
  reference: string | null;
  href: string;
  at: string; // ISO — horodatage d'ancrage (relatif + tri)
  read: boolean;
};

const DAY = 86_400_000;
const PRIORITY_RANK: Record<NotifPriority, number> = { terracotta: 0, amber: 1, info: 2, success: 3 };

/** Notifications actionnables (incrémentent la pastille). */
export function isActionable(n: AppNotification): boolean {
  return n.priority === "terracotta" || n.priority === "amber";
}

function dayDiffFromToday(dateStr: string, todayMs: number): number {
  const d = new Date(dateStr + "T00:00:00").getTime();
  return Math.round((d - todayMs) / DAY);
}

function paymentLabel(method: string | null, source: string | null): string {
  if (source === "stripe" || method === "stripe") return "Stripe · carte internationale";
  return "Attijari Payment";
}

export async function computeNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppNotification[]> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const todayMidnight = new Date(new Date(now).toISOString().slice(0, 10) + "T00:00:00").getTime();
  const tomorrowStr = new Date(todayMidnight + DAY).toISOString().slice(0, 10);

  const [resaRes, linksRes, paymentsRes, readsRes] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, reference, status, circuit_id, departure_date, adults, children, total_amount_mad, paid_amount_mad, vehicle_id, guide_id, driver_id, intended_payment_channel, created_at, circuits(title, category, category_fields)",
      )
      .in("status", ["pending", "confirmed", "paid"]),
    supabase
      .from("payment_links")
      .select("id, reservation_id, created_at, expires_at, used_at, revoked_at, reservations(reference)")
      .is("used_at", null)
      .is("revoked_at", null)
      .lt("expires_at", nowIso),
    supabase
      .from("payments")
      .select("id, reservation_id, method, source, amount_mad, paid_at, created_at, reservations(reference)")
      .gte("created_at", new Date(now - 2 * DAY).toISOString()),
    supabase.from("notification_reads").select("notification_key").eq("user_id", userId),
  ]);

  const resas = (resaRes.data ?? []) as any[];
  const links = (linksRes.data ?? []) as any[];
  const recentPayments = (paymentsRes.data ?? []) as any[];
  const readSet = new Set(((readsRes.data ?? []) as any[]).map((r) => r.notification_key));

  const out: AppNotification[] = [];
  const fiche = (id: string) => `/admin/reservations/${id}`;

  for (const r of resas) {
    const cat = r.circuits?.category as string | undefined;
    const dDep = dayDiffFromToday(r.departure_date, todayMidnight);
    const remaining = Number(r.total_amount_mad) - Number(r.paid_amount_mad);
    const createdMs = new Date(r.created_at).getTime();
    const pax = Number(r.adults) + Number(r.children);

    // 1. logistique-j2 — confirmée, départ ≤ 2 j, affectation incomplète.
    if (r.status === "confirmed" && dDep >= 0 && dDep <= 2) {
      const needGuide = cat !== "transfert";
      const missing: string[] = [];
      if (!r.vehicle_id) missing.push("véhicule");
      if (!r.driver_id) missing.push("chauffeur");
      if (needGuide && !r.guide_id) missing.push("guide");
      if (missing.length > 0) {
        out.push({
          key: `logistique-j2:${r.id}`,
          priority: "terracotta",
          family: "logistique",
          title: `Logistique à compléter — ${r.reference}`,
          description: `Départ le ${formatDateShort(r.departure_date)} · à affecter : ${missing.join(", ")}.`,
          reference: r.reference,
          href: fiche(r.id),
          at: r.departure_date + "T00:00:00",
          read: readSet.has(`logistique-j2:${r.id}`),
        });
      }
    }

    // 2. solde-j7 — reste à payer > 0, départ ≤ 7 j.
    if (remaining > 0 && dDep >= 0 && dDep <= 7) {
      out.push({
        key: `solde-j7:${r.id}`,
        priority: "terracotta",
        family: "paiements",
        title: `Solde à recouvrer — ${r.reference}`,
        description: `Reste ${formatMAD(remaining)} sur ${formatMAD(Number(r.total_amount_mad))} · départ le ${formatDateShort(r.departure_date)}.`,
        reference: r.reference,
        href: fiche(r.id),
        at: r.departure_date + "T00:00:00",
        read: readSet.has(`solde-j7:${r.id}`),
      });
    }

    // 5. resa-web — créée via le site (canal renseigné), statut initial, ≤ 7 j.
    if (r.status === "pending" && r.intended_payment_channel != null && now - createdMs <= 7 * DAY) {
      out.push({
        key: `resa-web:${r.id}`,
        priority: "info",
        family: "reservations",
        title: `Réservation en ligne — ${r.reference}`,
        description: `${r.circuits?.title ?? "Prestation"} · départ le ${formatDateShort(r.departure_date)} · ${pax} voyageur${pax > 1 ? "s" : ""} · à confirmer.`,
        reference: r.reference,
        href: fiche(r.id),
        at: r.created_at,
        read: readSet.has(`resa-web:${r.id}`),
      });
    }

    // 6. attente-48h — statut initial depuis plus de 48 h.
    if (r.status === "pending" && now - createdMs > 2 * DAY) {
      out.push({
        key: `attente-48h:${r.id}`,
        priority: "amber",
        family: "reservations",
        title: `Demande en attente — ${r.reference}`,
        description: `Sans confirmation depuis plus de 48 h. ${r.circuits?.title ?? ""}`.trim(),
        reference: r.reference,
        href: fiche(r.id),
        at: r.created_at,
        read: readSet.has(`attente-48h:${r.id}`),
      });
    }
  }

  // 7. departs-demain — agrégée quotidienne (clé datée).
  const tomorrow = resas.filter((r) => r.departure_date === tomorrowStr);
  if (tomorrow.length > 0) {
    const paxTotal = tomorrow.reduce((s, r) => s + Number(r.adults) + Number(r.children), 0);
    const parts = tomorrow.map((r) => {
      const t = (r.circuits?.category_fields as any)?.departure_time;
      const pax = Number(r.adults) + Number(r.children);
      return `${r.circuits?.title ?? "Prestation"}${t ? ` ${t}` : ""} (${pax} pax)`;
    });
    out.push({
      key: `departs:${tomorrowStr}`,
      priority: "info",
      family: "reservations",
      title: `${tomorrow.length} départ${tomorrow.length > 1 ? "s" : ""} demain · ${paxTotal} voyageur${paxTotal > 1 ? "s" : ""}`,
      description: parts.join(" · "),
      reference: null,
      href: "/admin/manifestes",
      at: tomorrowStr + "T00:00:00",
      read: readSet.has(`departs:${tomorrowStr}`),
    });
  }

  // 3. lien-expire — lien émis > 24 h, expiré, non utilisé/révoqué, sans
  //    règlement rattaché depuis l'émission.
  if (links.length > 0) {
    const linkResaIds = Array.from(new Set(links.map((l) => l.reservation_id)));
    const { data: linkPayments } = await supabase
      .from("payments")
      .select("reservation_id, created_at")
      .in("reservation_id", linkResaIds);
    const payments = (linkPayments ?? []) as any[];
    for (const l of links) {
      const linkCreated = new Date(l.created_at).getTime();
      const hasPaymentSince = payments.some(
        (p) => p.reservation_id === l.reservation_id && new Date(p.created_at).getTime() > linkCreated,
      );
      if (!hasPaymentSince) {
        out.push({
          key: `lien-expire:${l.id}`,
          priority: "amber",
          family: "paiements",
          title: `Lien de paiement expiré — ${l.reservations?.reference ?? ""}`.trim(),
          description: `Émis le ${formatDateShort(l.created_at)} · aucun règlement reçu depuis.`,
          reference: l.reservations?.reference ?? null,
          href: fiche(l.reservation_id),
          at: l.expires_at,
          read: readSet.has(`lien-expire:${l.id}`),
        });
      }
    }
  }

  // 9. hors-allotement — RÉCONCILIATION (lot C2b). Dossier actif, départ à
  //    venir, sur un produit PILOTÉ par un allotement ce jour-là, mais sans
  //    aucune place décomptée. Deux causes, même action (vérifier auprès du
  //    fournisseur ou ajuster le quota) : réservation acceptée « sur demande »
  //    quota atteint, ou décompte non abouti (contrôle indisponible, crash
  //    entre l'insert et le consume). Dérivée : disparaît à l'annulation.
  const todayStr = new Date(now).toISOString().slice(0, 10);
  const { data: pilotedDays } = await supabase
    .from("allotment_days")
    .select("product_id, day")
    .gte("day", todayStr);
  const piloted = new Set(((pilotedDays ?? []) as any[]).map((d) => `${d.product_id}|${d.day}`));
  if (piloted.size > 0) {
    const candidates = resas.filter(
      (r) => r.departure_date >= todayStr && piloted.has(`${r.circuit_id}|${r.departure_date}`),
    );
    if (candidates.length > 0) {
      const { data: consumed } = await supabase
        .from("allotment_movements")
        .select("reservation_id")
        .eq("kind", "consume")
        .in("reservation_id", candidates.map((r) => r.id));
      const consumedSet = new Set(((consumed ?? []) as any[]).map((m) => m.reservation_id));
      for (const r of candidates) {
        if (consumedSet.has(r.id)) continue;
        const pax = Number(r.adults) + Number(r.children);
        out.push({
          key: `hors-allotement:${r.id}`,
          priority: "amber",
          family: "stock",
          title: `Dossier hors allotement — ${r.reference}`,
          description: `${r.circuits?.title ?? "Produit"} · départ le ${formatDateShort(r.departure_date)} · ${pax} pax · produit piloté par allotement mais aucune place décomptée (accepté sur demande, ou décompte non abouti). À confirmer auprès du prestataire.`,
          reference: r.reference,
          href: fiche(r.id),
          at: r.departure_date + "T00:00:00",
          read: readSet.has(`hors-allotement:${r.id}`),
        });
      }
    }
  }

  // 8. paiement en ligne reçu (informatif) — Stripe/Attijari sur 48 h.
  for (const p of recentPayments) {
    const online = p.source === "stripe" || p.source === "attijari_test" || p.method === "stripe" || p.method === "attijari" || p.method === "cmi";
    if (!online) continue;
    out.push({
      key: `paiement-recu:${p.id}`,
      priority: "success",
      family: "paiements",
      title: `Paiement en ligne reçu — ${p.reservations?.reference ?? ""}`.trim(),
      description: `${formatMAD(Number(p.amount_mad))} · ${paymentLabel(p.method, p.source)}.`,
      reference: p.reservations?.reference ?? null,
      href: fiche(p.reservation_id),
      at: p.paid_at ?? p.created_at,
      read: readSet.has(`paiement-recu:${p.id}`),
    });
  }

  out.sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    return new Date(b.at).getTime() - new Date(a.at).getTime();
  });

  return out;
}
