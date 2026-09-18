"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { seasonMultiplier, computeLineTotal, isSaleUnit } from "@/lib/pricing";
import { consumeAllotment, blockedMessage, RELEASED_MESSAGE } from "@/lib/allotments";

export type CreateReservationInput = {
  circuit_id: string;
  customer_id: string;
  departure_date: string;
  adults: number;
  children: number;
  total_amount_mad: number;
  status: string;
  notes: string;
};

export type CreateReservationResult =
  | { ok: true; id: string; reference: string; onRequest: boolean }
  | { ok: false; error: string };

export async function createReservation(
  input: CreateReservationInput,
): Promise<CreateReservationResult> {
  if (!input.circuit_id) return { ok: false, error: "Circuit manquant" };
  if (!input.customer_id) return { ok: false, error: "Client manquant" };
  if (!input.departure_date) return { ok: false, error: "Date de départ manquante" };

  const trimmedNotes = (input.notes || "").trim();
  if (!trimmedNotes) {
    return { ok: false, error: "Les notes internes sont obligatoires" };
  }

  if (!Number.isFinite(input.adults) || input.adults < 1) {
    return { ok: false, error: "Nombre d'adultes invalide" };
  }
  if (!Number.isFinite(input.children) || input.children < 0) {
    return { ok: false, error: "Nombre d'enfants invalide" };
  }

  const supabase = await createClient();

  // Recharge le circuit (prix + saisons + capacité) — jamais confiance au client.
  const { data: circuit, error: circuitError } = await supabase
    .from("circuits")
    .select("base_price_mad, child_price_mad, max_participants, sale_unit, circuit_seasons(starts_on, ends_on, price_multiplier)")
    .eq("id", input.circuit_id)
    .single();

  if (circuitError || !circuit) {
    return { ok: false, error: "Circuit introuvable" };
  }
  const c = circuit as any;

  // A2 — capacité
  const pax = input.adults + input.children;
  const maxPax = Number(c.max_participants) || 0;
  if (maxPax > 0 && pax > maxPax) {
    return { ok: false, error: `Ce circuit accepte au maximum ${maxPax} passagers.` };
  }

  // A1 — recalcul serveur du total (le montant client sert de contrôle),
  // aiguillé sur l'unité de vente du produit.
  const multiplier = seasonMultiplier(input.departure_date, c.circuit_seasons);
  const serverTotal = computeLineTotal({
    saleUnit: isSaleUnit(c.sale_unit) ? c.sale_unit : "per_person",
    basePriceMad: c.base_price_mad,
    childPriceMad: c.child_price_mad,
    multiplier,
    quantity: { adults: input.adults, children: input.children, trips: 1, nights: 1, rooms: 1, units: 1 },
  });
  if (Math.abs(serverTotal - Number(input.total_amount_mad)) > 1) {
    console.warn(
      `[createReservation] Écart prix client/serveur — client=${input.total_amount_mad} serveur=${serverTotal} (circuit ${input.circuit_id}, ${input.departure_date}). Valeur serveur retenue.`,
    );
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      circuit_id: input.circuit_id,
      customer_id: input.customer_id,
      departure_date: input.departure_date,
      adults: input.adults,
      children: input.children,
      total_amount_mad: serverTotal,
      status: input.status,
      notes: trimmedNotes,
    })
    .select("id, reference")
    .single();

  if (error || !data) {
    console.error("[createReservation] Supabase insert error:", error);
    return { ok: false, error: error?.message || "Erreur lors de la création" };
  }

  // --- Allotement : décompte du stock (session staff → RLS ok) ---
  // Même logique que le tunnel : 'blocked'/'released' refusent et retirent le
  // dossier ; 'no_allotment' et 'unavailable' laissent passer.
  const stock = await consumeAllotment(supabase, {
    productId: input.circuit_id,
    day: input.departure_date,
    qty: pax,
    reservationId: data.id as string,
    reason: "booking",
  });
  if (stock.kind === "outcome" && (stock.outcome === "blocked" || stock.outcome === "released")) {
    // Compensation : le schéma versionné n'a pas de policy DELETE sur
    // reservations pour le staff — la session verrait un DELETE ignoré en
    // silence. On passe par le service-role pour cette seule opération.
    await createAdminClient().from("reservations").delete().eq("id", data.id as string);
    return {
      ok: false,
      error: stock.outcome === "blocked" ? blockedMessage(stock.remaining) : RELEASED_MESSAGE,
    };
  }
  if (stock.kind === "unavailable") {
    console.error(
      `[createReservation] contrôle d'allotement indisponible — dossier ${data.reference} créé sans décompte :`,
      stock.error,
    );
  }

  revalidatePath("/admin/reservations");
  revalidatePath("/admin");

  return {
    ok: true,
    id: data.id as string,
    reference: data.reference as string,
    onRequest: stock.kind === "outcome" && stock.outcome === "on_request",
  };
}
