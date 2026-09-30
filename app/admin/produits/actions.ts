"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { flashSuccess } from "@/lib/flash";
import type { FormFeedback } from "@/lib/flash-shared";
import {
  parseCategoryFieldsFromForm,
  deriveLegacyColumns,
  type AnyCategoryFields,
} from "@/lib/category-fields";
import { isSaleUnit } from "@/lib/pricing";
import type { CircuitCategory, PricingMode } from "@/lib/types";

export type CircuitActionState = { ok: true } | { ok: false; error: string; field?: string | null };

const VALID_CATEGORIES: readonly CircuitCategory[] = [
  "circuit",
  "excursion",
  "transfert",
  "sejour",
  "hebergement",
  "billetterie",
  "prestation",
];

/** Violation d'unicité du slug → message métier (champ slug). */
function slugConflict(error: { code?: string; message?: string } | null | undefined): string | null {
  if (error?.code === "23505" && /slug/i.test(error.message ?? "")) return "Ce slug est déjà utilisé par un autre produit.";
  return null;
}

/**
 * Construit le payload circuit depuis le FormData (validations Lot A/B).
 * Retourne { error } au lieu de lever, pour affichage inline via useActionState.
 */
function buildCircuitPayload(
  formData: FormData,
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string; field?: string | null } {
  const category = formData.get("category") as CircuitCategory;
  if (!VALID_CATEGORIES.includes(category)) {
    return { ok: false, error: "Catégorie invalide.", field: "category" };
  }

  const title = ((formData.get("title") as string) || "").trim();
  if (!title) return { ok: false, error: "Le titre est obligatoire.", field: "title" };

  const slug = ((formData.get("slug") as string) || "").trim().toLowerCase();
  if (!slug) return { ok: false, error: "Le slug est obligatoire.", field: "slug" };

  const basePrice = parseFloat(formData.get("base_price_mad") as string);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return { ok: false, error: "Le prix adulte doit être un nombre supérieur à 0.", field: "base_price_mad" };
  }

  const maxParticipants = parseInt(formData.get("max_participants") as string, 10);
  if (!Number.isInteger(maxParticipants) || maxParticipants <= 0) {
    return { ok: false, error: "Le nombre maximum de participants doit être un entier supérieur à 0.", field: "max_participants" };
  }

  // Unité de vente : détermine la formule de prix (lib/pricing.ts).
  const saleUnitRaw = formData.get("sale_unit");
  if (!isSaleUnit(saleUnitRaw)) {
    return { ok: false, error: "Unité de vente invalide.", field: "sale_unit" };
  }
  const pricingModeRaw = (formData.get("pricing_mode") as string) || "fixed";
  if (pricingModeRaw !== "fixed" && pricingModeRaw !== "on_request") {
    return { ok: false, error: "Mode de tarification invalide.", field: "pricing_mode" };
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
      identity_documents_required: formData.get("identity_documents_required") === "on",
      internal_unit_cost_mad: formData.get("internal_unit_cost_mad") ? parseFloat(formData.get("internal_unit_cost_mad") as string) : null,
      internal_child_cost_mad: formData.get("internal_child_cost_mad") ? parseFloat(formData.get("internal_child_cost_mad") as string) : null,
      sale_unit: saleUnitRaw,
      pricing_mode: pricingModeRaw as PricingMode,
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
    return { ok: false, error: slugConflict(error) ?? `Produit non créé : ${error?.message || "erreur inconnue"}`, field: slugConflict(error) ? "slug" : null };
  }

  revalidatePath("/admin/produits");
  await flashSuccess("Produit créé");
  redirect(`/admin/produits/${data.id}`);
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
    return { ok: false, error: slugConflict(error) ?? `Produit non enregistré : ${error.message}`, field: slugConflict(error) ? "slug" : null };
  }

  revalidatePath("/admin/produits");
  revalidatePath(`/admin/produits/${id}`);
  await flashSuccess("Produit enregistré");
  redirect("/admin/produits");
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

  revalidatePath("/admin/produits");
  await flashSuccess("Produit supprimé");
  redirect("/admin/produits");
}

/** Désactive un circuit (le retire de la vente sans le supprimer). */
export async function deactivateCircuit(id: string): Promise<FormFeedback> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("circuits")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { ok: false, error: `Produit non désactivé : ${error.message}` };

  revalidatePath(`/admin/produits/${id}`);
  revalidatePath("/admin/produits");
  return { ok: true, message: "Produit désactivé — retiré de la vente" };
}

// Résultat typé (jamais d'exception : en production, Next.js masque le message d'une erreur levée).
export async function createSeason(circuitId: string, formData: FormData): Promise<FormFeedback> {
  const name = ((formData.get("name") as string) || "").trim();
  const startsOn = formData.get("starts_on") as string;
  const endsOn = formData.get("ends_on") as string;
  const multiplier = parseFloat(formData.get("price_multiplier") as string);

  if (!name) return { ok: false, error: "Le nom de la période est obligatoire.", field: "name" };
  if (!startsOn) return { ok: false, error: "La date de début est obligatoire.", field: "starts_on" };
  if (!endsOn) return { ok: false, error: "La date de fin est obligatoire.", field: "ends_on" };
  if (isNaN(multiplier) || multiplier <= 0) return { ok: false, error: "Le multiplicateur doit être un nombre positif.", field: "price_multiplier" };
  if (startsOn > endsOn) return { ok: false, error: "La date de fin doit être après la date de début.", field: "ends_on" };

  const supabase = await createClient();
  const { error } = await supabase.from("circuit_seasons").insert({
    circuit_id: circuitId,
    name,
    starts_on: startsOn,
    ends_on: endsOn,
    price_multiplier: multiplier,
  });
  if (error) return { ok: false, error: `Période non créée : ${error.message}` };

  revalidatePath(`/admin/produits/${circuitId}`);
  return { ok: true, message: `Période « ${name} » créée` };
}

export async function deleteSeason(circuitId: string, seasonId: string): Promise<FormFeedback> {
  const supabase = await createClient();
  const { error } = await supabase.from("circuit_seasons").delete().eq("id", seasonId);
  if (error) return { ok: false, error: `Période non supprimée : ${error.message}` };
  revalidatePath(`/admin/produits/${circuitId}`);
  return { ok: true, message: "Période supprimée" };
}
