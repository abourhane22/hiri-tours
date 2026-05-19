"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
