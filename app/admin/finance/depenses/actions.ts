"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ActionError, formAction } from "@/lib/flash";
import { agencyDate } from "@/lib/tz";

function parsePayload(formData: FormData) {
  return {
    expense_date: ((formData.get("expense_date") as string) || "").trim() || agencyDate(),
    category_id: (formData.get("category_id") as string) || "",
    amount_mad: parseFloat(formData.get("amount_mad") as string) || 0,
    description: ((formData.get("description") as string) || "").trim() || null,
    reservation_id: ((formData.get("reservation_id") as string) || "").trim() || null,
    circuit_id: ((formData.get("circuit_id") as string) || "").trim() || null,
    vehicle_id: ((formData.get("vehicle_id") as string) || "").trim() || null,
    notes: ((formData.get("notes") as string) || "").trim() || null,
  };
}

export async function createExpense(formData: FormData) {
  return formAction("Dépense enregistrée", async () => {
    const payload = parsePayload(formData);
    if (!payload.category_id) throw new ActionError("La catégorie est obligatoire.", "category_id");
    if (payload.amount_mad <= 0) throw new ActionError("Le montant doit être supérieur à 0.", "amount_mad");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses").insert({ ...payload, created_by: user?.id });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/finance/depenses");
    return "/admin/finance/depenses";
  });
}

export async function updateExpense(id: string, formData: FormData) {
  return formAction("Dépense mise à jour", async () => {
    const payload = parsePayload(formData);
    if (!payload.category_id) throw new ActionError("La catégorie est obligatoire.", "category_id");
    if (payload.amount_mad <= 0) throw new ActionError("Le montant doit être supérieur à 0.", "amount_mad");
    const supabase = await createClient();
    const { error } = await supabase.from("expenses").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/finance/depenses");
    return "/admin/finance/depenses";
  });
}

export async function deleteExpense(id: string) {
  return formAction("Dépense supprimée", async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/finance/depenses");
    return "/admin/finance/depenses";
  });
}
