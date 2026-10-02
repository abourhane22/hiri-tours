"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { flashSuccess, formAction } from "@/lib/flash";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, normalizeEmail, maskPhone, customerDuplicateMessage } from "@/lib/customers";
import { computeLoyaltyPoints, getLoyaltyTier } from "@/lib/loyalty";
import type { CustomerLanguage, CustomerSource } from "@/lib/types";

export type CustomerActionState = { ok: true } | { ok: false; error: string; field?: string | null };

/** Lit + valide les champs communs. Renvoie soit les données, soit une erreur. */
function readCustomerFields(
  formData: FormData,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string; field?: string | null } {
  const firstName = ((formData.get("first_name") as string) || "").trim();
  const lastName = ((formData.get("last_name") as string) || "").trim();
  const phone = ((formData.get("phone") as string) || "").trim();
  const country = ((formData.get("country") as string) || "").trim();
  const source = (formData.get("acquisition_source") as string) || "";
  const email = ((formData.get("email") as string) || "").trim();

  if (!lastName) return { ok: false, error: "Le nom est obligatoire.", field: "last_name" };
  if (!firstName) return { ok: false, error: "Le prénom est obligatoire.", field: "first_name" };
  if (!phone) return { ok: false, error: "Le téléphone est obligatoire.", field: "phone" };
  if (!country) return { ok: false, error: "Le pays est obligatoire.", field: "country" };
  if (!source) return { ok: false, error: "La source d'acquisition est obligatoire.", field: "acquisition_source" };

  // full_name reste synchronisé : tout le reste de l'app l'affiche.
  const fullName = `${firstName} ${lastName}`.trim();

  // Identité du voyageur (facultative) : un champ ABSENT du formulaire n'est jamais
  // écrit (pas d'effacement silencieux, ex. la nationalité) ; un champ présent et vide → null.
  const identity: Record<string, string | null> = {};
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  for (const key of ["nationality", "date_of_birth", "gender", "id_document_type", "id_document_number", "id_document_expires_on"]) {
    if (!formData.has(key)) continue;
    identity[key] = ((formData.get(key) as string) || "").trim() || null;
  }
  if (identity.gender && !["m", "f"].includes(identity.gender)) return { ok: false, error: "Sexe invalide.", field: "gender" };
  if (identity.id_document_type && !["cin", "passeport"].includes(identity.id_document_type))
    return { ok: false, error: "Type de pièce invalide.", field: "id_document_type" };
  if (identity.date_of_birth && (!DATE_RE.test(identity.date_of_birth) || identity.date_of_birth > new Date().toISOString().slice(0, 10)))
    return { ok: false, error: "Date de naissance invalide.", field: "date_of_birth" };
  if (identity.id_document_expires_on && !DATE_RE.test(identity.id_document_expires_on))
    return { ok: false, error: "Date d'expiration invalide.", field: "id_document_expires_on" };
  if (identity.id_document_number && !identity.id_document_type)
    return { ok: false, error: "Précisez le type de pièce (CIN ou passeport).", field: "id_document_type" };

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
      city: (formData.get("city") as string) || null,
      preferred_language:
        ((formData.get("preferred_language") as string) || "fr") as CustomerLanguage,
      acquisition_source: (source || "other") as CustomerSource,
      internal_notes: (formData.get("internal_notes") as string) || null,
      ...identity,
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
    return { ok: false, error: customerDuplicateMessage(error) ?? `Client non créé : ${error.message}`, field: duplicateField(error) };
  }

  revalidatePath("/admin/clients");
  await flashSuccess(`Client créé — ${fields.data.full_name as string}`);
  redirect(`/admin/clients/${data.id}`);
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
    return { ok: false, error: customerDuplicateMessage(error) ?? `Fiche non enregistrée : ${error.message}`, field: duplicateField(error) };
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  await flashSuccess("Fiche client mise à jour");
  redirect(`/admin/clients/${id}`);
}

export async function deleteCustomer(id: string) {
  return formAction("Client supprimé", async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("customers").delete().eq("id", id);
    // Échec jamais silencieux : une fiche référencée (factures, avoirs) n'est pas supprimée.
    if (error) {
      throw new Error(
        error.code === "23503"
          ? "Suppression impossible : ce client est référencé par des factures ou des avoirs."
          : `Suppression impossible : ${error.message}`,
      );
    }
    revalidatePath("/admin/clients");
    return "/admin/clients";
  });
}

/** Champ à mettre en évidence pour une violation d'unicité (téléphone / email). */
function duplicateField(error: { code?: string; message?: string; details?: string | null }): string | null {
  if (error.code !== "23505") return null;
  const hay = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return hay.includes("phone") ? "phone" : hay.includes("email") ? "email" : null;
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
  const result: DuplicateResult = { phoneMatch: null, emailMatch: null, nameMatches: [] };
  // Server action appelable depuis le client : réservée à une session backoffice.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return result;
  const admin = createAdminClient();

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
