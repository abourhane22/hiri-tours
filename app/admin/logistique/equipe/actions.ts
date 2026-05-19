"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parsePayload(formData: FormData) {
  let languages: string[] = [];
  try {
    const raw = formData.get("languages") as string;
    if (raw) languages = JSON.parse(raw);
  } catch {}

  let documents: unknown[] = [];
  try {
    const raw = formData.get("documents") as string;
    if (raw) documents = JSON.parse(raw);
  } catch {}

  return {
    full_name: ((formData.get("full_name") as string) || "").trim(),
    role: (formData.get("role") as string) || "guide",
    phone: ((formData.get("phone") as string) || "").trim() || null,
    email: ((formData.get("email") as string) || "").trim() || null,
    languages: languages.length > 0 ? languages : null,
    documents: documents.length > 0 ? documents : null,
    notes: ((formData.get("notes") as string) || "").trim() || null,
    is_active: formData.get("is_active") === "on",
  };
}

export async function createStaff(formData: FormData) {
  const payload = parsePayload(formData);
  if (!payload.full_name) throw new Error("Le nom complet est obligatoire");
  const supabase = await createClient();
  const { error } = await supabase.from("staff_members").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/logistique/equipe");
  redirect("/admin/logistique/equipe");
}

export async function updateStaff(id: string, formData: FormData) {
  const payload = parsePayload(formData);
  if (!payload.full_name) throw new Error("Le nom complet est obligatoire");
  const supabase = await createClient();
  const { error } = await supabase.from("staff_members").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/logistique/equipe");
  redirect("/admin/logistique/equipe");
}

export async function deleteStaff(id: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("reservations").select("*", { count: "exact", head: true }).or(`guide_id.eq.${id},driver_id.eq.${id}`);
  if ((count ?? 0) > 0) throw new Error(`Impossible de supprimer : ${count} réservation(s) lui sont assignées. Désactivez-le plutôt.`);
  const { error } = await supabase.from("staff_members").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/logistique/equipe");
  redirect("/admin/logistique/equipe");
}
