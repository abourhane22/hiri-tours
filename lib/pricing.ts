// Source de vérité unique du calcul de prix, quel que soit le type de produit.
// Utilisée par le formulaire client (affichage) ET les server actions (recalcul).
// Aucune autre couche ne calcule un prix.

import type { SaleUnit } from "@/lib/types";

export type PricingSeason = {
  starts_on: string;
  ends_on: string;
  price_multiplier: number | string;
};

/** Saison tarifaire couvrant la date de départ (ou null). */
export function findSeasonForDate<T extends { starts_on: string; ends_on: string }>(
  date: string,
  seasons: T[] | null | undefined,
): T | null {
  if (!date || !seasons) return null;
  return seasons.find((s) => date >= s.starts_on && date <= s.ends_on) ?? null;
}

/** Multiplicateur applicable à la date (1 si aucune saison). */
export function seasonMultiplier(
  date: string,
  seasons: PricingSeason[] | null | undefined,
): number {
  const s = findSeasonForDate(date, seasons ?? []);
  const m = s ? Number(s.price_multiplier) : 1;
  return Number.isFinite(m) && m > 0 ? m : 1;
}

/** Normalise un multiplicateur de saison (>0 fini, sinon 1). */
function normalizeMultiplier(m: number | string): number {
  const n = Number(m);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// ---------------------------------------------------------------------------
// Unités de vente
// ---------------------------------------------------------------------------

export const SALE_UNIT_LABEL: Record<SaleUnit, string> = {
  per_person: "Par personne",
  per_night_room: "Par chambre et par nuit",
  per_trip: "Par trajet",
  per_unit: "À l'unité",
};

/** Suffixe court pour les prix affichés : « 1 850 MAD / personne ». */
export const SALE_UNIT_SUFFIX: Record<SaleUnit, string> = {
  per_person: "/ personne",
  per_night_room: "/ nuit",
  per_trip: "/ trajet",
  per_unit: "/ unité",
};

export const SALE_UNITS: { value: SaleUnit; label: string; hint: string }[] = [
  { value: "per_person", label: SALE_UNIT_LABEL.per_person, hint: "Le total suit le nombre d'adultes et d'enfants." },
  { value: "per_night_room", label: SALE_UNIT_LABEL.per_night_room, hint: "Le total = nuits × chambres. Indépendant du nombre de personnes." },
  { value: "per_trip", label: SALE_UNIT_LABEL.per_trip, hint: "Prix forfaitaire du trajet, quel que soit le nombre de passagers." },
  { value: "per_unit", label: SALE_UNIT_LABEL.per_unit, hint: "Le total = quantité × prix unitaire." },
];

export function isSaleUnit(v: unknown): v is SaleUnit {
  return v === "per_person" || v === "per_night_room" || v === "per_trip" || v === "per_unit";
}

/** Quantités possibles d'une ligne ; seules celles de l'unité concernée sont lues. */
export type LineQuantity = {
  adults?: number;
  children?: number;
  nights?: number;
  rooms?: number;
  trips?: number;
  units?: number;
};

const positive = (n: number | undefined, fallback: number) =>
  Number.isFinite(n) && (n as number) > 0 ? (n as number) : fallback;

/**
 * Total d'une ligne de vente, aiguillé sur l'unité du produit.
 *
 *   per_person     adultes × (base × m) + enfants × ((enfant ?? base) × m)
 *   per_night_room nuits × chambres × (base × m)
 *   per_trip       trajets × (base × m)          — indépendant du pax
 *   per_unit       quantité × (base × m)
 *
 * `childPriceMad` null/undefined ⇒ retombe sur le prix adulte (0 reste 0).
 */
export function computeLineTotal(params: {
  saleUnit: SaleUnit;
  basePriceMad: number | string;
  childPriceMad?: number | string | null;
  multiplier?: number;
  quantity: LineQuantity;
}): number {
  const multiplier = params.multiplier ?? 1;
  const baseAdult = Number(params.basePriceMad) || 0;
  const effectiveAdult = baseAdult * multiplier;
  const q = params.quantity;

  switch (params.saleUnit) {
    case "per_night_room":
      return positive(q.nights, 1) * positive(q.rooms, 1) * effectiveAdult;

    case "per_trip":
      return positive(q.trips, 1) * effectiveAdult;

    case "per_unit":
      return positive(q.units, 1) * effectiveAdult;

    case "per_person":
    default: {
      const baseChild =
        params.childPriceMad === null || params.childPriceMad === undefined
          ? baseAdult
          : Number(params.childPriceMad) || 0;
      const adults = Number.isFinite(q.adults) ? (q.adults as number) : 0;
      const children = Number.isFinite(q.children) ? (q.children as number) : 0;
      return adults * effectiveAdult + children * (baseChild * multiplier);
    }
  }
}

/**
 * Total réservation par personne — enveloppe historique de `computeLineTotal`.
 * Conservée telle quelle : c'est la signature qu'utilisent le tunnel public,
 * la création backoffice et le formulaire client. Toute modification de la
 * formule doit passer par `computeLineTotal`.
 */
export function computeReservationTotal(params: {
  basePriceMad: number | string;
  childPriceMad: number | string | null | undefined;
  adults: number;
  children: number;
  multiplier?: number;
}): number {
  return computeLineTotal({
    saleUnit: "per_person",
    basePriceMad: params.basePriceMad,
    childPriceMad: params.childPriceMad,
    multiplier: params.multiplier,
    quantity: { adults: params.adults, children: params.children },
  });
}

/**
 * Prix minimum affichable en « à partir de », calculé avec la MÊME formule que
 * le tunnel — aucune divergence possible entre le prix vitrine et le prix fiche.
 *
 * Minimum sur : le tarif hors-saison (multiplicateur 1, toujours atteignable
 * pour une date non couverte) ET chaque saison définie. Ainsi une saison en
 * promotion (multiplicateur < 1) fait baisser le « à partir de », et le prix
 * affiché n'est jamais supérieur à un prix réellement réservable.
 *
 * L'unité est renvoyée avec le montant : « à partir de 250 MAD / trajet ».
 */
export function minDisplayPrice(product: {
  base_price_mad: number | string;
  sale_unit?: SaleUnit | null;
  circuit_seasons?: PricingSeason[] | null;
}): { amount: number; unit: SaleUnit; suffix: string } {
  const saleUnit: SaleUnit = isSaleUnit(product.sale_unit) ? product.sale_unit : "per_person";

  // Une unité de base pour chaque mode : 1 personne, 1 nuit × 1 chambre, 1 trajet, 1 unité.
  const priceForMultiplier = (multiplier: number) =>
    computeLineTotal({
      saleUnit,
      basePriceMad: product.base_price_mad,
      childPriceMad: null,
      multiplier,
      quantity: { adults: 1, children: 0, nights: 1, rooms: 1, trips: 1, units: 1 },
    });

  const candidates = [
    priceForMultiplier(1),
    ...(product.circuit_seasons ?? []).map((s) => priceForMultiplier(normalizeMultiplier(s.price_multiplier))),
  ];

  return { amount: Math.min(...candidates), unit: saleUnit, suffix: SALE_UNIT_SUFFIX[saleUnit] };
}

/**
 * Compatibilité : prix adulte minimum, sans l'unité.
 * @deprecated privilégier `minDisplayPrice` qui porte aussi l'unité de vente.
 */
export function minAdultPriceMad(circuit: {
  base_price_mad: number | string;
  sale_unit?: SaleUnit | null;
  circuit_seasons?: PricingSeason[] | null;
}): number {
  return minDisplayPrice(circuit).amount;
}
