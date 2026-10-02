"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { foldAccents } from "@/lib/utils";
import { getDossierProfile } from "@/lib/dossier-profile";
import { CUSTOMER_IDENTITY_COLUMNS, customerFieldsFromTraveler, travelerFieldsFromCustomer } from "@/lib/traveler-identity";
import type { TravelerType } from "@/lib/types";

// `savedAt` change à chaque succès : le formulaire client s'en sert pour se
// refermer (useActionState ne signale pas autrement une soumission réussie).
export type TravelerActionState = { ok: true; savedAt?: number; message?: string } | { ok: false; error: string; field?: string | null };

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
    .select(`id, status, adults, children, customer_id, circuits(category, identity_documents_required), customers(id, full_name, ${CUSTOMER_IDENTITY_COLUMNS})`)
    .eq("id", reservationId)
    .single();
  if (!resa) return { ok: false as const, error: "Réservation introuvable." };
  if ((resa as any).status === "cancelled") {
    return { ok: false as const, error: "Dossier annulé — les voyageurs ne sont plus modifiables." };
  }
  return { ok: true as const, supabase, resa: resa as any };
}

function readTravelerFields(formData: FormData): { ok: true; data: Record<string, unknown> } | { ok: false; error: string; field?: string | null } {
  const fullName = ((formData.get("full_name") as string) || "").trim();
  const type = ((formData.get("traveler_type") as string) || "adult") as TravelerType;
  const dob = ((formData.get("date_of_birth") as string) || "").trim();
  const nationality = ((formData.get("nationality") as string) || "").trim();
  const passport = ((formData.get("passport_number") as string) || "").trim();
  const notes = ((formData.get("notes") as string) || "").trim();

  if (!fullName) return { ok: false, error: "Le nom du voyageur est obligatoire.", field: "full_name" };
  if (type !== "adult" && type !== "child") return { ok: false, error: "Type de voyageur invalide.", field: "traveler_type" };
  if (dob) {
    const d = new Date(dob);
    if (isNaN(d.getTime())) return { ok: false, error: "Date de naissance invalide.", field: "date_of_birth" };
    if (d.getTime() > Date.now()) return { ok: false, error: "La date de naissance ne peut pas être dans le futur.", field: "date_of_birth" };
  }

  // Exigés par les distributeurs aériens (Duffel) à l'émission — facultatifs ailleurs.
  const genderRaw = ((formData.get("gender") as string) || "").trim();
  if (genderRaw && genderRaw !== "m" && genderRaw !== "f") return { ok: false, error: "Genre invalide.", field: "gender" };
  const passportExpires = ((formData.get("passport_expires_on") as string) || "").trim();
  if (passportExpires) {
    const d = new Date(passportExpires);
    if (isNaN(d.getTime())) return { ok: false, error: "Date d'expiration du passeport invalide.", field: "passport_expires_on" };
  }
  // Type de la pièce (cin | passeport). Champ absent du formulaire (profil sans pièce) ⇒ inchangé.
  const docTypeRaw = formData.has("id_document_type") ? ((formData.get("id_document_type") as string) || "").trim() : undefined;
  if (docTypeRaw && docTypeRaw !== "cin" && docTypeRaw !== "passeport") return { ok: false, error: "Type de pièce invalide.", field: "id_document_type" };

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
      ...(docTypeRaw !== undefined ? { id_document_type: docTypeRaw || null } : {}),
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
  return { ok: true, savedAt: Date.now(), message: "Voyageur ajouté" };
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

  // Sens inverse : le voyageur est le client payeur et la case est cochée → les champs SAISIS
  // sont recopiés sur la fiche client (copie : les autres dossiers ne changent pas).
  if (formData.get("save_to_customer") === "on") {
    const { data: trav } = await ctx.supabase.from("reservation_travelers").select("is_payer").eq("id", travelerId).maybeSingle();
    const customerId = ctx.resa.customer_id as string | null;
    if ((trav as { is_payer?: boolean } | null)?.is_payer && customerId) {
      const patch = customerFieldsFromTraveler(fields.data as Record<string, string | null>);
      if (Object.keys(patch).length > 0) {
        const { error: cErr } = await ctx.supabase.from("customers").update(patch).eq("id", customerId);
        if (cErr) {
          console.error("[updateTraveler] fiche client :", cErr);
          revalidate(reservationId);
          return { ok: false, error: "Voyageur enregistré, mais la fiche client n'a pas pu être complétée." };
        }
        revalidatePath(`/admin/clients/${customerId}`);
        revalidate(reservationId);
        return { ok: true, savedAt: Date.now(), message: "Voyageur mis à jour · fiche client complétée" };
      }
    }
  }
  revalidate(reservationId);
  return { ok: true, savedAt: Date.now(), message: "Voyageur mis à jour" };
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
  return { ok: true, savedAt: Date.now(), message: "Voyageur retiré" };
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

  // Copie (jamais lien) de l'identité de la fiche client, limitée à ce que le profil exige.
  // Nationalité = customers.nationality, jamais le pays de résidence.
  const product = Array.isArray(ctx.resa.circuits) ? ctx.resa.circuits[0] : ctx.resa.circuits;
  const profile = getDossierProfile(product);
  const { error } = await ctx.supabase.from("reservation_travelers").insert({
    reservation_id: reservationId,
    full_name: fullName,
    traveler_type: "adult",
    is_payer: true,
    ...travelerFieldsFromCustomer(customer, profile),
  });
  if (error) {
    console.error("[addPayerAsTraveler]", error);
    return { ok: false, error: "Impossible d'ajouter le client payeur." };
  }
  revalidate(reservationId);
  return { ok: true, savedAt: Date.now(), message: "Client payeur ajouté aux voyageurs" };
}
