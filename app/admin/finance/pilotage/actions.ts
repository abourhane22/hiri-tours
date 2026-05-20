"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateAnnualRevenueTarget(formData: FormData) {
  const raw = formData.get("target") as string;
  const target = parseFloat(raw.replace(/\s/g, ""));

  if (isNaN(target) || target < 0) {
    return { error: "Valeur invalide" };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("company_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("company_settings")
      .update({ annual_revenue_target_mad: target })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("company_settings")
      .insert({ annual_revenue_target_mad: target });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/finance/pilotage");
  revalidatePath("/admin");
  return { ok: true };
}
