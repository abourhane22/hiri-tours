"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parsePayload(formData: FormData) {
  return {
    registration: ((formData.get("registration") as string) || "").trim().toUpperCase(),
    make: ((formData.get("make") as string) || "").trim() || null,
    model: ((formData.get("model") as string) || "").trim() || null,
    type: (formData.get("type") as string) || "van",
    capacity: parseInt(formData.get("capacity") as string, 10) || 4,
    color: ((formData.get("color") as string) || "").trim() || null,
    notes: ((formData.get("notes") as string) || "").trim() || null,
    is_active: formData.get("is_active") === "on",
  };
}

export async function createVehicle(formData: FormData) {
  const payload = parsePayload(formData);
  if (!payload.registration) throw new Error("L'immatriculation est obligatoire");
  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/logistique/vehicules");
  redirect("/admin/logistique/vehicules");
}

export async function updateVehicle(id: string, formData: FormData) {
  const payload = parsePayload(formData);
  if (!payload.registration) throw new Error("L'immatriculation est obligatoire");
  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/logistique/vehicules");
  redirect("/admin/logistique/vehicules");
}

export async function deleteVehicle(id: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("reservations").select("*", { count: "exact", head: true }).eq("vehicle_id", id);
  if ((count ?? 0) > 0) throw new Error(`Impossible de supprimer : ${count} réservation(s) utilisent ce véhicule. Désactivez-le plutôt.`);
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/logistique/vehicules");
  redirect("/admin/logistique/vehicules");
}
