// Source de vérité unique du calcul de prix d'une réservation.
// Utilisée par le formulaire client (affichage) ET la server action (recalcul).

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

/**
 * Total réservation = adultes × (base × mult) + enfants × ((enfant ?? base) × mult).
 * `childPriceMad` null/undefined ⇒ retombe sur le prix adulte (0 reste 0).
 */
export function computeReservationTotal(params: {
  basePriceMad: number | string;
  childPriceMad: number | string | null | undefined;
  adults: number;
  children: number;
  multiplier?: number;
}): number {
  const multiplier = params.multiplier ?? 1;
  const baseAdult = Number(params.basePriceMad) || 0;
  const baseChild =
    params.childPriceMad === null || params.childPriceMad === undefined
      ? baseAdult
      : Number(params.childPriceMad) || 0;
  const effectiveAdult = baseAdult * multiplier;
  const effectiveChild = baseChild * multiplier;
  return params.adults * effectiveAdult + params.children * effectiveChild;
}

/** Normalise un multiplicateur de saison (>0 fini, sinon 1). */
function normalizeMultiplier(m: number | string): number {
  const n = Number(m);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Prix adulte minimum affichable en « à partir de », calculé avec la MÊME
 * formule que le tunnel (computeReservationTotal, 1 adulte) — aucune
 * divergence possible entre le prix vitrine et le prix fiche.
 *
 * Minimum sur : le tarif hors-saison (multiplicateur 1, toujours atteignable
 * dans le tunnel pour une date non couverte) ET chaque saison définie. Ainsi
 * une saison en promotion (multiplicateur < 1) fait baisser le « à partir de »,
 * et le prix affiché n'est jamais supérieur à un prix réellement réservable.
 */
export function minAdultPriceMad(circuit: {
  base_price_mad: number | string;
  circuit_seasons?: PricingSeason[] | null;
}): number {
  const priceForMultiplier = (multiplier: number) =>
    computeReservationTotal({
      basePriceMad: circuit.base_price_mad,
      childPriceMad: null,
      adults: 1,
      children: 0,
      multiplier,
    });

  const candidates = [
    priceForMultiplier(1),
    ...(circuit.circuit_seasons ?? []).map((s) =>
      priceForMultiplier(normalizeMultiplier(s.price_multiplier)),
    ),
  ];
  return Math.min(...candidates);
}
