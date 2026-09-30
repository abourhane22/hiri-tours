// Facture rectificative : facture émise sur un dossier dont la facture précédente
// a été annulée par un avoir total. L'avoir encore ouvert peut être imputé sur la
// rectificative (mouvement `rectification`, SANS paiement : les encaissements du
// dossier couvrent déjà la nouvelle facture) — fonction plpgsql
// impute_credit_note_rectification, qui re-vérifie tout sous verrou.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceRectificationSnapshot } from "@/lib/types";

export type RectificationContext = {
  /** Facture annulée par avoir que la prochaine facture du dossier rectifie. */
  snapshot: InvoiceRectificationSnapshot;
  /** Avoir encore ouvert (imputable), sinon null. */
  openCreditNote: { id: string; number: string; remaining: number } | null;
};

/**
 * Dernière facture du dossier annulée par un avoir. Sert à la fiche dossier
 * (proposition d'imputation) et à generateInvoice (snapshot + imputation) —
 * le serveur recalcule toujours, il ne se fie pas à un identifiant du client.
 */
export async function rectificationContext(
  supabase: SupabaseClient,
  reservationId: string,
): Promise<RectificationContext | null> {
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, invoice_number, cancelled_by_credit_note_id, cancelled_at")
    .eq("reservation_id", reservationId)
    .eq("status", "cancelled")
    .not("cancelled_by_credit_note_id", "is", null)
    .order("cancelled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!inv) return null;
  const i = inv as { id: string; invoice_number: string; cancelled_by_credit_note_id: string };

  const { data: note } = await supabase
    .from("credit_notes")
    .select("id, credit_note_number, remaining_mad, status")
    .eq("id", i.cancelled_by_credit_note_id)
    .maybeSingle();
  if (!note) return null;
  const n = note as { id: string; credit_note_number: string; remaining_mad: number | string; status: string };
  const remaining = Number(n.remaining_mad);

  return {
    snapshot: {
      invoice_id: i.id,
      invoice_number: i.invoice_number,
      credit_note_id: n.id,
      credit_note_number: n.credit_note_number,
    },
    openCreditNote: n.status === "issued" && remaining > 0 ? { id: n.id, number: n.credit_note_number, remaining } : null,
  };
}

/**
 * Page avoir : facture rectificative sur laquelle cet avoir OUVERT peut être
 * imputé — l'avoir a annulé la facture d'origine, et une facture active du même
 * dossier a été émise après lui. Null sinon (la fonction SQL refuserait).
 */
export async function imputableRectificative(
  supabase: SupabaseClient,
  note: { id: string; invoice_id: string; reservation_id: string; created_at: string; status: string; remaining_mad: number | string },
): Promise<{ id: string; invoice_number: string } | null> {
  if (note.status !== "issued" || Number(note.remaining_mad) <= 0) return null;
  const { data: orig } = await supabase
    .from("invoices")
    .select("status, cancelled_by_credit_note_id")
    .eq("id", note.invoice_id)
    .maybeSingle();
  const o = orig as { status: string; cancelled_by_credit_note_id: string | null } | null;
  if (!o || o.status !== "cancelled" || o.cancelled_by_credit_note_id !== note.id) return null;

  const { data: active } = await supabase
    .from("invoices")
    .select("id, invoice_number, issued_at")
    .eq("reservation_id", note.reservation_id)
    .neq("status", "cancelled")
    .gt("issued_at", note.created_at)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (active as { id: string; invoice_number: string } | null) ?? null;
}

/** Appel de la fonction plpgsql ; ses `raise exception` sont rédigées pour l'utilisateur. */
export async function imputeRectification(
  supabase: SupabaseClient,
  creditNoteId: string,
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc("impute_credit_note_rectification", {
    p_credit_note_id: creditNoteId,
    p_invoice_id: invoiceId,
  });
  if (!error) return { ok: true };
  console.error("[impute_credit_note_rectification]", error);
  const msg = (error.message ?? "").replace(/^.*?(?:exception|error):\s*/i, "").trim();
  return { ok: false, error: msg || "Imputation de l'avoir impossible." };
}
