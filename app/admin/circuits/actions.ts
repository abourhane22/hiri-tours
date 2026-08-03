"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  parseCategoryFieldsFromForm,
  deriveLegacyColumns,
  type AnyCategoryFields,
} from "@/lib/category-fields";
import type { CircuitCategory } from "@/lib/types";

export type CircuitActionState = { ok: true } | { ok: false; error: string };

const VALID_CATEGORIES: readonly CircuitCategory[] = [
  "circuit",
  "excursion",
  "transfert",
  "sejour",
];

/**
 * Construit le payload circuit depuis le FormData (validations Lot A/B).
 * Retourne { error } au lieu de lever, pour affichage inline via useActionState.
 */
function buildCircuitPayload(
  formData: FormData,
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  const category = formData.get("category") as CircuitCategory;
  if (!VALID_CATEGORIES.includes(category)) {
    return { ok: false, error: "Catégorie invalide." };
  }

  const title = ((formData.get("title") as string) || "").trim();
  if (!title) return { ok: false, error: "Le titre est obligatoire." };

  const slug = ((formData.get("slug") as string) || "").trim().toLowerCase();
  if (!slug) return { ok: false, error: "Le slug est obligatoire." };

  const basePrice = parseFloat(formData.get("base_price_mad") as string);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return { ok: false, error: "Le prix adulte doit être un nombre supérieur à 0." };
  }

  const maxParticipants = parseInt(formData.get("max_participants") as string, 10);
  if (!Number.isInteger(maxParticipants) || maxParticipants <= 0) {
    return { ok: false, error: "Le nombre maximum de participants doit être un entier supérieur à 0." };
  }

  const parsed = parseCategoryFieldsFromForm(category, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const legacy = deriveLegacyColumns(category, parsed.fields as AnyCategoryFields);

  let galleryUrls: string[] = [];
  try {
    const raw = formData.get("gallery_urls") as string;
    if (raw) galleryUrls = JSON.parse(raw);
  } catch {}

  return {
    ok: true,
    payload: {
      slug,
      title,
      category,
      short_description: formData.get("short_description") as string,
      description: formData.get("description") as string,
      base_price_mad: basePrice,
      child_price_mad: formData.get("child_price_mad")
        ? parseFloat(formData.get("child_price_mad") as string)
        : null,
      max_participants: maxParticipants,
      hero_image_url: formData.get("hero_image_url") as string,
      gallery_urls: galleryUrls.length > 0 ? galleryUrls : null,
      // Itinéraire : source de vérité = category_fields.itinerary (répéteur).
      // Colonne legacy `itinerary` volontairement non écrite.
      is_active: formData.get("is_active") === "on",
      category_fields: parsed.fields,
      duration_days: legacy.duration_days,
      duration_hours: legacy.duration_hours,
      meeting_point: legacy.meeting_point,
    },
  };
}

export async function createCircuit(
  _prev: CircuitActionState,
  formData: FormData,
): Promise<CircuitActionState> {
  const built = buildCircuitPayload(formData);
  if (!built.ok) return built;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("circuits")
    .insert(built.payload)
    .select("id")
    .single();
  if (error || !data) {
    console.error("[createCircuit] insert error:", error);
    return { ok: false, error: error?.message || "Erreur lors de la création." };
  }

  revalidatePath("/admin/circuits");
  redirect(`/admin/circuits/${data.id}`);
}

export async function updateCircuit(
  id: string,
  _prev: CircuitActionState,
  formData: FormData,
): Promise<CircuitActionState> {
  const built = buildCircuitPayload(formData);
  if (!built.ok) return built;

  const supabase = await createClient();
  const { error } = await supabase.from("circuits").update(built.payload).eq("id", id);
  if (error) {
    console.error("[updateCircuit] update error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/circuits");
  revalidatePath(`/admin/circuits/${id}`);
  redirect("/admin/circuits");
}

/**
 * Supprime un circuit — refuse si des réservations le référencent.
 * Redirige vers le catalogue en cas de succès, renvoie une erreur sinon.
 */
export async function deleteCircuit(
  id: string,
): Promise<{ ok: false; error: string }> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("circuit_id", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Suppression impossible : ${count} réservation(s) utilisent ce circuit. Désactivez-le plutôt pour le retirer de la vente.`,
    };
  }

  const { error } = await supabase.from("circuits").delete().eq("id", id);
  if (error) {
    // Filet de sécurité (course : réservation créée entre le comptage et le delete).
    console.error("[deleteCircuit] delete error:", error);
    return {
      ok: false,
      error:
        "Suppression impossible : ce circuit est référencé par des réservations. Désactivez-le plutôt pour le retirer de la vente.",
    };
  }

  revalidatePath("/admin/circuits");
  redirect("/admin/circuits");
}

/** Désactive un circuit (le retire de la vente sans le supprimer). */
export async function deactivateCircuit(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("circuits")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/circuits/${id}`);
  revalidatePath("/admin/circuits");
}

export async function createSeason(circuitId: string, formData: FormData) {
  const name = ((formData.get("name") as string) || "").trim();
  const startsOn = formData.get("starts_on") as string;
  const endsOn = formData.get("ends_on") as string;
  const multiplier = parseFloat(formData.get("price_multiplier") as string);

  if (!name || !startsOn || !endsOn || isNaN(multiplier)) {
    throw new Error("Tous les champs sont obligatoires");
  }
  if (multiplier <= 0) throw new Error("Le multiplicateur doit être positif");
  if (startsOn > endsOn) throw new Error("La date de fin doit être après la date de début");

  const supabase = await createClient();
  const { error } = await supabase.from("circuit_seasons").insert({
    circuit_id: circuitId,
    name,
    starts_on: startsOn,
    ends_on: endsOn,
    price_multiplier: multiplier,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/circuits/${circuitId}`);
}

export async function deleteSeason(circuitId: string, seasonId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("circuit_seasons").delete().eq("id", seasonId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/circuits/${circuitId}`);
}
