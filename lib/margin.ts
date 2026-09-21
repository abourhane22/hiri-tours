// Autorité unique de la MARGE — comme lib/pricing.ts l'est du prix de vente et
// lib/purchasing.ts du tarif d'achat. Aucune autre couche ne soustrait un coût
// d'un prix : fiche dossier, Rentabilité, Rapports et grille C2a appellent ici.
//
// Fonctions pures, testables ; les E/S (résolution des tarifs, écriture du
// snapshot) vivent dans lib/cost-snapshot.ts.

import type { SaleUnit } from "@/lib/types";
import type { BookingQuantity } from "@/lib/booking";

// ---------------------------------------------------------------------------
// Snapshot du coût prévisionnel (figé sur le dossier)
// ---------------------------------------------------------------------------

export type CostSource = "contract" | "interne" | "distribution";

export type CostSnapshotPrevious = {
  cost_mad: number | null;
  source: CostSource | null;
  computed_at: string;
  computed_by: string | null;
  replaced_at: string;
  reason: string | null;
};

export type CostSnapshot = {
  source: CostSource;
  rate_id: string | null;
  contract_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  /** Coût unitaire dans la devise d'origine. */
  unit_cost: number;
  child_cost: number | null;
  currency: string;
  /** MAD pour 1 unité de devise (1 si MAD). */
  fx_rate: number;
  fx_source: "mad" | "parametres" | "distribution";
  sale_unit: SaleUnit;
  quantities: BookingQuantity;
  /** Coût total figé, en MAD. */
  cost_mad: number;
  computed_at: string;
  computed_by: string | null;
  previous?: CostSnapshotPrevious[];
};

export type ExpectedCostReasonCode = "no_rate" | "fx_missing" | "no_quantity";

export type ExpectedCostResult =
  | { ok: true; cost: number; snapshot: CostSnapshot }
  | { ok: false; code: ExpectedCostReasonCode; reason: string };

export const EXPECTED_COST_REASON_LABEL: Record<ExpectedCostReasonCode, string> = {
  no_rate: "aucun tarif d'achat résolu ni coût interne sur le produit",
  fx_missing: "taux de change manquant (Paramètres › Société › Devises)",
  no_quantity: "quantités du dossier invalides",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Unités facturées par le fournisseur selon l'unité de vente — symétrique de
 * computeLineTotal : per_person → adultes (+ enfants au coût enfant), per_trip →
 * trajets, per_night_room → nuits × chambres, per_unit → unités.
 */
export function costUnits(saleUnit: SaleUnit, q: BookingQuantity): { main: number; children: number } {
  switch (saleUnit) {
    case "per_trip":
      return { main: Math.max(0, q.trips), children: 0 };
    case "per_night_room":
      return { main: Math.max(0, q.nights) * Math.max(0, q.rooms), children: 0 };
    case "per_unit":
      return { main: Math.max(0, q.units), children: 0 };
    case "per_person":
    default:
      return { main: Math.max(0, q.adults), children: Math.max(0, q.children) };
  }
}

export type RateInput = {
  unit_cost: number;
  child_cost: number | null;
  currency: string;
  rate_id?: string | null;
  contract_id?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
};

/**
 * Coût prévisionnel d'un dossier. Priorité : tarif d'achat résolu (source
 * `contract`), sinon coût interne du produit (source `interne`), sinon
 * « non renseigné » — jamais 0 ni 100 % de marge par défaut. Une devise ≠ MAD
 * sans taux dans `fxRates` ⇒ non renseigné (taux manquant).
 */
export function computeExpectedCost(input: {
  saleUnit: SaleUnit;
  quantities: BookingQuantity;
  rate: RateInput | null;
  internal: { unit_cost: number | null | undefined; child_cost: number | null | undefined } | null;
  fxRates: Record<string, number>;
  computedBy?: string | null;
  now?: string;
}): ExpectedCostResult {
  const units = costUnits(input.saleUnit, input.quantities);
  if (units.main <= 0 && units.children <= 0) {
    return { ok: false, code: "no_quantity", reason: EXPECTED_COST_REASON_LABEL.no_quantity };
  }

  let source: CostSource;
  let rate: RateInput;
  if (input.rate) {
    source = "contract";
    rate = input.rate;
  } else if (input.internal && input.internal.unit_cost !== null && input.internal.unit_cost !== undefined && Number.isFinite(Number(input.internal.unit_cost))) {
    source = "interne";
    rate = {
      unit_cost: Number(input.internal.unit_cost),
      child_cost: input.internal.child_cost === null || input.internal.child_cost === undefined ? null : Number(input.internal.child_cost),
      currency: "MAD",
    };
  } else {
    return { ok: false, code: "no_rate", reason: EXPECTED_COST_REASON_LABEL.no_rate };
  }

  const currency = (rate.currency || "MAD").toUpperCase();
  let fx = 1;
  let fxSource: CostSnapshot["fx_source"] = "mad";
  if (currency !== "MAD") {
    const r = Number(input.fxRates[currency]);
    if (!Number.isFinite(r) || r <= 0) {
      return { ok: false, code: "fx_missing", reason: `taux ${currency} manquant (Paramètres › Société › Devises)` };
    }
    fx = r;
    fxSource = "parametres";
  }

  const unit = Number(rate.unit_cost) || 0;
  const child = rate.child_cost === null || rate.child_cost === undefined ? unit : Number(rate.child_cost) || 0;
  const cost = round2((units.main * unit + units.children * child) * fx);

  return {
    ok: true,
    cost,
    snapshot: {
      source,
      rate_id: rate.rate_id ?? null,
      contract_id: rate.contract_id ?? null,
      supplier_id: rate.supplier_id ?? null,
      supplier_name: rate.supplier_name ?? null,
      unit_cost: unit,
      child_cost: rate.child_cost === null || rate.child_cost === undefined ? null : Number(rate.child_cost),
      currency,
      fx_rate: fx,
      fx_source: fxSource,
      sale_unit: input.saleUnit,
      quantities: input.quantities,
      cost_mad: cost,
      computed_at: input.now ?? new Date().toISOString(),
      computed_by: input.computedBy ?? null,
    },
  };
}

/** Snapshot « distribution » (billetterie) : le coût est le montant figé de l'offre. */
export function distributionCostSnapshot(input: {
  amount: number;
  currency: string;
  fxRate: number;
  amountMad: number;
  quantities: BookingQuantity;
  supplierName: string | null;
  computedBy?: string | null;
  now?: string;
}): CostSnapshot {
  return {
    source: "distribution",
    rate_id: null,
    contract_id: null,
    supplier_id: null,
    supplier_name: input.supplierName,
    unit_cost: input.amount,
    child_cost: null,
    currency: input.currency.toUpperCase(),
    fx_rate: input.fxRate,
    fx_source: "distribution",
    sale_unit: "per_unit",
    quantities: input.quantities,
    cost_mad: round2(input.amountMad),
    computed_at: input.now ?? new Date().toISOString(),
    computed_by: input.computedBy ?? null,
  };
}

/** Nouveau snapshot en conservant l'historique de l'ancien (recalcul explicite uniquement). */
export function withPrevious(old: CostSnapshot | null | undefined, next: CostSnapshot, reason: string | null = null): CostSnapshot {
  if (!old) return next;
  const entry: CostSnapshotPrevious = {
    cost_mad: old.cost_mad ?? null,
    source: old.source ?? null,
    computed_at: old.computed_at,
    computed_by: old.computed_by ?? null,
    replaced_at: next.computed_at,
    reason,
  };
  return { ...next, previous: [...(old.previous ?? []), entry] };
}

// ---------------------------------------------------------------------------
// Marge, écart, couleur
// ---------------------------------------------------------------------------

export type MarginResult = { amount: number | null; pct: number | null };

/** Marge = vente − coût. Coût null ⇒ non renseignée. % null si vente = 0. */
export function margin(saleMad: number, costMad: number | null | undefined): MarginResult {
  if (costMad === null || costMad === undefined || !Number.isFinite(Number(costMad))) return { amount: null, pct: null };
  const amount = round2(Number(saleMad) - Number(costMad));
  const pct = Number(saleMad) > 0 ? Math.round((amount / Number(saleMad)) * 1000) / 10 : null;
  return { amount, pct };
}

/** Écart réel − prévisionnel (positif = on a dépensé plus que prévu). */
export function variance(expectedCost: number | null | undefined, realCost: number | null | undefined): MarginResult {
  if (expectedCost === null || expectedCost === undefined || realCost === null || realCost === undefined) return { amount: null, pct: null };
  const amount = round2(Number(realCost) - Number(expectedCost));
  const pct = Number(expectedCost) > 0 ? Math.round((amount / Number(expectedCost)) * 1000) / 10 : null;
  return { amount, pct };
}

export type MarginTone = "good" | "neutral" | "low" | "negative" | "unknown";

/** Seuils validés : ≥ 25 % bon · 10–25 % neutre · 0–10 % faible · < 0 négatif. */
export function marginTone(pct: number | null | undefined): MarginTone {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "unknown";
  if (pct >= 25) return "good";
  if (pct >= 10) return "neutral";
  if (pct >= 0) return "low";
  return "negative";
}

export const MARGIN_TONE_STYLE: Record<MarginTone, { color: string; bg: string; label: string }> = {
  good: { color: "#085041", bg: "#E1F5EE", label: "Bonne marge" },
  neutral: { color: "#1A1F2E", bg: "#F1EFE8", label: "Marge correcte" },
  low: { color: "#B25F0B", bg: "#FAEEDA", label: "Marge faible" },
  negative: { color: "#B42318", bg: "#FCEBEB", label: "Marge négative" },
  unknown: { color: "#968F84", bg: "#F1EFE8", label: "Non renseignée" },
};

/** Ton de l'écart : dépenser moins que prévu est bon, plus de 10 % de plus est un signal. */
export function varianceTone(v: MarginResult): MarginTone {
  if (v.amount === null) return "unknown";
  if (v.amount <= 0) return "good";
  if (v.pct !== null && v.pct > 10) return "negative";
  return "low";
}

/** Coût réel = somme des dépenses explicitement rattachées au dossier. */
export function realCost(expenses: { amount_mad: number | string }[]): number | null {
  if (expenses.length === 0) return null;
  return round2(expenses.reduce((s, e) => s + (Number(e.amount_mad) || 0), 0));
}

export const COST_SOURCE_LABEL: Record<CostSource, string> = {
  contract: "Tarif d'achat (contrat)",
  interne: "Coût interne du produit",
  distribution: "Distribution aérienne (offre figée)",
};

export function formatPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "—";
  return `${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}
