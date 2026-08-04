import type { SupabaseClient } from "@supabase/supabase-js";

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
