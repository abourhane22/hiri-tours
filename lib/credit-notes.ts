// Avoirs : libellés partagés et ajustement du CA.
//
// RÈGLE CA NET : le chiffre d'affaires est calculé partout comme la somme des
// `total_amount_mad` des dossiers paid/completed — jamais depuis `payments`.
// Un avoir partiel (geste commercial, erreur de facturation) réduit donc le CA
// réellement acquis sans que le dossier bouge : on le retranche explicitement.
// Un avoir TOTAL annule la facture ; si le dossier est lui aussi annulé il est
// déjà hors CA et l'avoir n'a plus rien à retrancher (voir `netRevenue`).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreditNoteReason, CreditNoteStatus, RefundMethod } from "@/lib/types";

export const CREDIT_NOTE_REASON_LABEL: Record<CreditNoteReason, string> = {
  cancellation: "Annulation",
  commercial_gesture: "Geste commercial",
  billing_error: "Erreur de facturation",
  other: "Autre",
};

export const CREDIT_NOTE_REASONS: { value: CreditNoteReason; label: string }[] = (
  Object.keys(CREDIT_NOTE_REASON_LABEL) as CreditNoteReason[]
).map((value) => ({ value, label: CREDIT_NOTE_REASON_LABEL[value] }));

export const CREDIT_NOTE_STATUS_LABEL: Record<CreditNoteStatus, string> = {
  issued: "Disponible",
  consumed: "Utilisé",
  refunded: "Remboursé",
};

export const CREDIT_NOTE_STATUS_STYLE: Record<CreditNoteStatus, { bg: string; color: string }> = {
  issued: { bg: "#FAEEDA", color: "#633806" },
  consumed: { bg: "#F1EFE8", color: "#5F5E5A" },
  refunded: { bg: "#E1F5EE", color: "#085041" },
};

export const REFUND_METHOD_LABEL: Record<RefundMethod, string> = {
  cash: "Espèces",
  transfer: "Virement",
  card_manual: "Carte (remboursement déclaré)",
};

export const REFUND_METHODS: { value: RefundMethod; label: string; needsRef: boolean }[] = [
  { value: "cash", label: "Espèces", needsRef: false },
  { value: "transfer", label: "Virement", needsRef: true },
  { value: "card_manual", label: "Carte (remboursement déclaré)", needsRef: true },
];

export function isCreditNoteReason(v: string): v is CreditNoteReason {
  return v in CREDIT_NOTE_REASON_LABEL;
}
export function isRefundMethod(v: string): v is RefundMethod {
  return v === "cash" || v === "transfer" || v === "card_manual";
}

/**
 * Avoirs émis, indexés par dossier d'origine, NETS des imputations de
 * rectification. Sert à retrancher les avoirs du CA sur la période analysée (le
 * périmètre temporel est celui des dossiers, puisque c'est leur `departure_date`
 * qui porte le CA).
 *
 * Un avoir imputé sur la facture rectificative du même dossier (mouvement
 * `rectification`) ne réduit plus le CA : le dossier est refacturé et encaissé.
 * Sans cette neutralisation, un dossier rectifié par un avoir total afficherait
 * un CA net de 0. Autorité unique — dashboard, Rapports et lib/finance passent ici.
 */
export async function creditNotesByReservation(
  supabase: SupabaseClient,
  reservationIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (reservationIds.length === 0) return out;
  const { data } = await supabase
    .from("credit_notes")
    .select("id, reservation_id, amount_mad")
    .in("reservation_id", reservationIds);
  const notes = (data ?? []) as { id: string; reservation_id: string; amount_mad: number | string }[];
  if (notes.length === 0) return out;

  const { data: rectRows, error } = await supabase
    .from("credit_note_movements")
    .select("credit_note_id, amount_mad")
    .eq("kind", "rectification")
    .in("credit_note_id", notes.map((n) => n.id));
  if (error) console.error("[creditNotesByReservation] imputations de rectification :", error);
  const rectified = new Map<string, number>();
  for (const m of (rectRows ?? []) as { credit_note_id: string; amount_mad: number | string }[]) {
    rectified.set(m.credit_note_id, (rectified.get(m.credit_note_id) ?? 0) + Number(m.amount_mad));
  }

  for (const n of notes) {
    const net = Math.max(0, Number(n.amount_mad) - (rectified.get(n.id) ?? 0));
    if (net > 0) out.set(n.reservation_id, (out.get(n.reservation_id) ?? 0) + net);
  }
  return out;
}

/**
 * CA net d'avoirs sur un ensemble de dossiers déjà filtrés (paid/completed).
 * Les avoirs des dossiers hors périmètre sont ignorés ; un avoir ne peut pas
 * rendre le CA d'un dossier négatif.
 */
export function netRevenue(
  reservations: { id: string; total_amount_mad: number | string }[],
  credits: Map<string, number>,
): { gross: number; credited: number; net: number } {
  let gross = 0;
  let credited = 0;
  for (const r of reservations) {
    const total = Number(r.total_amount_mad);
    gross += total;
    credited += Math.min(total, credits.get(r.id) ?? 0);
  }
  return { gross, credited, net: gross - credited };
}

/**
 * Vente nette d'avoirs d'UN dossier — même règle que le CA des rapports
 * (creditNotesByReservation : avoirs nets des imputations de rectification, un avoir
 * ne rend jamais la vente négative). Carte Marge et panneau d'impact des dépenses.
 */
export async function netSaleOfReservation(
  supabase: SupabaseClient,
  reservationId: string,
  totalMad: number,
): Promise<{ net: number; credited: number }> {
  const credits = await creditNotesByReservation(supabase, [reservationId]);
  const credited = Math.min(Number(totalMad), credits.get(reservationId) ?? 0);
  return { net: Math.round((Number(totalMad) - credited) * 100) / 100, credited };
}
