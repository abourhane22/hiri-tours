"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parsePayload(formData: FormData) {
  return {
    expense_date: ((formData.get("expense_date") as string) || "").trim() || new Date().toISOString().split("T")[0],
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
  const payload = parsePayload(formData);
  if (!payload.category_id) throw new Error("La catégorie est obligatoire");
  if (payload.amount_mad <= 0) throw new Error("Le montant doit être positif");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("expenses").insert({ ...payload, created_by: user?.id });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/depenses");
  redirect("/admin/finance/depenses");
}

export async function updateExpense(id: string, formData: FormData) {
  const payload = parsePayload(formData);
  if (!payload.category_id) throw new Error("La catégorie est obligatoire");
  if (payload.amount_mad <= 0) throw new Error("Le montant doit être positif");
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/depenses");
  redirect("/admin/finance/depenses");
}

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/depenses");
  redirect("/admin/finance/depenses");
}
