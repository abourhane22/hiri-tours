// Autorité unique du COÛT D'ACHAT, comme lib/pricing.ts l'est du prix de vente.
//
// Les tarifs d'achat se chevauchent légitimement (un tarif propre au produit ET
// un tarif générique du contrat, plusieurs paliers de pax). La base ne tranche
// donc pas : c'est `resolvePurchaseRate` qui le fait, de façon déterministe et
// testable — aucune autre couche ne choisit un tarif.

import type {
  CancellationStep,
  ContractStatus,
  PaymentTerms,
  PurchaseRate,
  RemunerationMode,
  SupplierContract,
  SupplierType,
} from "@/lib/types";
import { margin as computeMargin } from "@/lib/margin";

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

export const SUPPLIER_TYPE_LABEL: Record<SupplierType, string> = {
  hotel: "Hôtel / hébergeur",
  transporteur: "Transporteur",
  compagnie: "Compagnie (air, mer, rail)",
  receptif: "Réceptif / DMC",
  prestataire: "Prestataire de services",
  autre: "Autre",
};

export const SUPPLIER_TYPES = (Object.keys(SUPPLIER_TYPE_LABEL) as SupplierType[]).map((value) => ({
  value,
  label: SUPPLIER_TYPE_LABEL[value],
}));

export const PAYMENT_TERMS_LABEL: Record<PaymentTerms, string> = {
  comptant: "Comptant",
  "15j": "15 jours",
  "30j": "30 jours",
  "45j": "45 jours",
  "60j": "60 jours",
  fin_de_mois: "Fin de mois",
};

export const PAYMENT_TERMS_OPTIONS = (Object.keys(PAYMENT_TERMS_LABEL) as PaymentTerms[]).map((value) => ({
  value,
  label: PAYMENT_TERMS_LABEL[value],
}));

export const REMUNERATION_LABEL: Record<RemunerationMode, string> = {
  commission: "Commission",
  markup: "Marge (markup)",
  net: "Prix net négocié",
};

export const REMUNERATION_HINT: Record<RemunerationMode, string> = {
  commission: "On vend le prix public du fournisseur ; il reverse un pourcentage à l'agence.",
  markup: "On achète net et l'agence ajoute sa marge pour fixer le prix de vente.",
  net: "Prix d'achat négocié ; le prix de vente est libre.",
};

export const REMUNERATION_MODES = (Object.keys(REMUNERATION_LABEL) as RemunerationMode[]).map((value) => ({
  value,
  label: REMUNERATION_LABEL[value],
  hint: REMUNERATION_HINT[value],
}));

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Brouillon",
  active: "Actif",
  expired: "Expiré",
  terminated: "Résilié",
};

export const CONTRACT_STATUS_STYLE: Record<ContractStatus, { bg: string; color: string }> = {
  draft: { bg: "#F1EFE8", color: "#5F5E5A" },
  active: { bg: "#E1F5EE", color: "#085041" },
  expired: { bg: "#FAEEDA", color: "#633806" },
  terminated: { bg: "#FCEBEB", color: "#791F1F" },
};

export function isSupplierType(v: unknown): v is SupplierType {
  return typeof v === "string" && v in SUPPLIER_TYPE_LABEL;
}
export function isPaymentTerms(v: unknown): v is PaymentTerms {
  return typeof v === "string" && v in PAYMENT_TERMS_LABEL;
}
export function isRemunerationMode(v: unknown): v is RemunerationMode {
  return typeof v === "string" && v in REMUNERATION_LABEL;
}
export function isContractStatus(v: unknown): v is ContractStatus {
  return typeof v === "string" && v in CONTRACT_STATUS_LABEL;
}

// ---------------------------------------------------------------------------
// Résolution déterministe du tarif d'achat
// ---------------------------------------------------------------------------

/** Contrat tel que nécessaire à la résolution (sous-ensemble de SupplierContract). */
export type RateContractContext = Pick<
  SupplierContract,
  "id" | "status" | "valid_from" | "valid_to" | "currency"
>;

export type ResolveInput = {
  productId: string;
  /** Date de la prestation (départ / nuitée), au format YYYY-MM-DD. */
  date: string;
  /** Nombre de personnes, pour les paliers dégressifs. */
  pax?: number;
  /** Conditions exigées (room_type, travel_class…) ; toutes doivent correspondre. */
  conditions?: Record<string, unknown>;
};

const within = (date: string, from: string, to: string) => date >= from && date <= to;

/** Largeur du palier de pax ; non borné = +∞ (donc le moins spécifique). */
function paxWindowWidth(rate: PurchaseRate): number {
  if (rate.min_pax === null && rate.max_pax === null) return Number.POSITIVE_INFINITY;
  const min = rate.min_pax ?? 1;
  const max = rate.max_pax ?? Number.MAX_SAFE_INTEGER;
  return max - min;
}

function paxMatches(rate: PurchaseRate, pax: number | undefined): boolean {
  if (pax === undefined) return rate.min_pax === null && rate.max_pax === null;
  if (rate.min_pax !== null && pax < rate.min_pax) return false;
  if (rate.max_pax !== null && pax > rate.max_pax) return false;
  return true;
}

function conditionsMatch(rate: PurchaseRate, wanted: Record<string, unknown> | undefined): boolean {
  if (!wanted) return true;
  for (const [k, v] of Object.entries(wanted)) {
    if (v === undefined || v === null || v === "") continue;
    if (rate.conditions?.[k] !== undefined && rate.conditions[k] !== v) return false;
  }
  return true;
}

/** Durée d'une période tarifaire en jours, pour départager. */
function periodLength(rate: PurchaseRate): number {
  const from = Date.parse(rate.valid_from);
  const to = Date.parse(rate.valid_to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((to - from) / 86400000));
}

/**
 * Tarif d'achat applicable, ou null. Fonction PURE : les tarifs et les contrats
 * sont passés en argument, aucune E/S — donc testable exhaustivement.
 *
 * Filtrage : date dans la période du tarif ET dans celle du contrat · contrat
 * `active` · tarif du produit OU générique · palier de pax compatible ·
 * conditions compatibles.
 *
 * Départage, dans cet ordre strict :
 *   1. tarif spécifique au produit avant tarif générique
 *   2. priority décroissante
 *   3. palier de pax le plus étroit
 *   4. valid_from la plus récente
 *   5. période la plus courte
 *   6. id croissant — départage stable, jamais de résultat non déterministe
 */
export function resolvePurchaseRate(
  rates: PurchaseRate[],
  contracts: RateContractContext[],
  input: ResolveInput,
): PurchaseRate | null {
  const contractById = new Map(contracts.map((c) => [c.id, c]));

  const candidates = rates.filter((r) => {
    if (r.product_id !== null && r.product_id !== input.productId) return false;
    if (!within(input.date, r.valid_from, r.valid_to)) return false;
    if (!paxMatches(r, input.pax)) return false;
    if (!conditionsMatch(r, input.conditions)) return false;

    const c = contractById.get(r.contract_id);
    if (!c) return false; // contrat non fourni : on ne devine pas
    if (c.status !== "active") return false;
    if (!within(input.date, c.valid_from, c.valid_to)) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    // 1. spécifique produit avant générique
    const aSpecific = a.product_id !== null ? 0 : 1;
    const bSpecific = b.product_id !== null ? 0 : 1;
    if (aSpecific !== bSpecific) return aSpecific - bSpecific;
    // 2. priority décroissante
    if (a.priority !== b.priority) return b.priority - a.priority;
    // 3. palier de pax le plus étroit
    const aw = paxWindowWidth(a);
    const bw = paxWindowWidth(b);
    if (aw !== bw) return aw - bw;
    // 4. valid_from la plus récente
    if (a.valid_from !== b.valid_from) return a.valid_from < b.valid_from ? 1 : -1;
    // 5. période la plus courte
    const al = periodLength(a);
    const bl = periodLength(b);
    if (al !== bl) return al - bl;
    // 6. départage stable
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return sorted[0];
}

/** Devise effective d'un tarif (héritée du contrat si non surchargée). */
export function rateCurrency(rate: PurchaseRate, contract: RateContractContext | undefined): string {
  return rate.currency ?? contract?.currency ?? "MAD";
}

/**
 * Marge indicative d'un produit face à un tarif d'achat (prix catalogue − coût
 * unitaire). Même calcul que la carte Marge des dossiers : lib/margin.ts est la
 * seule autorité, ceci n'est qu'un alias typé pour la grille C2a.
 */
export function indicativeMargin(salePriceMad: number, purchaseCostMad: number): { amount: number; pct: number | null } {
  const m = computeMargin(salePriceMad, purchaseCostMad);
  return { amount: m.amount ?? 0, pct: m.pct };
}

/** Libellé lisible d'un barème d'annulation, pour l'affichage. */
export function describeCancellationStep(step: CancellationStep): string {
  const when = step.days_before > 0 ? `à plus de ${step.days_before} j du départ` : "le jour du départ";
  return `${when} · pénalité ${step.penalty_pct} %`;
}
