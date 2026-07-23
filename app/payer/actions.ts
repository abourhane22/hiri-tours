"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateOrderId,
  signOrder,
  verifyOrderSignature,
  evaluateSimulatedPayment,
} from "@/lib/attijari";

/**
 * Résultat renvoyé au client UNIQUEMENT en cas d'échec.
 * En cas de succès, l'action fait un redirect() (la promesse ne résout pas).
 */
export type PayError = { error: string; reservationId?: string };

/**
 * Étape 1 — création de l'ordre de paiement (équivalent "initier la session"
 * chez CMI/Attijari). Écritures via service-role : /payer est public, sans
 * session utilisateur.
 */
export async function initiateAttijariPayment(
  reservationId: string,
): Promise<PayError | never> {
  const supabase = createAdminClient();

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("id, status, total_amount_mad, paid_amount_mad")
    .eq("id", reservationId)
    .single();

  if (error || !reservation) {
    return { error: "Réservation introuvable." };
  }

  const r = reservation as {
    status: string;
    total_amount_mad: number | string;
    paid_amount_mad: number | string;
  };

  if (r.status === "cancelled") {
    return { error: "Cette réservation est annulée." };
  }

  const total = Number(r.total_amount_mad);
  const paid = Number(r.paid_amount_mad);
  const remaining = Math.max(0, total - paid);

  if (remaining <= 0) {
    return { error: "Cette réservation est déjà soldée." };
  }

  const orderId = generateOrderId();
  const signature = signOrder(orderId, remaining);

  const { error: insertError } = await supabase.from("payment_orders").insert({
    reservation_id: reservationId,
    order_id: orderId,
    amount_mad: remaining,
    status: "pending",
    signature,
  });

  if (insertError) {
    console.error("[initiateAttijariPayment] insert error:", insertError);
    return { error: "Impossible de créer l'ordre de paiement." };
  }

  // Redirection vers la page de paiement de la gateway (simulée).
  redirect(`/payer/attijari/${orderId}`);
}

/**
 * Étape finale — équivalent du callback de vérification chez CMI/Attijari.
 * Vérifie l'ordre + la signature, applique la décision de la banque simulée,
 * puis enregistre le paiement (réutilise le trigger existant qui met à jour
 * paid_amount_mad et promeut la réservation en 'paid' si soldée).
 */
export async function confirmAttijariPayment(
  orderId: string,
  cardNumberRaw: string,
  otpCode: string,
): Promise<PayError | never> {
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (error || !order) {
    return { error: "Ordre de paiement introuvable." };
  }

  const o = order as {
    order_id: string;
    reservation_id: string;
    amount_mad: number | string;
    status: string;
    signature: string;
  };

  if (o.status !== "pending") {
    return {
      error: "Cet ordre de paiement n'est plus valide. Veuillez recommencer.",
      reservationId: o.reservation_id,
    };
  }

  const amount = Number(o.amount_mad);

  // Intégrité de l'ordre — la gateway refuse tout ordre falsifié.
  if (!verifyOrderSignature(o.order_id, amount, o.signature)) {
    await supabase
      .from("payment_orders")
      .update({ status: "failed" })
      .eq("order_id", orderId);
    return {
      error: "Signature de paiement invalide. Transaction rejetée.",
      reservationId: o.reservation_id,
    };
  }

  const verdict = evaluateSimulatedPayment(cardNumberRaw, otpCode);

  if (!verdict.approved) {
    await supabase
      .from("payment_orders")
      .update({ status: "failed" })
      .eq("order_id", orderId);
    const message =
      verdict.reason === "otp_invalid"
        ? "Code de vérification incorrect."
        : "Transaction refusée par votre banque — fonds insuffisants.";
    return { error: message, reservationId: o.reservation_id };
  }

  // ---- Succès ----
  // Idempotence : ne pas dupliquer si un paiement porte déjà cet external_ref.
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("external_ref", orderId)
    .maybeSingle();

  if (!existing) {
    // Recharge pour recalculer le restant dû et respecter le plafond.
    const { data: reservation } = await supabase
      .from("reservations")
      .select("total_amount_mad, paid_amount_mad")
      .eq("id", o.reservation_id)
      .single();

    if (!reservation) {
      return { error: "Réservation introuvable.", reservationId: o.reservation_id };
    }

    const total = Number((reservation as any).total_amount_mad);
    const paid = Number((reservation as any).paid_amount_mad);
    const remaining = Math.max(0, total - paid);
    const payAmount = Math.min(amount, remaining);

    if (payAmount > 0) {
      const { error: payError } = await supabase.from("payments").insert({
        reservation_id: o.reservation_id,
        method: "cmi", // Attijari route les cartes marocaines via CMI
        amount_mad: payAmount,
        transaction_ref: orderId,
        source: "attijari_test",
        external_ref: orderId,
      });

      if (payError) {
        console.error("[confirmAttijariPayment] payment insert error:", payError);
        return {
          error: "Erreur lors de l'enregistrement du paiement.",
          reservationId: o.reservation_id,
        };
      }
    }
  }

  await supabase
    .from("payment_orders")
    .update({ status: "paid" })
    .eq("order_id", orderId);

  revalidatePath(`/admin/reservations/${o.reservation_id}`);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");

  redirect(`/payer/${o.reservation_id}/merci?ref=${orderId}`);
}
