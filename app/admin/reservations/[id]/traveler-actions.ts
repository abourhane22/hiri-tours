"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { foldAccents } from "@/lib/utils";
import type { TravelerType } from "@/lib/types";

// `savedAt` change à chaque succès : le formulaire client s'en sert pour se
// refermer (useActionState ne signale pas autrement une soumission réussie).
export type TravelerActionState = { ok: true; savedAt?: number } | { ok: false; error: string };

/**
 * Contexte commun : session staff + dossier lisible (RLS) + dossier non annulé.
 * Un utilisateur non-staff ne voit pas la réservation → « introuvable »,
 * jamais de détail sur l'existence du dossier.
 */
async function staffContext(reservationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Session expirée — reconnectez-vous." };

  const { data: resa } = await supabase
    .from("reservations")
    .select("id, status, adults, children, customers(full_name, country)")
    .eq("id", reservationId)
    .single();
  if (!resa) return { ok: false as const, error: "Réservation introuvable." };
  if ((resa as any).status === "cancelled") {
    return { ok: false as const, error: "Dossier annulé — les voyageurs ne sont plus modifiables." };
  }
  return { ok: true as const, supabase, resa: resa as any };
}

function readTravelerFields(formData: FormData): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const fullName = ((formData.get("full_name") as string) || "").trim();
  const type = ((formData.get("traveler_type") as string) || "adult") as TravelerType;
  const dob = ((formData.get("date_of_birth") as string) || "").trim();
  const nationality = ((formData.get("nationality") as string) || "").trim();
  const passport = ((formData.get("passport_number") as string) || "").trim();
  const notes = ((formData.get("notes") as string) || "").trim();

  if (!fullName) return { ok: false, error: "Le nom du voyageur est obligatoire." };
  if (type !== "adult" && type !== "child") return { ok: false, error: "Type de voyageur invalide." };
  if (dob) {
    const d = new Date(dob);
    if (isNaN(d.getTime())) return { ok: false, error: "Date de naissance invalide." };
    if (d.getTime() > Date.now()) return { ok: false, error: "La date de naissance ne peut pas être dans le futur." };
  }

  // Exigés par les distributeurs aériens (Duffel) à l'émission — facultatifs ailleurs.
  const genderRaw = ((formData.get("gender") as string) || "").trim();
  if (genderRaw && genderRaw !== "m" && genderRaw !== "f") return { ok: false, error: "Genre invalide." };
  const passportExpires = ((formData.get("passport_expires_on") as string) || "").trim();
  if (passportExpires) {
    const d = new Date(passportExpires);
    if (isNaN(d.getTime())) return { ok: false, error: "Date d'expiration du passeport invalide." };
  }

  return {
    ok: true,
    data: {
      full_name: fullName,
      traveler_type: type,
      date_of_birth: dob || null,
      nationality: nationality || null,
      passport_number: passport || null,
      gender: genderRaw || null,
      passport_expires_on: passportExpires || null,
      notes: notes || null,
    },
  };
}

function revalidate(reservationId: string) {
  revalidatePath(`/admin/reservations/${reservationId}`);
  revalidatePath(`/admin/reservations/${reservationId}/voucher`);
  revalidatePath("/admin/manifestes", "layout");
}

export async function addTraveler(
  reservationId: string,
  _prev: TravelerActionState,
  formData: FormData,
): Promise<TravelerActionState> {
  const ctx = await staffContext(reservationId);
  if (!ctx.ok) return ctx;
  const fields = readTravelerFields(formData);
  if (!fields.ok) return fields;

  const { error } = await ctx.supabase
    .from("reservation_travelers")
    .insert({ reservation_id: reservationId, ...fields.data });
  if (error) {
    console.error("[addTraveler]", error);
    return { ok: false, error: "Impossible d'enregistrer le voyageur." };
  }
  revalidate(reservationId);
  return { ok: true, savedAt: Date.now() };
}

export async function updateTraveler(
  reservationId: string,
  travelerId: string,
  _prev: TravelerActionState,
  formData: FormData,
): Promise<TravelerActionState> {
  const ctx = await staffContext(reservationId);
  if (!ctx.ok) return ctx;
  const fields = readTravelerFields(formData);
  if (!fields.ok) return fields;

  // Double filtre id + reservation_id : un id ne peut pas viser un autre dossier.
  const { error } = await ctx.supabase
    .from("reservation_travelers")
    .update(fields.data)
    .eq("id", travelerId)
    .eq("reservation_id", reservationId);
  if (error) {
    console.error("[updateTraveler]", error);
    return { ok: false, error: "Impossible de modifier le voyageur." };
  }
  revalidate(reservationId);
  return { ok: true, savedAt: Date.now() };
}

export async function deleteTraveler(reservationId: string, travelerId: string): Promise<TravelerActionState> {
  const ctx = await staffContext(reservationId);
  if (!ctx.ok) return ctx;

  const { error } = await ctx.supabase
    .from("reservation_travelers")
    .delete()
    .eq("id", travelerId)
    .eq("reservation_id", reservationId);
  if (error) {
    console.error("[deleteTraveler]", error);
    return { ok: false, error: "Impossible de supprimer le voyageur." };
  }
  revalidate(reservationId);
  return { ok: true, savedAt: Date.now() };
}

/** Raccourci : le client payeur devient voyageur (adulte), nom + nationalité pré-remplis. */
export async function addPayerAsTraveler(reservationId: string): Promise<TravelerActionState> {
  const ctx = await staffContext(reservationId);
  if (!ctx.ok) return ctx;

  const customer = Array.isArray(ctx.resa.customers) ? ctx.resa.customers[0] : ctx.resa.customers;
  const fullName = (customer?.full_name || "").trim();
  if (!fullName) return { ok: false, error: "Aucun client payeur associé à ce dossier." };

  // Idempotent : pas de doublon si un voyageur du même nom existe déjà.
  const { data: existing } = await ctx.supabase
    .from("reservation_travelers")
    .select("full_name")
    .eq("reservation_id", reservationId);
  const target = foldAccents(fullName);
  if ((existing ?? []).some((t: any) => foldAccents(t.full_name) === target)) {
    return { ok: false, error: `${fullName} figure déjà parmi les voyageurs.` };
  }

  const { error } = await ctx.supabase.from("reservation_travelers").insert({
    reservation_id: reservationId,
    full_name: fullName,
    traveler_type: "adult",
    nationality: customer?.country || null,
  });
  if (error) {
    console.error("[addPayerAsTraveler]", error);
    return { ok: false, error: "Impossible d'ajouter le client payeur." };
  }
  revalidate(reservationId);
  return { ok: true, savedAt: Date.now() };
}
