"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { flashSuccess } from "@/lib/flash";
import { netSaleOfReservation } from "@/lib/credit-notes";
import { RECEIPT_BUCKET, type ExpenseAttachment } from "@/lib/expenses";

// Dépenses — server actions. Rattachement PRINCIPAL exclusif (dossier XOR produit XOR
// aucun, contrainte SQL expenses_single_attachment_chk) ; véhicule optionnel et
// indépendant. Aucune marge calculée ici : le panneau d'impact appelle lib/margin.ts
// côté client avec les données renvoyées par loadDossierImpact.

export type ExpenseFormState =
  | { ok: true; message?: string; again?: boolean; savedAt?: number }
  | { ok: false; error: string; field?: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (fd: FormData, k: string) => ((fd.get(k) as string) || "").trim();
const fail = (error: string, field?: string): ExpenseFormState => ({ ok: false, error, field: field ?? null });

async function staff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/** Retour après enregistrement : seulement vers la liste des dépenses ou une fiche dossier. */
function safeReturn(raw: string): string {
  if (/^\/admin\/finance\/depenses(\?[^#]*)?$/.test(raw) || /^\/admin\/reservations\/[0-9a-f-]{36}(#[a-z-]+)?$/.test(raw)) return raw;
  return "/admin/finance/depenses";
}

/** Création ET modification (même formulaire). « Enregistrer et en saisir une autre » : `again=1`. */
export async function saveExpense(_prev: ExpenseFormState, fd: FormData): Promise<ExpenseFormState> {
  const ctx = await staff();
  if (!ctx) return fail("Session expirée — reconnectez-vous.");
  const { supabase, user } = ctx;

  const mode = str(fd, "mode") === "edit" ? "edit" : "create";
  const id = str(fd, "id");
  if (!UUID.test(id)) return fail("Identifiant de dépense invalide — rechargez la page.");

  const description = str(fd, "description");
  if (!description) return fail("Le libellé est obligatoire.", "description");
  const categoryId = str(fd, "category_id");
  if (!UUID.test(categoryId)) return fail("Choisissez une catégorie.", "category_id");
  const amount = parseFloat(str(fd, "amount_mad").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return fail("Le montant doit être supérieur à 0.", "amount_mad");
  const expenseDate = str(fd, "expense_date");
  if (!DATE.test(expenseDate)) return fail("La date de la dépense est obligatoire.", "expense_date");
  const paymentMethod = str(fd, "payment_method");
  if (paymentMethod && !["transfer", "cash", "card", "cheque"].includes(paymentMethod)) return fail("Moyen de paiement invalide.", "payment_method");

  const attachment = str(fd, "attachment") as ExpenseAttachment;
  if (!["dossier", "produit", "vehicule", "general"].includes(attachment)) return fail("Indiquez pour qui est la dépense.", "attachment");
  let reservationId = str(fd, "reservation_id");
  let circuitId = str(fd, "circuit_id");
  let vehicleId = str(fd, "vehicle_id");

  // Ancienne version (modification) : un dossier déjà rattaché reste accepté même annulé.
  const { data: previous } =
    mode === "edit"
      ? await supabase.from("expenses").select("id, reservation_id, circuit_id, vehicle_id, departure_date, receipt_path, source").eq("id", id).maybeSingle()
      : { data: null };
  if (mode === "edit" && !previous) return fail("Dépense introuvable.");
  if ((previous as { source?: string } | null)?.source === "distribution") {
    return fail("Dépense automatique (billet de l'ordre) : elle n'est pas modifiable à la main.");
  }
  const prev = previous as {
    reservation_id: string | null;
    circuit_id: string | null;
    vehicle_id: string | null;
    departure_date: string | null;
    receipt_path: string | null;
  } | null;
  // Plus saisis dans le formulaire (Dossier / Produit) : véhicule et départ concerné. En
  // modification, la valeur existante est CONSERVÉE telle quelle (2 dépenses dossier +
  // véhicule historiques) ; une nouvelle dépense Dossier ou Produit n'en porte pas.
  let departureDate = "";

  if (attachment === "dossier") {
    if (!UUID.test(reservationId)) return fail("Choisissez le dossier concerné.", "dossier_search");
    const { data: resa } = await supabase.from("reservations").select("id, status").eq("id", reservationId).maybeSingle();
    if (!resa) return fail("Dossier introuvable.", "dossier_search");
    if ((resa as { status: string }).status === "cancelled" && prev?.reservation_id !== reservationId) {
      return fail("Ce dossier est annulé : choisissez un dossier actif.", "dossier_search");
    }
    circuitId = "";
    vehicleId = prev?.reservation_id ? prev.vehicle_id ?? "" : "";
  } else if (attachment === "produit") {
    if (!UUID.test(circuitId)) return fail("Choisissez le produit concerné.", "circuit_id");
    reservationId = "";
    vehicleId = prev?.circuit_id ? prev.vehicle_id ?? "" : "";
    departureDate = prev?.circuit_id === circuitId ? prev.departure_date ?? "" : "";
  } else if (attachment === "vehicule") {
    if (!UUID.test(vehicleId)) return fail("Choisissez le véhicule concerné.", "vehicle_id");
    reservationId = "";
    circuitId = "";
  } else {
    reservationId = "";
    circuitId = "";
    vehicleId = "";
  }
  if (vehicleId && !UUID.test(vehicleId)) return fail("Véhicule invalide.", "vehicle_id");

  // Justificatif : déjà déposé par le navigateur dans {id}/… ; seul ce dossier est accepté.
  const receiptPath = str(fd, "receipt_path");
  if (receiptPath && !receiptPath.startsWith(`${id}/`)) return fail("Justificatif invalide — déposez-le à nouveau.", "receipt");

  const payload = {
    description,
    category_id: categoryId,
    amount_mad: Math.round(amount * 100) / 100,
    expense_date: expenseDate,
    payment_method: paymentMethod || null,
    // supplier_id : colonne conservée en base, plus saisie ni modifiée.
    reservation_id: reservationId || null,
    circuit_id: circuitId || null,
    vehicle_id: vehicleId || null,
    departure_date: departureDate || null,
    receipt_path: receiptPath || null,
    notes: str(fd, "notes") || null,
  };

  const { error } =
    mode === "create"
      ? await supabase.from("expenses").insert({ id, ...payload, created_by: user.id })
      : await supabase.from("expenses").update(payload).eq("id", id);
  if (error) {
    console.error("[saveExpense]", error);
    if (error.code === "23514" && /single_attachment/.test(error.message)) return fail("Une dépense n'a qu'un rattachement principal : dossier OU produit.", "attachment");
    if (error.code === "23503") return fail("Élément rattaché introuvable (dossier, produit ou véhicule supprimé).");
    if (error.code === "23505") return fail("Cette dépense a déjà été enregistrée — rechargez la page avant d'en saisir une autre.");
    return fail(`Dépense non enregistrée : ${error.message}`);
  }

  // Justificatif remplacé ou retiré : l'ancien fichier est supprimé (sans bloquer).
  if (prev?.receipt_path && prev.receipt_path !== payload.receipt_path) {
    const { error: rmErr } = await supabase.storage.from(RECEIPT_BUCKET).remove([prev.receipt_path]);
    if (rmErr) console.error("[saveExpense] ancien justificatif non supprimé :", prev.receipt_path, rmErr);
  }

  revalidatePath("/admin/finance/depenses");
  revalidatePath("/admin/finance");
  for (const r of [reservationId, prev?.reservation_id]) if (r) revalidatePath(`/admin/reservations/${r}`);

  const message = mode === "create" ? "Dépense enregistrée" : "Dépense mise à jour";
  if (str(fd, "again") === "1") return { ok: true, message, again: true, savedAt: Date.now() };
  await flashSuccess(message);
  redirect(safeReturn(str(fd, "return_to")));
}

export async function deleteExpense(id: string, returnTo: string): Promise<{ ok: false; error: string }> {
  const ctx = await staff();
  if (!ctx) return { ok: false, error: "Session expirée — reconnectez-vous." };
  const { data: row } = await ctx.supabase.from("expenses").select("receipt_path, reservation_id, source").eq("id", id).maybeSingle();
  if ((row as { source?: string } | null)?.source === "distribution") {
    return { ok: false, error: "Dépense automatique (billet de l'ordre) : suppression impossible." };
  }
  const { error } = await ctx.supabase.from("expenses").delete().eq("id", id);
  if (error) return { ok: false, error: `Suppression impossible : ${error.message}` };
  const r = row as { receipt_path: string | null; reservation_id: string | null } | null;
  if (r?.receipt_path) {
    const { error: rmErr } = await ctx.supabase.storage.from(RECEIPT_BUCKET).remove([r.receipt_path]);
    if (rmErr) console.error("[deleteExpense] justificatif non supprimé :", r.receipt_path, rmErr);
  }
  revalidatePath("/admin/finance/depenses");
  if (r?.reservation_id) revalidatePath(`/admin/reservations/${r.reservation_id}`);
  await flashSuccess("Dépense supprimée");
  redirect(safeReturn(returnTo));
}

export type DossierOption = {
  id: string;
  reference: string;
  status: string;
  customer: string | null;
  product: string | null;
  departure_date: string;
  pax: number;
};

function toOption(r: any): DossierOption {
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  return {
    id: r.id,
    reference: r.reference,
    status: r.status,
    customer: one(r.customers)?.full_name ?? null,
    product: one(r.circuits)?.title ?? null,
    departure_date: r.departure_date,
    pax: Number(r.adults) + Number(r.children),
  };
}

/** Autocomplétion du dossier : référence OU nom du client, dossiers non annulés. */
export async function searchDossiers(q: string): Promise<DossierOption[]> {
  const ctx = await staff();
  if (!ctx) return [];
  const s = q.replace(/[%,()*\\]/g, " ").trim();
  if (s.length < 2) return [];
  const { data: custs } = await ctx.supabase.from("customers").select("id").ilike("full_name", `%${s}%`).limit(30);
  const custIds = ((custs ?? []) as { id: string }[]).map((c) => c.id);
  const or = [`reference.ilike.%${s}%`, ...(custIds.length ? [`customer_id.in.(${custIds.join(",")})`] : [])].join(",");
  const { data } = await ctx.supabase
    .from("reservations")
    .select("id, reference, status, departure_date, adults, children, circuits(title), customers(full_name)")
    .neq("status", "cancelled")
    .or(or)
    .order("departure_date", { ascending: false })
    .limit(10);
  return ((data ?? []) as any[]).map(toOption);
}

export type DossierImpact = DossierOption & {
  totalMad: number;
  /** Vente nette d'avoirs (même règle que les rapports et la carte Marge). */
  saleNet: number;
  credited: number;
  expectedCost: number | null;
  /** Type du produit du dossier (règle de marge réelle provisoire). */
  productCategory: string | null;
  /** Dépenses DÉJÀ rattachées au dossier, hors la dépense en cours de modification. */
  otherExpenses: { amount_mad: number; main_cost_for: string[] }[];
};

/** Données du dossier pour l'aperçu d'impact — chargées à la sélection ; marges calculées par lib/margin.ts côté client. */
export async function loadDossierImpact(reservationId: string, excludeExpenseId?: string): Promise<DossierImpact | null> {
  const ctx = await staff();
  if (!ctx || !UUID.test(reservationId)) return null;
  const { data: r } = await ctx.supabase
    .from("reservations")
    .select("id, reference, status, departure_date, adults, children, total_amount_mad, expected_cost_mad, circuits(title, category), customers(full_name)")
    .eq("id", reservationId)
    .maybeSingle();
  if (!r) return null;
  const row = r as any;
  let q = ctx.supabase.from("expenses").select("id, amount_mad, cost_categories(main_cost_for)").eq("reservation_id", reservationId);
  if (excludeExpenseId && UUID.test(excludeExpenseId)) q = q.neq("id", excludeExpenseId);
  const [{ data: exp }, sale] = await Promise.all([q, netSaleOfReservation(ctx.supabase, reservationId, Number(row.total_amount_mad))]);
  return {
    ...toOption(row),
    totalMad: Number(row.total_amount_mad),
    saleNet: sale.net,
    credited: sale.credited,
    expectedCost: row.expected_cost_mad === null || row.expected_cost_mad === undefined ? null : Number(row.expected_cost_mad),
    productCategory: (Array.isArray(row.circuits) ? row.circuits[0] : row.circuits)?.category ?? null,
    otherExpenses: ((exp ?? []) as any[]).map((e) => ({
      amount_mad: Number(e.amount_mad),
      main_cost_for: ((Array.isArray(e.cost_categories) ? e.cost_categories[0] : e.cost_categories)?.main_cost_for ?? []) as string[],
    })),
  };
}

/** Lecture d'un justificatif : URL signée de courte durée (bucket privé). */
export async function receiptUrl(path: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await staff();
  if (!ctx) return { ok: false, error: "Session expirée — reconnectez-vous." };
  if (!/^[0-9a-f-]{36}\/[^/]+$/i.test(path)) return { ok: false, error: "Justificatif invalide." };
  const { data, error } = await ctx.supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 300);
  if (error || !data) return { ok: false, error: "Justificatif introuvable." };
  return { ok: true, url: data.signedUrl };
}
