"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCategory(formData: FormData) {
  const name = ((formData.get("name") as string) || "").trim();
  const type = (formData.get("type") as string) || "direct";
  const description = ((formData.get("description") as string) || "").trim() || null;
  if (!name) throw new Error("Le nom est obligatoire");
  const supabase = await createClient();
  const { error } = await supabase.from("cost_categories").insert({ name, type, description });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/categories");
  redirect("/admin/finance/categories");
}

export async function toggleCategory(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("cost_categories").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/categories");
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("expenses").select("*", { count: "exact", head: true }).eq("category_id", id);
  if ((count ?? 0) > 0) throw new Error(`Impossible : ${count} dépense(s) utilisent cette catégorie. Désactivez-la plutôt.`);
  const { error } = await supabase.from("cost_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/categories");
  redirect("/admin/finance/categories");
}
