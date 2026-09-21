// E/S du coût prévisionnel : résolution du tarif d'achat (lib/purchasing),
// calcul (lib/margin) et FIGEMENT sur le dossier. Appelé à la création
// (backoffice, tunnel, billetterie) et sur action explicite uniquement.

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePurchaseRate, rateCurrency } from "@/lib/purchasing";
import { isSaleUnit } from "@/lib/pricing";
import { normalizeQuantity } from "@/lib/booking";
import {
  computeExpectedCost,
  distributionCostSnapshot,
  withPrevious,
  type CostSnapshot,
  type ExpectedCostReasonCode,
} from "@/lib/margin";
import type { PurchaseRate, SaleUnit } from "@/lib/types";

export type SnapshotOutcome =
  | { ok: true; cost: number; source: CostSnapshot["source"] }
  | { ok: false; code: ExpectedCostReasonCode | "not_found" | "write_error"; reason: string };

async function loadFxRates(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data } = await supabase.from("company_settings").select("fx_rates").limit(1).maybeSingle();
  const raw = (data as { fx_rates?: unknown } | null)?.fx_rates;
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k.toUpperCase()] = n;
    }
  }
  return out;
}

/**
 * Calcule et fige le coût prévisionnel d'un dossier.
 * - `force: false` (défaut) : ne fait rien si un snapshot existe déjà.
 * - `force: true` : recalcul explicite, l'ancien snapshot va dans previous[].
 * Un échec de calcul (pas de tarif, taux manquant) n'écrit rien et renvoie la raison.
 */
export async function computeAndStoreExpectedCost(
  supabase: SupabaseClient,
  reservationId: string,
  opts: { actorId?: string | null; force?: boolean; reason?: string | null } = {},
): Promise<SnapshotOutcome> {
  const { data: resa } = await supabase
    .from("reservations")
    .select(
      "id, circuit_id, departure_date, adults, children, trips, nights, rooms, units, cost_snapshot, circuits(sale_unit, category_fields, internal_unit_cost_mad, internal_child_cost_mad)",
    )
    .eq("id", reservationId)
    .maybeSingle();
  if (!resa) return { ok: false, code: "not_found", reason: "dossier introuvable" };
  const r = resa as any;
  if (r.cost_snapshot && !opts.force) {
    const s = r.cost_snapshot as CostSnapshot;
    return { ok: true, cost: Number(s.cost_mad), source: s.source };
  }
  const product = Array.isArray(r.circuits) ? r.circuits[0] : r.circuits;
  const saleUnit: SaleUnit = isSaleUnit(product?.sale_unit) ? product.sale_unit : "per_person";
  const quantities = normalizeQuantity(saleUnit, {
    adults: r.adults,
    children: r.children,
    trips: r.trips,
    nights: r.nights,
    rooms: r.rooms,
    units: r.units,
  });

  // Tarifs d'achat du produit (spécifiques + génériques) et contrats associés, avec le fournisseur.
  const { data: rateRows } = await supabase
    .from("purchase_rates")
    .select("*, supplier_contracts(id, status, valid_from, valid_to, currency, supplier_id, suppliers(name))")
    .or(`product_id.eq.${r.circuit_id},product_id.is.null`)
    .lte("valid_from", r.departure_date)
    .gte("valid_to", r.departure_date);
  const rates = ((rateRows ?? []) as any[]).map((x) => {
    const { supplier_contracts: _c, ...rate } = x;
    return rate as PurchaseRate;
  });
  const contracts = ((rateRows ?? []) as any[])
    .map((x) => (Array.isArray(x.supplier_contracts) ? x.supplier_contracts[0] : x.supplier_contracts))
    .filter(Boolean);
  const cf = (product?.category_fields ?? {}) as Record<string, unknown>;
  const conditions: Record<string, unknown> = {};
  if (typeof cf.room_type === "string") conditions.room_type = cf.room_type;
  if (typeof cf.travel_class === "string") conditions.travel_class = cf.travel_class;

  const rate = resolvePurchaseRate(rates, contracts, {
    productId: r.circuit_id,
    date: r.departure_date,
    pax: quantities.adults + quantities.children,
    conditions,
  });
  const contract = rate ? contracts.find((c: any) => c.id === rate.contract_id) : null;

  const fxRates = await loadFxRates(supabase);
  const result = computeExpectedCost({
    saleUnit,
    quantities,
    rate: rate
      ? {
          unit_cost: Number(rate.unit_cost_mad),
          child_cost: rate.child_cost_mad === null ? null : Number(rate.child_cost_mad),
          currency: rateCurrency(rate, contract ?? undefined),
          rate_id: rate.id,
          contract_id: rate.contract_id,
          supplier_id: contract?.supplier_id ?? null,
          supplier_name: (Array.isArray(contract?.suppliers) ? contract?.suppliers[0] : contract?.suppliers)?.name ?? null,
        }
      : null,
    internal: product ? { unit_cost: product.internal_unit_cost_mad, child_cost: product.internal_child_cost_mad } : null,
    fxRates,
    computedBy: opts.actorId ?? null,
  });
  if (!result.ok) return result;

  const snapshot = withPrevious(r.cost_snapshot as CostSnapshot | null, result.snapshot, opts.reason ?? (opts.force ? "recalcul explicite" : null));
  const { error } = await supabase
    .from("reservations")
    .update({ expected_cost_mad: result.cost, cost_snapshot: snapshot, cost_snapshot_at: snapshot.computed_at })
    .eq("id", reservationId);
  if (error) return { ok: false, code: "write_error", reason: error.message };
  return { ok: true, cost: result.cost, source: snapshot.source };
}

/** Billetterie : le coût prévisionnel est le montant figé de l'offre (source `distribution`). */
export async function storeDistributionCost(
  supabase: SupabaseClient,
  reservationId: string,
  input: { amount: number; currency: string; fxRate: number; amountMad: number; pax: { adults: number; children: number }; supplierName: string | null; actorId?: string | null },
): Promise<SnapshotOutcome> {
  const snapshot = distributionCostSnapshot({
    amount: input.amount,
    currency: input.currency,
    fxRate: input.fxRate,
    amountMad: input.amountMad,
    quantities: { adults: input.pax.adults, children: input.pax.children, trips: 1, nights: 1, rooms: 1, units: 1 },
    supplierName: input.supplierName,
    computedBy: input.actorId ?? null,
  });
  const { error } = await supabase
    .from("reservations")
    .update({ expected_cost_mad: snapshot.cost_mad, cost_snapshot: snapshot, cost_snapshot_at: snapshot.computed_at })
    .eq("id", reservationId);
  if (error) return { ok: false, code: "write_error", reason: error.message };
  return { ok: true, cost: snapshot.cost_mad, source: "distribution" };
}
