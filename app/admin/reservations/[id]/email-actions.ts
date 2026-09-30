"use server";

import { revalidatePath } from "next/cache";
import { sendVoucherEmail, sendBookingConfirmation } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { isVoucherChannel, recordVoucherDelivery } from "@/lib/voucher-delivery";

export type EmailActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function sendVoucherEmailAction(
  reservationId: string,
): Promise<EmailActionResult> {
  try {
    const result = await sendVoucherEmail(reservationId);

    if (!result.success) {
      const reason = result.skipped || result.error || "Erreur inconnue";
      console.error(
        `[sendVoucherEmailAction] Échec pour réservation ${reservationId}:`,
        reason,
      );
      return { ok: false, error: reason };
    }

    // Étape « Voucher » : un envoi réussi vaut remise (non bloquant si l'écriture échoue).
    const supabase = await createClient();
    const rec = await recordVoucherDelivery(supabase, reservationId, "email");
    if (!rec.ok) console.error(`[sendVoucherEmailAction] remise non enregistrée pour ${reservationId}:`, rec.error);

    revalidatePath(`/admin/reservations/${reservationId}`);
    return { ok: true, id: result.id };
  } catch (e: any) {
    console.error(
      `[sendVoucherEmailAction] Exception non gérée pour réservation ${reservationId}:`,
      e,
    );
    return {
      ok: false,
      error: e?.message || "Erreur inattendue lors de l'envoi",
    };
  }
}

export async function sendBookingConfirmationAction(reservationId: string) {
  const result = await sendBookingConfirmation(reservationId);
  if (!result.success) {
    console.warn("Email de confirmation non envoyé :", result.error || result.skipped);
  }
  return result;
}

/** Bouton « Marquer comme remis » : remise hors email (comptoir, WhatsApp, autre). */
export async function markVoucherDeliveredAction(reservationId: string, channel: string): Promise<EmailActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée — reconnectez-vous." };
  if (!isVoucherChannel(channel) || channel === "email") return { ok: false, error: "Canal de remise invalide." };

  const { data: resa } = await supabase.from("reservations").select("id, status").eq("id", reservationId).maybeSingle();
  if (!resa) return { ok: false, error: "Dossier introuvable." };
  if ((resa as { status: string }).status === "cancelled") return { ok: false, error: "Dossier annulé — aucun voucher à remettre." };

  const rec = await recordVoucherDelivery(supabase, reservationId, channel);
  if (!rec.ok) return { ok: false, error: "Impossible d'enregistrer la remise du voucher." };
  revalidatePath(`/admin/reservations/${reservationId}`);
  return { ok: true };
}
