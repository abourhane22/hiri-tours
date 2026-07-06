"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  | { ok: true; id: string; reference: string }
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
  const { data, error } = await supabase
    .from("reservations")
    .insert({
      circuit_id: input.circuit_id,
      customer_id: input.customer_id,
      departure_date: input.departure_date,
      adults: input.adults,
      children: input.children,
      total_amount_mad: input.total_amount_mad,
      status: input.status,
      notes: trimmedNotes,
    })
    .select("id, reference")
    .single();

  if (error || !data) {
    console.error("[createReservation] Supabase insert error:", error);
    return { ok: false, error: error?.message || "Erreur lors de la création" };
  }

  revalidatePath("/admin/reservations");
  revalidatePath("/admin");

  return { ok: true, id: data.id as string, reference: data.reference as string };
}
