"use server";

import { revalidatePath } from "next/cache";
import { sendVoucherEmail, sendBookingConfirmation } from "@/lib/email";

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
