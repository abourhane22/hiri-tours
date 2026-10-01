"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ActionError, formAction } from "@/lib/flash";

export async function createCategory(formData: FormData) {
  return formAction("Catégorie créée", async () => {
    const name = ((formData.get("name") as string) || "").trim();
    const type = (formData.get("type") as string) || "direct";
    const description = ((formData.get("description") as string) || "").trim() || null;
    if (!name) throw new ActionError("Le nom est obligatoire.", "name");
    const supabase = await createClient();
    const { error } = await supabase.from("cost_categories").insert({ name, type, description });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/finance/categories");
    return "/admin/finance/categories";
  });
}

export async function toggleCategory(id: string, isActive: boolean) {
  return formAction((isActive ? "Catégorie désactivée" : "Catégorie activée"), async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("cost_categories").update({ is_active: !isActive }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/finance/categories");
  });
}

export async function deleteCategory(id: string) {
  return formAction("Catégorie supprimée", async () => {
    const supabase = await createClient();
    const { count } = await supabase.from("expenses").select("*", { count: "exact", head: true }).eq("category_id", id);
    if ((count ?? 0) > 0) throw new Error(`Impossible : ${count} dépense(s) utilisent cette catégorie. Désactivez-la plutôt.`);
    const { error } = await supabase.from("cost_categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/finance/categories");
    return "/admin/finance/categories";
  });
}

/** Nom et description (texte d'aide affiché sous le champ Catégorie du formulaire de dépense). */
export async function updateCategory(id: string, formData: FormData) {
  return formAction("Catégorie mise à jour", async () => {
    const name = ((formData.get("name") as string) || "").trim();
    const description = ((formData.get("description") as string) || "").trim() || null;
    if (!name) throw new ActionError("Le nom est obligatoire.", "name");
    // Types de produit dont cette catégorie couvre le coût fournisseur principal (marge réelle définitive).
    const TYPES = ["circuit", "excursion", "transfert", "sejour", "hebergement", "billetterie", "prestation"];
    const mainCostFor = Array.from(new Set(formData.getAll("main_cost_for").map(String))).filter((t) => TYPES.includes(t));
    const supabase = await createClient();
    const { error } = await supabase.from("cost_categories").update({ name, description, main_cost_for: mainCostFor }).eq("id", id);
    if (error) throw new Error(error.code === "23505" ? "Une catégorie porte déjà ce nom." : `Catégorie non enregistrée : ${error.message}`);
    revalidatePath("/admin/finance/categories");
    revalidatePath("/admin/finance/depenses");
  });
}
