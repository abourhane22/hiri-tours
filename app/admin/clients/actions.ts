"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, normalizeEmail, maskPhone } from "@/lib/customers";
import type { CustomerLanguage, CustomerSource } from "@/lib/types";

/**
 * Traduit une violation d'index unique (Postgres 23505) en message métier.
 * L'index touché est déduit du texte de l'erreur ("phone" / "email").
 */
function duplicateMessage(error: {
  code?: string;
  message?: string;
  details?: string | null;
}): string | null {
  if (error.code !== "23505") return null;
  // Le nom de contrainte est dans `message`, l'expression/colonne dans
  // `details` (ex. « Key (lower(btrim(email)))=(…) already exists »).
  const hay = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (hay.includes("phone")) return "Un client existe déjà avec ce numéro de téléphone.";
  if (hay.includes("email")) return "Un client existe déjà avec cet email.";
  return "Un client identique existe déjà.";
}

export async function createCustomer(formData: FormData) {
  const supabase = await createClient();

  const phone = (formData.get("phone") as string) || null;

  const { data, error } = await supabase
    .from("customers")
    .insert({
      full_name: formData.get("full_name") as string,
      email: (formData.get("email") as string) || null,
      phone,
      phone_normalized: normalizePhone(phone),
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
    const message = duplicateMessage(error) ?? error.message;
    redirect(`/admin/clients/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${data.id}?created=1`);
}

export async function updateCustomer(id: string, formData: FormData) {
  const supabase = await createClient();

  const phone = (formData.get("phone") as string) || null;

  const { error } = await supabase
    .from("customers")
    .update({
      full_name: formData.get("full_name") as string,
      email: (formData.get("email") as string) || null,
      phone,
      phone_normalized: normalizePhone(phone),
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
    const message = duplicateMessage(error) ?? error.message;
    redirect(`/admin/clients/${id}?error=${encodeURIComponent(message)}`);
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

// ---------------------------------------------------------------------------
// Détection de doublons à la saisie (formulaire Nouveau client)
// ---------------------------------------------------------------------------

export type DuplicateMatch = {
  id: string;
  fullName: string;
  maskedPhone: string | null;
  reservationCount: number;
  lastDeparture: string | null;
};

export type DuplicateResult = {
  phoneMatch: DuplicateMatch | null; // haute confiance
  emailMatch: DuplicateMatch | null; // haute confiance
  nameMatches: DuplicateMatch[]; // basse confiance, max 3
};

type CustomerRow = { id: string; full_name: string; phone_normalized: string | null };

/** Agrège nb de réservations + dernier départ pour un lot de clients. */
async function enrich(
  admin: ReturnType<typeof createAdminClient>,
  rows: CustomerRow[],
): Promise<DuplicateMatch[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { data: resa } = await admin
    .from("reservations")
    .select("customer_id, departure_date")
    .in("customer_id", ids);

  const counts = new Map<string, number>();
  const last = new Map<string, string>();
  for (const r of (resa ?? []) as { customer_id: string; departure_date: string }[]) {
    counts.set(r.customer_id, (counts.get(r.customer_id) ?? 0) + 1);
    const prev = last.get(r.customer_id);
    if (!prev || r.departure_date > prev) last.set(r.customer_id, r.departure_date);
  }

  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    maskedPhone: maskPhone(r.phone_normalized),
    reservationCount: counts.get(r.id) ?? 0,
    lastDeparture: last.get(r.id) ?? null,
  }));
}

/**
 * Recherche des clients potentiellement en doublon (service-role).
 *  - phone_normalized exact  → haute confiance
 *  - email normalisé exact   → haute confiance
 *  - nom similaire (ilike)   → basse confiance, max 3
 */
export async function findPotentialDuplicates(input: {
  phone?: string;
  email?: string;
  fullName?: string;
}): Promise<DuplicateResult> {
  const admin = createAdminClient();
  const result: DuplicateResult = { phoneMatch: null, emailMatch: null, nameMatches: [] };

  const normPhone = normalizePhone(input.phone);
  const normEmail = normalizeEmail(input.email);
  const name = (input.fullName ?? "").trim();

  // Match exact téléphone.
  if (normPhone) {
    const { data } = await admin
      .from("customers")
      .select("id, full_name, phone_normalized")
      .eq("phone_normalized", normPhone)
      .limit(1);
    const enriched = await enrich(admin, (data ?? []) as CustomerRow[]);
    result.phoneMatch = enriched[0] ?? null;
  }

  // Match exact email (comparaison sur la valeur normalisée trim+lower).
  if (normEmail) {
    const { data } = await admin
      .from("customers")
      .select("id, full_name, phone_normalized, email")
      .ilike("email", normEmail) // ilike sans jokers = égalité insensible à la casse
      .limit(5);
    const rows = ((data ?? []) as (CustomerRow & { email: string | null })[]).filter(
      (r) => normalizeEmail(r.email) === normEmail,
    );
    const enriched = await enrich(admin, rows);
    result.emailMatch = enriched[0] ?? null;
  }

  // Suggestion nom (basse confiance). ilike simple ; l'insensibilité aux
  // accents dépend de l'extension unaccent — sinon ce filtre reste littéral.
  if (name.length >= 2) {
    const { data } = await admin
      .from("customers")
      .select("id, full_name, phone_normalized")
      .ilike("full_name", `%${name}%`)
      .limit(3);
    result.nameMatches = await enrich(admin, (data ?? []) as CustomerRow[]);
  }

  return result;
}
