"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  duffelConfigured,
  duffelErrorMessage,
  duffelTokenMode,
  getOffer,
  createOrder,
  createOrderCancellation,
  confirmOrderCancellation,
  offerIsExpired,
  DuffelApiError,
} from "@/lib/duffel";
import { buildOrderPassengers } from "@/lib/distribution";
import type { DistributionBooking, ReservationTraveler } from "@/lib/types";

export type OrderActionResult =
  | { ok: true; bookingReference: string | null; documents: number; warning?: string }
  | { ok: false; error: string; missing?: string[] };

const fail = (error: string, missing?: string[]): OrderActionResult => ({ ok: false, error, missing });

/**
 * Coût réel du billet : dépense automatique « Billetterie aérienne » rattachée au dossier,
 * calculée EN BASE depuis les snapshots figés (sync_distribution_expense, idempotente :
 * une seule dépense par ordre). Renvoie un avertissement si l'écriture échoue — l'ordre,
 * lui, est déjà émis ou annulé chez Duffel.
 */
async function syncTicketExpense(supabase: Awaited<ReturnType<typeof createClient>>, bookingId: string, reservationId: string): Promise<string | undefined> {
  const { error } = await supabase.rpc("sync_distribution_expense", { p_booking_id: bookingId });
  revalidatePath("/admin/finance/depenses");
  revalidatePath("/admin/finance/rentabilite");
  revalidatePath(`/admin/reservations/${reservationId}`);
  if (!error) return undefined;
  console.error("[distribution] dépense automatique du billet :", bookingId, error);
  return `Coût réel du billet non enregistré (${error.message}). Signalez-le à l'administrateur : la marge du dossier est incomplète.`;
}

/**
 * Émission de l'ordre Duffel depuis la fiche dossier.
 * Triple verrou live : préfixe du token, live_mode figé, live_mode de l'offre relue.
 * Rien n'est envoyé à Duffel tant que les voyageurs ne sont pas complets.
 */
export async function issueOrderAction(bookingId: string): Promise<OrderActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Session expirée — reconnectez-vous.");
  if (!duffelConfigured()) return fail("Distribution aérienne non configurée.");

  const { data: row } = await supabase
    .from("distribution_bookings")
    .select("*, reservations(id, reference, status, total_amount_mad, paid_amount_mad, customers(email, phone, full_name))")
    .eq("id", bookingId)
    .single();
  if (!row) return fail("Dossier de distribution introuvable.");
  const booking = row as unknown as DistributionBooking & {
    reservations: { id: string; reference: string; status: string; total_amount_mad: number; paid_amount_mad: number; customers: { email: string | null; phone: string | null; full_name: string } | null } | null;
  };
  const reservation = Array.isArray(booking.reservations) ? booking.reservations[0] : booking.reservations;
  if (!reservation) return fail("Dossier introuvable.");

  if (booking.status === "ordered") return fail("L'ordre a déjà été émis pour ce dossier.");
  if (booking.status === "cancelled") return fail("L'ordre de ce dossier a été annulé — créez un nouveau dossier.");
  if (booking.status === "failed") return fail(booking.failure_message ?? "Émission impossible pour ce dossier — créez un nouveau dossier.");
  if (reservation.status === "cancelled") return fail("Le dossier est annulé.");

  // Verrou live 1 et 2 : token et snapshot.
  if (duffelTokenMode() === "live") return fail("Identifiant LIVE détecté : ce démonstrateur n'émet pas de vrais billets.");
  if (booking.live_mode) return fail("Cette offre est LIVE : émission refusée depuis le démonstrateur.");

  // Réglage « paiement complet exigé avant émission » (défaut : oui) — contrôlé ici,
  // avant tout appel Duffel ; l'interface ne fait que le refléter.
  const { data: settings } = await supabase
    .from("company_settings")
    .select("ticketing_require_full_payment")
    .limit(1)
    .maybeSingle();
  const requireFull = (settings as { ticketing_require_full_payment?: boolean | null } | null)?.ticketing_require_full_payment !== false;
  const due = Number(reservation.total_amount_mad) - Number(reservation.paid_amount_mad ?? 0);
  if (requireFull && due > 0.01) {
    return fail(`Paiement complet exigé avant l'émission : reste ${due.toFixed(2)} MAD à encaisser sur ce dossier.`);
  }

  // Re-lecture : prix et expiration à jour.
  let offer;
  try {
    offer = await getOffer(booking.offer_id);
  } catch (e) {
    const gone = e instanceof DuffelApiError && (e.status === 404 || e.has("offer_no_longer_available"));
    const message = duffelErrorMessage(e);
    if (gone) {
      await supabase.from("distribution_bookings").update({ status: "failed", failure_message: message }).eq("id", bookingId);
      revalidatePath(`/admin/reservations/${reservation.id}`);
    }
    return fail(message);
  }
  // Verrou live 3 : l'offre relue.
  if (offer.live_mode) return fail("Offre LIVE : émission refusée depuis le démonstrateur.");
  if (offerIsExpired(offer)) {
    const message = "L'offre a expiré : ce dossier ne peut plus être émis. Relancez une recherche et créez un nouveau dossier.";
    await supabase.from("distribution_bookings").update({ status: "failed", failure_message: message }).eq("id", bookingId);
    revalidatePath(`/admin/reservations/${reservation.id}`);
    return fail(message);
  }
  if (Math.abs(Number(offer.total_amount) - Number(booking.amount)) > 0.005) {
    return fail(
      `Le prix a changé depuis la création du dossier (${Number(booking.amount).toFixed(2)} → ${offer.total_amount} ${offer.total_currency}). Créez un nouveau dossier pour repartir du prix à jour.`,
    );
  }

  // Voyageurs → passagers Duffel, avec la liste exacte des manques.
  const { data: travRows } = await supabase
    .from("reservation_travelers")
    .select("*")
    .eq("reservation_id", reservation.id)
    .order("created_at", { ascending: true });
  const travelers = (travRows ?? []) as ReservationTraveler[];
  const customer = Array.isArray(reservation.customers) ? reservation.customers[0] : reservation.customers;
  const built = buildOrderPassengers(offer, travelers, { email: customer?.email ?? null, phone: customer?.phone ?? null });
  if (!built.ok) {
    return fail("Voyageurs incomplets — complétez la carte Voyageurs avant d'émettre.", built.missing);
  }

  // Émission.
  try {
    const order = await createOrder({
      offerId: offer.id,
      passengers: built.passengers,
      currency: offer.total_currency,
      amount: offer.total_amount,
      metadata: { hiri_reference: reservation.reference, hiri_reservation_id: reservation.id },
    });

    const { error: updErr } = await supabase
      .from("distribution_bookings")
      .update({
        order_id: order.id,
        booking_reference: order.booking_reference,
        order_snapshot: order,
        documents: order.documents ?? [],
        payment_status: order.payment_status ?? null,
        live_mode: order.live_mode,
        status: "ordered",
        ordered_at: new Date().toISOString(),
        failure_message: null,
      })
      .eq("id", bookingId);
    if (updErr) {
      // L'ordre EXISTE chez Duffel : on le dit, on ne le cache pas.
      console.error("[distribution] ordre émis mais non enregistré :", order.id, updErr);
      return fail(`Ordre émis chez Duffel (${order.booking_reference ?? order.id}) mais impossible de l'enregistrer — contactez l'administrateur avant toute nouvelle tentative.`);
    }

    const warning = await syncTicketExpense(supabase, bookingId, reservation.id);
    revalidatePath(`/admin/reservations/${reservation.id}`);
    return { ok: true, bookingReference: order.booking_reference, documents: order.documents?.length ?? 0, warning };
  } catch (e) {
    const message = duffelErrorMessage(e);
    console.error("[distribution] émission :", e instanceof DuffelApiError ? `${e.status} ${e.requestId ?? ""} ${e.errors.map((x) => x.code).join(",")}` : e);
    await supabase.from("distribution_bookings").update({ failure_message: message }).eq("id", bookingId);
    revalidatePath(`/admin/reservations/${reservation.id}`);
    return fail(message);
  }
}

export type CancelOrderResult =
  | { ok: true; refundAmount: string | null; refundCurrency: string | null; refundTo: string | null; warning?: string }
  | { ok: false; error: string };

/** Annulation : devis puis confirmation immédiate. Le remboursement est figé dans le snapshot. */
export async function cancelOrderAction(bookingId: string): Promise<CancelOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée — reconnectez-vous." };
  if (!duffelConfigured()) return { ok: false, error: "Distribution aérienne non configurée." };

  const { data: row } = await supabase.from("distribution_bookings").select("*").eq("id", bookingId).single();
  if (!row) return { ok: false, error: "Dossier de distribution introuvable." };
  const booking = row as unknown as DistributionBooking;
  if (booking.status !== "ordered" || !booking.order_id) return { ok: false, error: "Aucun ordre émis à annuler." };
  if (booking.live_mode || duffelTokenMode() === "live") return { ok: false, error: "Ordre LIVE : annulation refusée depuis le démonstrateur." };

  try {
    const quote = await createOrderCancellation(booking.order_id);
    const confirmed = await confirmOrderCancellation(quote.id);
    await supabase
      .from("distribution_bookings")
      .update({ status: "cancelled", cancellation_snapshot: confirmed, cancelled_at: new Date().toISOString() })
      .eq("id", bookingId);
    // Coût réel ramené à (ordre − remboursement) × taux figé.
    const warning = await syncTicketExpense(supabase, bookingId, booking.reservation_id);
    revalidatePath(`/admin/reservations/${booking.reservation_id}`);
    return { ok: true, refundAmount: confirmed.refund_amount, refundCurrency: confirmed.refund_currency, refundTo: confirmed.refund_to, warning };
  } catch (e) {
    console.error("[distribution] annulation :", e instanceof DuffelApiError ? `${e.status} ${e.requestId ?? ""}` : e);
    return { ok: false, error: duffelErrorMessage(e) };
  }
}
