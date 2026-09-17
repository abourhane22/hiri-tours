"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateCompanySettings(id: string, formData: FormData) {
  const payload = {
    legal_name: ((formData.get("legal_name") as string) || "").trim() || "Hiri Tours SARL",
    commercial_name: ((formData.get("commercial_name") as string) || "").trim() || "Hiri Tours",
    address_line: ((formData.get("address_line") as string) || "").trim() || null,
    city: ((formData.get("city") as string) || "").trim() || null,
    postal_code: ((formData.get("postal_code") as string) || "").trim() || null,
    country: ((formData.get("country") as string) || "").trim() || "Maroc",
    phone: ((formData.get("phone") as string) || "").trim() || null,
    email: ((formData.get("email") as string) || "").trim() || null,
    website: ((formData.get("website") as string) || "").trim() || null,
    ice: ((formData.get("ice") as string) || "").trim() || null,
    rc: ((formData.get("rc") as string) || "").trim() || null,
    if_number: ((formData.get("if_number") as string) || "").trim() || null,
    patente: ((formData.get("patente") as string) || "").trim() || null,
    cnss: ((formData.get("cnss") as string) || "").trim() || null,
    tva_default_rate: (parseFloat(formData.get("tva_default_rate") as string) || 20) / 100,
    iban: ((formData.get("iban") as string) || "").trim() || null,
    bank_name: ((formData.get("bank_name") as string) || "").trim() || null,
    bank_rib: ((formData.get("bank_rib") as string) || "").replace(/\s+/g, "") || null,
    bank_account_holder: ((formData.get("bank_account_holder") as string) || "").trim() || null,
    whatsapp: ((formData.get("whatsapp") as string) || "").trim() || null,
    // Identité légale (mentions de facturation)
    legal_form: ((formData.get("legal_form") as string) || "").trim() || null,
    capital_mad: (() => {
      const n = parseFloat((formData.get("capital_mad") as string) || "");
      return Number.isFinite(n) && n >= 0 ? n : null;
    })(),
    rc_city: ((formData.get("rc_city") as string) || "").trim() || null,
    tva_number: ((formData.get("tva_number") as string) || "").trim() || null,
    travel_license: ((formData.get("travel_license") as string) || "").trim() || null,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("company_settings").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/parametres");
  revalidatePath("/admin/parametres/societe");
  redirect("/admin/parametres/societe?saved=1");
}
