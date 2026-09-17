"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isContractStatus, isPaymentTerms, isRemunerationMode, isSupplierType } from "@/lib/purchasing";
import type { CancellationStep, PaymentStep, SupplierContact } from "@/lib/types";

export type AchatActionState = { ok: true; savedAt?: number } | { ok: false; error: string };

const fail = (error: string): AchatActionState => ({ ok: false, error });
const str = (fd: FormData, k: string) => ((fd.get(k) as string) || "").trim();

/** Session staff — les écrans Achats sont protégés par la RLS et le middleware. */
async function staffClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Session expirée — reconnectez-vous." };
  return { ok: true as const, supabase, user };
}

/** JSON tolérant : un champ vide ou illisible retombe sur la valeur par défaut. */
function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Fournisseurs
// ---------------------------------------------------------------------------

function readSupplier(fd: FormData): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Le nom du fournisseur est obligatoire." };

  const supplierType = str(fd, "supplier_type");
  if (!isSupplierType(supplierType)) return { ok: false, error: "Type de fournisseur invalide." };

  const paymentTerms = str(fd, "payment_terms");
  if (!isPaymentTerms(paymentTerms)) return { ok: false, error: "Conditions de paiement invalides." };

  const email = str(fd, "email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "L'email du fournisseur est invalide." };
  }

  return {
    ok: true,
    data: {
      name,
      legal_name: str(fd, "legal_name") || null,
      supplier_type: supplierType,
      ice: str(fd, "ice") || null,
      if_number: str(fd, "if_number") || null,
      rc: str(fd, "rc") || null,
      address_line: str(fd, "address_line") || null,
      city: str(fd, "city") || null,
      country: str(fd, "country") || "Maroc",
      phone: str(fd, "phone") || null,
      email: email || null,
      website: str(fd, "website") || null,
      contacts: parseJsonArray<SupplierContact>(str(fd, "contacts"), []),
      payment_terms: paymentTerms,
      default_currency: str(fd, "default_currency") || "MAD",
      is_active: fd.get("is_active") === "on",
      notes: str(fd, "notes") || null,
    },
  };
}

export async function createSupplier(_prev: AchatActionState, fd: FormData): Promise<AchatActionState> {
  const ctx = await staffClient();
  if (!ctx.ok) return ctx;
  const fields = readSupplier(fd);
  if (!fields.ok) return fields;

  const { data, error } = await ctx.supabase
    .from("suppliers")
    .insert({ ...fields.data, created_by: ctx.user.id })
    .select("id")
    .single();
  if (error) {
    console.error("[createSupplier]", error);
    return fail("Impossible de créer le fournisseur.");
  }

  revalidatePath("/admin/fournisseurs");
  redirect(`/admin/fournisseurs/${(data as any).id}?created=1`);
}

export async function updateSupplier(id: string, _prev: AchatActionState, fd: FormData): Promise<AchatActionState> {
  const ctx = await staffClient();
  if (!ctx.ok) return ctx;
  const fields = readSupplier(fd);
  if (!fields.ok) return fields;

  const { error } = await ctx.supabase.from("suppliers").update(fields.data).eq("id", id);
  if (error) {
    console.error("[updateSupplier]", error);
    return fail("Impossible d'enregistrer le fournisseur.");
  }

  revalidatePath("/admin/fournisseurs");
  revalidatePath(`/admin/fournisseurs/${id}`);
  return { ok: true, savedAt: Date.now() };
}

/**
 * Suppression — refusée si le fournisseur porte des contrats (FK restrict).
 * La désactivation est la voie normale pour le retirer des listes.
 */
export async function deleteSupplier(id: string): Promise<AchatActionState> {
  const ctx = await staffClient();
  if (!ctx.ok) return ctx;

  const { count } = await ctx.supabase
    .from("supplier_contracts")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", id);
  if ((count ?? 0) > 0) {
    return fail(
      `Suppression impossible : ${count} contrat(s) rattaché(s) à ce fournisseur. Désactivez-le plutôt.`,
    );
  }

  const { error } = await ctx.supabase.from("suppliers").delete().eq("id", id);
  if (error) {
    console.error("[deleteSupplier]", error);
    return fail("Suppression impossible : ce fournisseur est référencé.");
  }

  revalidatePath("/admin/fournisseurs");
  redirect("/admin/fournisseurs");
}

// ---------------------------------------------------------------------------
// Contrats
// ---------------------------------------------------------------------------

function readContract(fd: FormData): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const label = str(fd, "label");
  if (!label) return { ok: false, error: "Le libellé du contrat est obligatoire." };

  const validFrom = str(fd, "valid_from");
  const validTo = str(fd, "valid_to");
  if (!validFrom || !validTo) return { ok: false, error: "Les dates de validité sont obligatoires." };
  if (validFrom > validTo) return { ok: false, error: "La date de fin doit être postérieure à la date de début." };

  const mode = str(fd, "remuneration_mode");
  if (!isRemunerationMode(mode)) return { ok: false, error: "Mode de rémunération invalide." };

  const status = str(fd, "status");
  if (!isContractStatus(status)) return { ok: false, error: "Statut de contrat invalide." };

  // Miroir exact de la contrainte SQL supplier_contracts_remuneration_chk.
  let commissionRate: number | null = null;
  let markupRate: number | null = null;
  if (mode === "commission") {
    const n = parseFloat(str(fd, "commission_rate"));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { ok: false, error: "Le taux de commission doit être compris entre 0 et 100 %." };
    }
    commissionRate = n / 100;
  }
  if (mode === "markup") {
    const n = parseFloat(str(fd, "markup_rate"));
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "Le taux de marge doit être un nombre positif." };
    }
    markupRate = n / 100;
  }

  const releaseDays = parseInt(str(fd, "release_days_default") || "0", 10);
  if (!Number.isInteger(releaseDays) || releaseDays < 0) {
    return { ok: false, error: "Le préavis de release doit être un entier positif ou nul." };
  }

  return {
    ok: true,
    data: {
      reference: str(fd, "reference") || null,
      label,
      valid_from: validFrom,
      valid_to: validTo,
      currency: str(fd, "currency") || "MAD",
      remuneration_mode: mode,
      commission_rate: commissionRate,
      markup_rate: markupRate,
      cancellation_policy: parseJsonArray<CancellationStep>(str(fd, "cancellation_policy"), []),
      payment_schedule: parseJsonArray<PaymentStep>(str(fd, "payment_schedule"), []),
      release_days_default: releaseDays,
      status,
      document_url: str(fd, "document_url") || null,
      notes: str(fd, "notes") || null,
    },
  };
}

export async function createContract(
  supplierId: string,
  _prev: AchatActionState,
  fd: FormData,
): Promise<AchatActionState> {
  const ctx = await staffClient();
  if (!ctx.ok) return ctx;
  const fields = readContract(fd);
  if (!fields.ok) return fields;

  const { data, error } = await ctx.supabase
    .from("supplier_contracts")
    .insert({ ...fields.data, supplier_id: supplierId, created_by: ctx.user.id })
    .select("id")
    .single();
  if (error) {
    console.error("[createContract]", error);
    return fail("Impossible de créer le contrat.");
  }

  revalidatePath(`/admin/fournisseurs/${supplierId}`);
  redirect(`/admin/fournisseurs/${supplierId}/contrats/${(data as any).id}?created=1`);
}

export async function updateContract(
  supplierId: string,
  contractId: string,
  _prev: AchatActionState,
  fd: FormData,
): Promise<AchatActionState> {
  const ctx = await staffClient();
  if (!ctx.ok) return ctx;
  const fields = readContract(fd);
  if (!fields.ok) return fields;

  const { error } = await ctx.supabase
    .from("supplier_contracts")
    .update(fields.data)
    .eq("id", contractId)
    .eq("supplier_id", supplierId);
  if (error) {
    console.error("[updateContract]", error);
    return fail("Impossible d'enregistrer le contrat.");
  }

  revalidatePath(`/admin/fournisseurs/${supplierId}`);
  revalidatePath(`/admin/fournisseurs/${supplierId}/contrats/${contractId}`);
  return { ok: true, savedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Tarifs d'achat
// ---------------------------------------------------------------------------

export async function createPurchaseRate(
  supplierId: string,
  contractId: string,
  _prev: AchatActionState,
  fd: FormData,
): Promise<AchatActionState> {
  const ctx = await staffClient();
  if (!ctx.ok) return ctx;

  const validFrom = str(fd, "valid_from");
  const validTo = str(fd, "valid_to");
  if (!validFrom || !validTo) return fail("Les dates de validité du tarif sont obligatoires.");
  if (validFrom > validTo) return fail("La date de fin doit être postérieure à la date de début.");

  const unitCost = parseFloat(str(fd, "unit_cost_mad"));
  if (!Number.isFinite(unitCost) || unitCost < 0) return fail("Le coût unitaire doit être un nombre positif ou nul.");

  const childRaw = str(fd, "child_cost_mad");
  let childCost: number | null = null;
  if (childRaw) {
    const n = parseFloat(childRaw);
    if (!Number.isFinite(n) || n < 0) return fail("Le coût enfant doit être un nombre positif ou nul.");
    childCost = n;
  }

  const parsePax = (k: string): number | null => {
    const raw = str(fd, k);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isInteger(n) && n >= 1 ? n : NaN as unknown as number;
  };
  const minPax = parsePax("min_pax");
  const maxPax = parsePax("max_pax");
  if (Number.isNaN(minPax) || Number.isNaN(maxPax)) return fail("Les paliers de passagers doivent être des entiers ≥ 1.");
  if (minPax !== null && maxPax !== null && minPax > maxPax) {
    return fail("Le palier minimum ne peut pas dépasser le palier maximum.");
  }

  const priority = parseInt(str(fd, "priority") || "0", 10);
  if (!Number.isInteger(priority)) return fail("La priorité doit être un entier.");

  // Conditions libres : clé=valeur, une par ligne.
  const conditions: Record<string, string> = {};
  for (const line of str(fd, "conditions").split(/\r?\n/)) {
    const [k, ...rest] = line.split("=");
    const key = (k ?? "").trim();
    const value = rest.join("=").trim();
    if (key && value) conditions[key] = value;
  }

  const { error } = await ctx.supabase.from("purchase_rates").insert({
    contract_id: contractId,
    product_id: str(fd, "product_id") || null,
    valid_from: validFrom,
    valid_to: validTo,
    unit_cost_mad: unitCost,
    child_cost_mad: childCost,
    currency: str(fd, "currency") || null,
    min_pax: minPax,
    max_pax: maxPax,
    conditions,
    priority,
    notes: str(fd, "notes") || null,
    created_by: ctx.user.id,
  });
  if (error) {
    console.error("[createPurchaseRate]", error);
    return fail("Impossible d'enregistrer le tarif d'achat.");
  }

  revalidatePath(`/admin/fournisseurs/${supplierId}/contrats/${contractId}`);
  return { ok: true, savedAt: Date.now() };
}

export async function deletePurchaseRate(
  supplierId: string,
  contractId: string,
  rateId: string,
): Promise<AchatActionState> {
  const ctx = await staffClient();
  if (!ctx.ok) return ctx;

  // Double filtre : un id de tarif ne peut pas viser un autre contrat.
  const { error } = await ctx.supabase
    .from("purchase_rates")
    .delete()
    .eq("id", rateId)
    .eq("contract_id", contractId);
  if (error) {
    console.error("[deletePurchaseRate]", error);
    return fail("Impossible de supprimer ce tarif.");
  }

  revalidatePath(`/admin/fournisseurs/${supplierId}/contrats/${contractId}`);
  return { ok: true, savedAt: Date.now() };
}
