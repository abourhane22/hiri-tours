"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CustomerLanguage, CustomerSource } from "@/lib/types";

export async function createCustomer(formData: FormData) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      full_name: formData.get("full_name") as string,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      address_line: (formData.get("address_line") as string) || null,
      city: (formData.get("city") as string) || null,
      country: (formData.get("country") as string) || null,
      nationality: (formData.get("nationality") as string) || null,
      preferred_language:
        ((formData.get("preferred_language") as string) ||
          "fr") as CustomerLanguage,
      acquisition_source:
        ((formData.get("acquisition_source") as string) ||
          "walk_in") as CustomerSource,
      internal_notes: (formData.get("internal_notes") as string) || null,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/admin/clients/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${data.id}?created=1`);
}

export async function updateCustomer(id: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      full_name: formData.get("full_name") as string,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      address_line: (formData.get("address_line") as string) || null,
      city: (formData.get("city") as string) || null,
      country: (formData.get("country") as string) || null,
      nationality: (formData.get("nationality") as string) || null,
      preferred_language:
        ((formData.get("preferred_language") as string) ||
          "fr") as CustomerLanguage,
      acquisition_source:
        ((formData.get("acquisition_source") as string) ||
          "walk_in") as CustomerSource,
      internal_notes: (formData.get("internal_notes") as string) || null,
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/admin/clients/${id}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  redirect(`/admin/clients/${id}?updated=1`);
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient();
  await supabase.from("customers").delete().eq("id", id);
  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}
