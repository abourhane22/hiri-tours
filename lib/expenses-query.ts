// Requêtes de la liste des dépenses (serveur) — partagées par la page et l'export CSV.
// Filtres appliqués CÔTÉ SERVEUR ; la recherche texte sur des tables jointes (dossier,
// client, véhicule, fournisseur, produit) se fait en deux temps : résolution des
// identifiants, puis un seul filtre `or()` sur expenses (PostgREST ne filtre pas un
// `or()` à travers les jointures).

import type { SupabaseClient } from "@supabase/supabase-js";
import { attachmentOf, periodRange, type ExpenseAttachment, type ExpenseFilters } from "@/lib/expenses";

export const EXPENSE_PAGE_SIZE = 50;

export const EXPENSE_LIST_SELECT =
  "id, expense_date, amount_mad, description, notes, receipt_path, payment_method, departure_date, category_id, " +
  "reservation_id, circuit_id, vehicle_id, supplier_id, " +
  "cost_categories(name, type), reservation:reservations(reference, status, customers(full_name)), circuit:circuits(title), " +
  "vehicle:vehicles(registration, make, model), supplier:suppliers(name)";

export type ExpenseRow = {
  id: string;
  expense_date: string;
  amount_mad: number;
  description: string | null;
  notes: string | null;
  receipt_path: string | null;
  payment_method: string | null;
  departure_date: string | null;
  category_id: string;
  reservation_id: string | null;
  circuit_id: string | null;
  vehicle_id: string | null;
  supplier_id: string | null;
  category: { name: string; type: string } | null;
  reservation: { reference: string; status: string; customer: string | null } | null;
  circuit: { title: string } | null;
  vehicle: { registration: string; make: string | null; model: string | null } | null;
  supplier: { name: string } | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export function normalizeExpenseRow(r: any): ExpenseRow {
  const resa = one<any>(r.reservation);
  return {
    ...r,
    category: one(r.cost_categories),
    reservation: resa ? { reference: resa.reference, status: resa.status, customer: one<any>(resa.customers)?.full_name ?? null } : null,
    circuit: one(r.circuit),
    vehicle: one(r.vehicle),
    supplier: one(r.supplier),
  } as ExpenseRow;
}

export function vehicleLabel(v: { registration: string; make: string | null; model: string | null } | null): string {
  if (!v) return "";
  const mm = [v.make, v.model].filter(Boolean).join(" ");
  return mm ? `${mm} · ${v.registration}` : v.registration;
}

/** Caractères qui casseraient la syntaxe `or()` de PostgREST. */
const sanitize = (q: string) => q.replace(/[%,()*\\]/g, " ").trim();

/** Identifiants des entités jointes correspondant à la recherche. */
async function resolveSearch(supabase: SupabaseClient, q: string) {
  const s = sanitize(q);
  if (!s) return null;
  const like = `%${s}%`;
  const [resaRef, customers, vehicles, suppliers, circuits] = await Promise.all([
    supabase.from("reservations").select("id").ilike("reference", like).limit(200),
    supabase.from("customers").select("id").ilike("full_name", like).limit(200),
    supabase.from("vehicles").select("id").or(`registration.ilike.${like},make.ilike.${like},model.ilike.${like}`).limit(100),
    supabase.from("suppliers").select("id").ilike("name", like).limit(100),
    supabase.from("circuits").select("id").ilike("title", like).limit(100),
  ]);
  const customerIds = ((customers.data ?? []) as { id: string }[]).map((c) => c.id);
  let resaByCustomer: string[] = [];
  if (customerIds.length) {
    const { data } = await supabase.from("reservations").select("id").in("customer_id", customerIds).limit(500);
    resaByCustomer = ((data ?? []) as { id: string }[]).map((r) => r.id);
  }
  const ids = (res: { data: unknown }) => ((res.data ?? []) as { id: string }[]).map((x) => x.id);
  return {
    text: s,
    reservationIds: Array.from(new Set([...ids(resaRef), ...resaByCustomer])),
    vehicleIds: ids(vehicles),
    supplierIds: ids(suppliers),
    circuitIds: ids(circuits),
  };
}

type Builder = any; // PostgrestFilterBuilder — typé librement pour composer les filtres.

function applyAttachment(qb: Builder, att: ExpenseAttachment | ""): Builder {
  if (att === "dossier") return qb.not("reservation_id", "is", null);
  if (att === "produit") return qb.not("circuit_id", "is", null);
  if (att === "vehicule") return qb.is("reservation_id", null).is("circuit_id", null).not("vehicle_id", "is", null);
  if (att === "general") return qb.is("reservation_id", null).is("circuit_id", null).is("vehicle_id", null);
  return qb;
}

/** Filtres communs (tout sauf le rattachement et la pagination). */
function applyBase(qb: Builder, f: ExpenseFilters, range: { start: string; end: string }, search: Awaited<ReturnType<typeof resolveSearch>>): Builder {
  qb = qb.gte("expense_date", range.start).lte("expense_date", range.end);
  if (f.cat) qb = qb.eq("category_id", f.cat);
  if (f.vehicle) qb = qb.eq("vehicle_id", f.vehicle);
  if (f.noReceipt) qb = qb.is("receipt_path", null);
  if (f.reservation) qb = qb.eq("reservation_id", f.reservation);
  if (f.circuit) qb = qb.eq("circuit_id", f.circuit);
  if (search) {
    const parts = [`description.ilike.%${search.text}%`, `notes.ilike.%${search.text}%`];
    const inList = (col: string, list: string[]) => list.length && parts.push(`${col}.in.(${list.join(",")})`);
    inList("reservation_id", search.reservationIds);
    inList("vehicle_id", search.vehicleIds);
    inList("supplier_id", search.supplierIds);
    inList("circuit_id", search.circuitIds);
    qb = qb.or(parts.join(","));
  }
  return qb;
}

export type ExpenseListResult = {
  rows: ExpenseRow[];
  /** Nombre et total de la liste FILTRÉE (toutes pages). */
  filteredCount: number;
  filteredTotal: number;
  /** Compteurs des puces « Rattachée à » (filtres hors rattachement). */
  attachmentCounts: Record<ExpenseAttachment | "all", number>;
  kpi: { total: number; previousTotal: number; dossier: number; fleet: number; general: number; produit: number };
  range: ReturnType<typeof periodRange>;
  error: { message?: string; code?: string } | null;
};

export async function listExpenses(supabase: SupabaseClient, f: ExpenseFilters, opts: { paginate: boolean } = { paginate: true }): Promise<ExpenseListResult> {
  const range = periodRange(f);
  const search = f.q ? await resolveSearch(supabase, f.q) : null;

  const light = "id, amount_mad, reservation_id, circuit_id, vehicle_id";
  const [scopeRes, periodRes, prevRes] = await Promise.all([
    applyBase(supabase.from("expenses").select(light), f, range, search),
    // KPI : la période seule (sans recherche ni catégorie), et la période précédente.
    supabase.from("expenses").select(light).gte("expense_date", range.start).lte("expense_date", range.end),
    supabase.from("expenses").select("amount_mad").gte("expense_date", range.prevStart).lte("expense_date", range.prevEnd),
  ]);
  const error = scopeRes.error ?? periodRes.error ?? prevRes.error ?? null;

  type Light = { id: string; amount_mad: number; reservation_id: string | null; circuit_id: string | null; vehicle_id: string | null };
  const scope = (scopeRes.data ?? []) as Light[];
  const counts: Record<ExpenseAttachment | "all", number> = { all: scope.length, dossier: 0, produit: 0, vehicule: 0, general: 0 };
  for (const e of scope) counts[attachmentOf(e)] += 1;
  const filtered = f.att ? scope.filter((e) => attachmentOf(e) === f.att) : scope;
  const sum = (l: { amount_mad: number | string }[]) => Math.round(l.reduce((s, e) => s + Number(e.amount_mad), 0) * 100) / 100;

  const period = (periodRes.data ?? []) as Light[];
  const kpi = {
    total: sum(period),
    previousTotal: sum((prevRes.data ?? []) as { amount_mad: number }[]),
    dossier: sum(period.filter((e) => e.reservation_id)),
    produit: sum(period.filter((e) => e.circuit_id)),
    // Flotte : toute dépense portant un véhicule, quel que soit son rattachement principal.
    fleet: sum(period.filter((e) => e.vehicle_id)),
    general: sum(period.filter((e) => attachmentOf(e) === "general")),
  };

  let rowsQ = applyAttachment(applyBase(supabase.from("expenses").select(EXPENSE_LIST_SELECT), f, range, search), f.att)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts.paginate) {
    const from = (f.page - 1) * EXPENSE_PAGE_SIZE;
    rowsQ = rowsQ.range(from, from + EXPENSE_PAGE_SIZE - 1);
  }
  const rowsRes = await rowsQ;

  return {
    rows: ((rowsRes.data ?? []) as any[]).map(normalizeExpenseRow),
    filteredCount: filtered.length,
    filteredTotal: sum(filtered),
    attachmentCounts: counts,
    kpi,
    range,
    error: error ?? rowsRes.error ?? null,
  };
}
