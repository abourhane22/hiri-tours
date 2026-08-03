"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
