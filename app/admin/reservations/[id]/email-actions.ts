"use server";

import { revalidatePath } from "next/cache";
import { sendVoucherEmail, sendBookingConfirmation } from "@/lib/email";

export async function sendVoucherEmailAction(reservationId: string) {
  const result = await sendVoucherEmail(reservationId);
  if (!result.success) {
    if (result.skipped) throw new Error(`Email non envoyé : ${result.skipped}`);
    throw new Error(`Échec de l'envoi : ${result.error}`);
  }
  revalidatePath(`/admin/reservations/${reservationId}`);
  return result;
}

export async function sendBookingConfirmationAction(reservationId: string) {
  const result = await sendBookingConfirmation(reservationId);
  if (!result.success) {
    console.warn("Email de confirmation non envoyé :", result.error || result.skipped);
  }
  return result;
}
