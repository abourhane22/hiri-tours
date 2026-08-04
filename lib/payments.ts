import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Enregistre un paiement provenant d'une gateway externe (Attijari, Stripe…),
 * en respectant le plafond du restant dû, avec idempotence sur external_ref,
 * puis auto-confirmation / horodatage via autoConfirmOnPayment.
 * Fonction partagée : le trigger DB met à jour paid_amount_mad + promotion.
 */
export async function recordExternalPayment(
  supabase: SupabaseClient,
  params: {
    reservationId: string;
    amountMad: number;
    method: string;
    source: string;
    externalRef: string;
  },
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const { reservationId, amountMad, method, source, externalRef } = params;

  // Idempotence : ne pas dupliquer si ce external_ref est déjà enregistré.
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (existing) return { ok: true, skipped: true };

  const { data: reservation } = await supabase
    .from("reservations")
    .select("total_amount_mad, paid_amount_mad")
    .eq("id", reservationId)
    .single();
  if (!reservation) return { ok: false, error: "Réservation introuvable" };

  const total = Number((reservation as any).total_amount_mad);
  const paid = Number((reservation as any).paid_amount_mad);
  const remaining = Math.max(0, total - paid);
  const payAmount = Math.min(amountMad, remaining);

  if (payAmount > 0) {
    const { error } = await supabase.from("payments").insert({
      reservation_id: reservationId,
      method,
      amount_mad: payAmount,
      source,
      external_ref: externalRef,
      transaction_ref: externalRef,
    });
    if (error) return { ok: false, error: error.message };
  }

  await autoConfirmOnPayment(supabase, reservationId);
  return { ok: true };
}

/**
 * Auto-confirmation après enregistrement d'un paiement.
 * Le trigger DB a déjà mis à jour paid_amount_mad (et promu en 'paid' si le
 * solde est intégral). Ici : si le dossier est ENCORE 'pending' avec un
 * encaissement > 0 (paiement partiel), il passe automatiquement 'confirmed'.
 * À appeler après l'insert du paiement, avec le même client Supabase.
 */
export async function autoConfirmOnPayment(
  supabase: SupabaseClient,
  reservationId: string,
): Promise<void> {
  const { data } = await supabase
    .from("reservations")
    .select("status, paid_amount_mad, reference, confirmed_at, paid_at")
    .eq("id", reservationId)
    .single();

  if (!data) return;
  const d = data as {
    status: string;
    paid_amount_mad: number | string;
    reference: string;
    confirmed_at: string | null;
    paid_at: string | null;
  };

  const nowIso = new Date().toISOString();

  if (d.status === "pending" && Number(d.paid_amount_mad) > 0) {
    // Paiement partiel : Demande → Confirmée.
    await supabase
      .from("reservations")
      .update({ status: "confirmed", confirmed_at: d.confirmed_at ?? nowIso })
      .eq("id", reservationId);
    console.log(`[payment] auto-confirm ${d.reference}`);
  } else if (d.status === "paid") {
    // Le trigger DB vient de promouvoir en Payée : on horodate (sans écraser).
    const patch: Record<string, unknown> = {};
    if (!d.paid_at) patch.paid_at = nowIso;
    if (!d.confirmed_at) patch.confirmed_at = nowIso;
    if (Object.keys(patch).length > 0) {
      await supabase.from("reservations").update(patch).eq("id", reservationId);
    }
  }
}
