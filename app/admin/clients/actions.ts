"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, normalizeEmail, maskPhone } from "@/lib/customers";
import { computeLoyaltyPoints, getLoyaltyTier } from "@/lib/loyalty";
import type { CustomerLanguage, CustomerSource } from "@/lib/types";

export type CustomerActionState = { ok: true } | { ok: false; error: string };

/**
 * Traduit une violation d'index unique (Postgres 23505) en message métier.
 * L'index touché est déduit du texte de l'erreur : nom de contrainte dans
 * `message`, expression/colonne dans `details`
 * (ex. « Key (lower(btrim(email)))=(…) already exists »).
 */
function duplicateMessage(error: {
  code?: string;
  message?: string;
  details?: string | null;
}): string | null {
  if (error.code !== "23505") return null;
  const hay = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (hay.includes("phone")) return "Un client existe déjà avec ce numéro de téléphone.";
  if (hay.includes("email")) return "Un client existe déjà avec cet email.";
  return "Un client identique existe déjà.";
}

/** Lit + valide les champs communs. Renvoie soit les données, soit une erreur. */
function readCustomerFields(
  formData: FormData,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const firstName = ((formData.get("first_name") as string) || "").trim();
  const lastName = ((formData.get("last_name") as string) || "").trim();
  const phone = ((formData.get("phone") as string) || "").trim();
  const country = ((formData.get("country") as string) || "").trim();
  const source = (formData.get("acquisition_source") as string) || "";
  const email = ((formData.get("email") as string) || "").trim();

  if (!firstName || !lastName) return { ok: false, error: "Le nom et le prénom sont obligatoires." };
  if (!phone) return { ok: false, error: "Le téléphone est obligatoire." };
  if (!country) return { ok: false, error: "Le pays est obligatoire." };
  if (!source) return { ok: false, error: "La source d'acquisition est obligatoire." };

  // full_name reste synchronisé : tout le reste de l'app l'affiche.
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    ok: true,
    data: {
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      phone_normalized: normalizePhone(phone),
      country: country || null,
      nationality: (formData.get("nationality") as string) || null,
      city: (formData.get("city") as string) || null,
      preferred_language:
        ((formData.get("preferred_language") as string) || "fr") as CustomerLanguage,
      acquisition_source: (source || "other") as CustomerSource,
      internal_notes: (formData.get("internal_notes") as string) || null,
    },
  };
}

export async function createCustomer(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const fields = readCustomerFields(formData);
  if (!fields.ok) return fields;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert(fields.data)
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: duplicateMessage(error) ?? error.message };
  }

  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${data.id}?created=1`);
}

export async function updateCustomer(
  id: string,
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const fields = readCustomerFields(formData);
  if (!fields.ok) return fields;

  const supabase = await createClient();
  const { error } = await supabase.from("customers").update(fields.data).eq("id", id);

  if (error) {
    return { ok: false, error: duplicateMessage(error) ?? error.message };
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
  country: string | null;
  tier: string | null;
  maskedPhone: string | null;
  reservationCount: number;
  lastDeparture: string | null;
};

export type DuplicateResult = {
  phoneMatch: DuplicateMatch | null; // haute confiance
  emailMatch: DuplicateMatch | null; // haute confiance
  nameMatches: DuplicateMatch[]; // basse confiance, max 3
};

type CustomerRow = {
  id: string;
  full_name: string;
  phone_normalized: string | null;
  country: string | null;
};

/** Agrège nb de réservations, dernier départ et palier fidélité par client. */
async function enrich(
  admin: ReturnType<typeof createAdminClient>,
  rows: CustomerRow[],
): Promise<DuplicateMatch[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { data: resa } = await admin
    .from("reservations")
    .select("customer_id, departure_date, total_amount_mad, status")
    .in("customer_id", ids);

  const byCustomer = new Map<
    string,
    { count: number; last: string | null; resa: { total_amount_mad: number; status: string }[] }
  >();
  for (const id of ids) byCustomer.set(id, { count: 0, last: null, resa: [] });
  for (const r of (resa ?? []) as {
    customer_id: string;
    departure_date: string;
    total_amount_mad: number;
    status: string;
  }[]) {
    const agg = byCustomer.get(r.customer_id);
    if (!agg) continue;
    agg.count += 1;
    if (!agg.last || r.departure_date > agg.last) agg.last = r.departure_date;
    agg.resa.push({ total_amount_mad: r.total_amount_mad, status: r.status });
  }

  return rows.map((r) => {
    const agg = byCustomer.get(r.id)!;
    const tier = getLoyaltyTier(computeLoyaltyPoints(agg.resa));
    return {
      id: r.id,
      fullName: r.full_name,
      country: r.country,
      tier: tier.name === "Aucun" ? null : tier.name,
      maskedPhone: maskPhone(r.phone_normalized),
      reservationCount: agg.count,
      lastDeparture: agg.last,
    };
  });
}

const MATCH_SELECT = "id, full_name, phone_normalized, country";

/**
 * Recherche des clients potentiellement en doublon (service-role).
 *  - phone_normalized exact  → haute confiance
 *  - email normalisé exact   → haute confiance
 *  - nom similaire (ilike)   → basse confiance, max 3
 */
export async function findPotentialDuplicates(input: {
  phone?: string;
  email?: string;
  name?: string;
}): Promise<DuplicateResult> {
  const admin = createAdminClient();
  const result: DuplicateResult = { phoneMatch: null, emailMatch: null, nameMatches: [] };

  const normPhone = normalizePhone(input.phone);
  const normEmail = normalizeEmail(input.email);
  const name = (input.name ?? "").trim();

  if (normPhone) {
    const { data } = await admin
      .from("customers")
      .select(MATCH_SELECT)
      .eq("phone_normalized", normPhone)
      .limit(1);
    const enriched = await enrich(admin, (data ?? []) as CustomerRow[]);
    result.phoneMatch = enriched[0] ?? null;
  }

  if (normEmail) {
    const { data } = await admin
      .from("customers")
      .select(`${MATCH_SELECT}, email`)
      .ilike("email", normEmail) // ilike sans jokers = égalité insensible à la casse
      .limit(5);
    const rows = ((data ?? []) as (CustomerRow & { email: string | null })[]).filter(
      (r) => normalizeEmail(r.email) === normEmail,
    );
    const enriched = await enrich(admin, rows);
    result.emailMatch = enriched[0] ?? null;
  }

  // ilike simple ; l'insensibilité aux accents dépend de l'extension unaccent.
  if (name.length >= 2) {
    const { data } = await admin
      .from("customers")
      .select(MATCH_SELECT)
      .ilike("full_name", `%${name}%`)
      .limit(3);
    result.nameMatches = await enrich(admin, (data ?? []) as CustomerRow[]);
  }

  return result;
}
