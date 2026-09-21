"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { seasonMultiplier, computeLineTotal, isSaleUnit } from "@/lib/pricing";
import type { SaleUnit } from "@/lib/types";
import { consumeAllotment, blockedMessage, RELEASED_MESSAGE } from "@/lib/allotments";
import {
  discountAmount,
  isBookingChannel,
  isDepositMethod,
  isDiscountReason,
  isIntendedChannel,
  normalizeQuantity,
  paxOf,
  toLineQuantity,
  type DiscountMode,
  type DiscountReason,
  type DepositMethod,
} from "@/lib/booking";
import { addPayment } from "@/app/admin/reservations/[id]/actions";
import { createPaymentLink } from "@/app/admin/reservations/[id]/payment-link-actions";
import { autoConfirmOnPayment } from "@/lib/payments";
import { MEAL_PLAN_LABEL } from "@/lib/dossier-profile";
import { computeAndStoreExpectedCost } from "@/lib/cost-snapshot";

export type CreateReservationInput = {
  circuit_id: string;
  customer_id: string;
  departure_date: string;
  adults: number;
  children: number;
  /** Quantités hors per_person (défaut 1 — normalisées selon sale_unit). */
  trips?: number;
  nights?: number;
  rooms?: number;
  units?: number;
  /** Montant affiché au client — CONTRÔLE uniquement, le serveur recalcule. */
  total_amount_mad: number;
  /** Ignoré : le statut est déduit (pending, puis confirmed/paid par les encaissements). Conservé pour les appelants existants. */
  status?: string;
  notes?: string;
  booking_channel?: string | null;
  group_language?: string | null;
  special_requests?: string | null;
  customer_note?: string | null;
  intended_payment_channel?: string | null;
  /** Transfert : vol et heure d'arrivée (HH:MM, le jour du transfert). */
  arrival_flight_number?: string | null;
  arrival_time?: string | null;
  /** Hébergement : régime (none | breakfast | half_board | full_board | all_inclusive). */
  meal_plan?: string | null;
  discount?: { mode: DiscountMode; value: number; reason: DiscountReason | string | null } | null;
  deposit?: { amount: number; method: DepositMethod | string; external_ref?: string | null } | null;
  credit_note?: { id: string; amount: number } | null;
  send_link?: boolean;
};

export type CreateReservationResult =
  | {
      ok: true;
      id: string;
      reference: string;
      onRequest: boolean;
      status: string;
      /** Étapes post-création qui ont échoué : le dossier existe, l'écran dit ce qui reste à faire. */
      followups: string[];
      linkUrl: string | null;
    }
  | { ok: false; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const clean = (s: string | null | undefined) => {
  const t = (s ?? "").trim();
  return t ? t : null;
};

/**
 * Création d'un dossier depuis le backoffice.
 * Ordre : validation → recalcul serveur (quantités selon sale_unit, remise) →
 * insert en `pending` → allotement (compensation si refus) → acompte → avoir →
 * lien de paiement. Après l'insert, chaque étape qui échoue est remontée dans
 * `followups` plutôt que de supprimer le dossier.
 */
export async function createReservation(input: CreateReservationInput): Promise<CreateReservationResult> {
  if (!input.circuit_id) return { ok: false, error: "Produit manquant" };
  if (!input.customer_id) return { ok: false, error: "Client manquant" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.departure_date || "")) return { ok: false, error: "Date de départ manquante" };

  const supabase = await createClient();

  // Produit rechargé côté serveur — jamais confiance au client.
  const { data: circuit, error: circuitError } = await supabase
    .from("circuits")
    .select("title, base_price_mad, child_price_mad, max_participants, sale_unit, pricing_mode, circuit_seasons(starts_on, ends_on, price_multiplier)")
    .eq("id", input.circuit_id)
    .single();
  if (circuitError || !circuit) return { ok: false, error: "Produit introuvable" };
  const c = circuit as any;
  const saleUnit: SaleUnit = isSaleUnit(c.sale_unit) ? c.sale_unit : "per_person";

  // Quantités normalisées selon l'unité de vente.
  const q = normalizeQuantity(saleUnit, {
    adults: input.adults,
    children: input.children,
    trips: input.trips,
    nights: input.nights,
    rooms: input.rooms,
    units: input.units,
  });
  if (!Number.isFinite(input.adults) || input.adults < 1) return { ok: false, error: "Au moins un adulte (ou passager) est requis." };
  if (!Number.isFinite(input.children) || input.children < 0) return { ok: false, error: "Nombre d'enfants invalide" };

  // Capacité (par départ : le cumul est contrôlé par l'allotement quand il existe).
  const pax = paxOf(q);
  const maxPax = Number(c.max_participants) || 0;
  if (maxPax > 0 && pax > maxPax) {
    return { ok: false, error: `Ce produit accepte au maximum ${maxPax} passagers.` };
  }

  // Prix brut — autorité unique lib/pricing.
  const multiplier = seasonMultiplier(input.departure_date, c.circuit_seasons);
  const gross = round2(
    computeLineTotal({
      saleUnit,
      basePriceMad: c.base_price_mad,
      childPriceMad: c.child_price_mad,
      multiplier,
      quantity: toLineQuantity(q),
    }),
  );
  if (c.pricing_mode === "on_request" && gross <= 0) {
    return { ok: false, error: "Ce produit est sur devis : fixez d'abord un prix sur la fiche produit." };
  }

  // Remise : montant OU pourcentage, motif obligatoire, strictement inférieure au brut.
  let discountMad = 0;
  let discountReason: DiscountReason | null = null;
  if (input.discount && Number(input.discount.value) > 0) {
    discountMad = discountAmount(input.discount.mode === "pct" ? "pct" : "mad", Number(input.discount.value), gross);
    if (discountMad > 0) {
      if (!isDiscountReason(input.discount.reason)) return { ok: false, error: "Le motif de la remise est obligatoire." };
      discountReason = input.discount.reason;
      if (discountMad >= gross) return { ok: false, error: "La remise doit rester inférieure au prix du dossier." };
    }
  }
  const total = round2(gross - discountMad);
  if (Math.abs(total - Number(input.total_amount_mad)) > 1) {
    console.warn(
      `[createReservation] Écart prix client/serveur — client=${input.total_amount_mad} serveur=${total} (produit ${input.circuit_id}, ${input.departure_date}). Valeur serveur retenue.`,
    );
  }

  // Encaissements annoncés : validés AVANT l'insert pour ne pas créer un dossier qu'on ne pourra pas solder proprement.
  const deposit = input.deposit && Number(input.deposit.amount) > 0 ? input.deposit : null;
  const credit = input.credit_note && Number(input.credit_note.amount) > 0 ? input.credit_note : null;
  if (deposit) {
    if (!isDepositMethod(deposit.method)) return { ok: false, error: "Mode d'encaissement de l'acompte invalide." };
    if (deposit.method === "transfer" && !clean(deposit.external_ref)) return { ok: false, error: "Le numéro de virement est obligatoire pour un acompte par virement." };
  }
  const collected = round2((deposit ? Number(deposit.amount) : 0) + (credit ? Number(credit.amount) : 0));
  if (collected - total > 0.01) return { ok: false, error: `Acompte + avoir (${collected.toFixed(2)} MAD) dépassent le total du dossier (${total.toFixed(2)} MAD).` };

  const bookingChannel = isBookingChannel(input.booking_channel) ? input.booking_channel : null;
  const intended = isIntendedChannel(input.intended_payment_channel) ? input.intended_payment_channel : null;

  // Profil transfert : vol + heure d'arrivée (le jour du transfert) ; profil hébergement : régime.
  const arrivalFlight = clean(input.arrival_flight_number)?.toUpperCase() ?? null;
  let arrivalAt: string | null = null;
  const arrivalTime = clean(input.arrival_time);
  if (arrivalTime) {
    if (!/^\d{2}:\d{2}$/.test(arrivalTime)) return { ok: false, error: "Heure d'arrivée invalide (HH:MM)." };
    const d = new Date(`${input.departure_date}T${arrivalTime}:00`);
    if (isNaN(d.getTime())) return { ok: false, error: "Heure d'arrivée invalide." };
    arrivalAt = d.toISOString();
  }
  const mealPlan = clean(input.meal_plan);
  if (mealPlan && !(mealPlan in MEAL_PLAN_LABEL)) return { ok: false, error: "Régime invalide." };

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      circuit_id: input.circuit_id,
      customer_id: input.customer_id,
      departure_date: input.departure_date,
      adults: q.adults,
      children: q.children,
      trips: q.trips,
      nights: q.nights,
      rooms: q.rooms,
      units: q.units,
      total_amount_mad: total,
      discount_mad: discountMad,
      discount_reason: discountReason,
      status: "pending",
      notes: clean(input.notes),
      booking_channel: bookingChannel,
      group_language: clean(input.group_language),
      special_requests: clean(input.special_requests),
      customer_note: clean(input.customer_note),
      intended_payment_channel: intended,
      arrival_flight_number: arrivalFlight,
      arrival_flight_at: arrivalAt,
      meal_plan: mealPlan,
    })
    .select("id, reference")
    .single();

  if (error || !data) {
    console.error("[createReservation] Supabase insert error:", error);
    return { ok: false, error: error?.message || "Erreur lors de la création" };
  }
  const id = data.id as string;
  const reference = data.reference as string;

  // --- Allotement : décompte du stock (inchangé). 'blocked'/'released' refusent et retirent le dossier.
  const stock = await consumeAllotment(supabase, {
    productId: input.circuit_id,
    day: input.departure_date,
    qty: pax,
    reservationId: id,
    reason: "booking",
  });
  if (stock.kind === "outcome" && (stock.outcome === "blocked" || stock.outcome === "released")) {
    // Compensation via service-role : pas de policy DELETE staff sur reservations.
    await createAdminClient().from("reservations").delete().eq("id", id);
    return { ok: false, error: stock.outcome === "blocked" ? blockedMessage(stock.remaining) : RELEASED_MESSAGE };
  }
  if (stock.kind === "unavailable") {
    console.error(`[createReservation] contrôle d'allotement indisponible — dossier ${reference} créé sans décompte :`, stock.error);
  }

  // --- Étapes post-création : le dossier existe, on remonte ce qui n'a pas abouti.
  const followups: string[] = [];

  // Coût prévisionnel FIGÉ à la vente (tarif d'achat résolu ou coût interne). Un
  // échec n'est pas bloquant : la carte Marge dira « non renseigné » et pourquoi.
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  const cost = await computeAndStoreExpectedCost(supabase, id, { actorId: actor?.id ?? null });
  if (!cost.ok && cost.code !== "no_rate") console.warn(`[createReservation] coût prévisionnel non figé (${reference}) :`, cost.reason);

  if (deposit) {
    const fd = new FormData();
    fd.set("method", deposit.method);
    fd.set("amount_mad", String(round2(Number(deposit.amount))));
    if (deposit.external_ref) fd.set("external_ref", deposit.external_ref.trim());
    const res = await addPayment(id, null, fd);
    if (!res.ok) followups.push(`Acompte non enregistré (${res.error}) — saisissez-le dans la carte Paiements.`);
  }

  if (credit) {
    const { error: cnErr } = await supabase.rpc("apply_credit_note", {
      p_credit_note_id: credit.id,
      p_reservation_id: id,
      p_amount: round2(Number(credit.amount)),
    });
    if (cnErr) {
      followups.push(`Avoir non appliqué (${cnErr.message}) — utilisez l'onglet Avoir de la carte Paiements.`);
    } else {
      await autoConfirmOnPayment(supabase, id); // Demande → Confirmée si l'avoir est le premier encaissement.
    }
  }

  let linkUrl: string | null = null;
  if (input.send_link) {
    const link = await createPaymentLink(id);
    if (link.ok) linkUrl = link.url;
    else followups.push(`Lien de paiement non généré (${link.error}) — générez-le depuis la carte Paiements.`);
  }

  const { data: after } = await supabase.from("reservations").select("status").eq("id", id).single();

  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/reservations/${id}`);
  revalidatePath("/admin");

  return {
    ok: true,
    id,
    reference,
    onRequest: stock.kind === "outcome" && stock.outcome === "on_request",
    status: ((after as any)?.status as string) ?? "pending",
    followups,
    linkUrl,
  };
}
