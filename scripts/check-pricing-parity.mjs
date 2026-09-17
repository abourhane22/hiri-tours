// Contrôle de non-régression du lot C1.
//
// Garantit que la généralisation de lib/pricing.ts n'a RIEN changé pour les
// produits vendus par personne — c'est-à-dire, au déploiement, la totalité du
// catalogue (sale_unit vaut 'per_person' par défaut).
//
//   npx tsx scripts/check-pricing-parity.mjs
//   (tsx est nécessaire : le script importe directement lib/pricing.ts)
//
// Compare, sur une matrice de cas, l'ancienne formule (figée en dur ci-dessous,
// telle qu'elle était avant C1) au nouveau computeLineTotal('per_person').
// Vérifie en plus le comportement attendu des trois autres unités.

import { computeLineTotal, computeReservationTotal, minDisplayPrice } from "../lib/pricing.ts";

/** Formule EXACTE d'avant C1, recopiée telle quelle comme référence. */
function legacyTotal({ basePriceMad, childPriceMad, adults, children, multiplier }) {
  const m = multiplier ?? 1;
  const baseAdult = Number(basePriceMad) || 0;
  const baseChild =
    childPriceMad === null || childPriceMad === undefined ? baseAdult : Number(childPriceMad) || 0;
  return adults * (baseAdult * m) + children * (baseChild * m);
}

const PRICES = [0, 250, 350, 550, 1850, 12999.99];
const CHILD = [null, undefined, 0, 120, 1200];
const ADULTS = [0, 1, 2, 4, 7, 20];
const CHILDREN = [0, 1, 3];
const MULT = [undefined, 1, 0.8, 1.25, 2];

let checked = 0;
const failures = [];

for (const basePriceMad of PRICES)
  for (const childPriceMad of CHILD)
    for (const adults of ADULTS)
      for (const children of CHILDREN)
        for (const multiplier of MULT) {
          const args = { basePriceMad, childPriceMad, adults, children, multiplier };
          const before = legacyTotal(args);
          const afterWrapper = computeReservationTotal(args);
          const afterDirect = computeLineTotal({
            saleUnit: "per_person",
            basePriceMad,
            childPriceMad,
            multiplier,
            quantity: { adults, children },
          });
          checked += 1;
          if (before !== afterWrapper || before !== afterDirect) {
            failures.push(
              `per_person ${JSON.stringify(args)} : avant=${before} wrapper=${afterWrapper} direct=${afterDirect}`,
            );
          }
        }

// --- Unités non per_person : comportement attendu, pax sans effet ------------
const unitCases = [
  { saleUnit: "per_trip", quantity: { adults: 7, children: 3, trips: 1 }, base: 250, expect: 250 },
  { saleUnit: "per_trip", quantity: { adults: 1, children: 0, trips: 3 }, base: 250, expect: 750 },
  { saleUnit: "per_night_room", quantity: { adults: 9, nights: 3, rooms: 2 }, base: 600, expect: 3600 },
  { saleUnit: "per_night_room", quantity: { adults: 2 }, base: 600, expect: 600 }, // défauts 1 nuit × 1 chambre
  { saleUnit: "per_unit", quantity: { units: 4, adults: 99 }, base: 80, expect: 320 },
  { saleUnit: "per_unit", quantity: {}, base: 80, expect: 80 },
];
for (const c of unitCases) {
  const got = computeLineTotal({
    saleUnit: c.saleUnit,
    basePriceMad: c.base,
    childPriceMad: 1, // doit être ignoré hors per_person
    quantity: c.quantity,
  });
  checked += 1;
  if (got !== c.expect) {
    failures.push(`${c.saleUnit} ${JSON.stringify(c.quantity)} base=${c.base} : attendu ${c.expect}, obtenu ${got}`);
  }
}

// --- « À partir de » : une unité de base, minimum sur les saisons ------------
const seasons = [{ starts_on: "2026-07-01", ends_on: "2026-08-31", price_multiplier: 1.3 }];
const promo = [{ starts_on: "2026-01-01", ends_on: "2026-02-28", price_multiplier: 0.8 }];
const displayCases = [
  { p: { base_price_mad: 1850, sale_unit: "per_person", circuit_seasons: seasons }, amount: 1850, suffix: "/ personne" },
  { p: { base_price_mad: 1850, sale_unit: "per_person", circuit_seasons: promo }, amount: 1480, suffix: "/ personne" },
  { p: { base_price_mad: 250, sale_unit: "per_trip", circuit_seasons: null }, amount: 250, suffix: "/ trajet" },
  { p: { base_price_mad: 600, sale_unit: "per_night_room", circuit_seasons: null }, amount: 600, suffix: "/ nuit" },
  { p: { base_price_mad: 80, sale_unit: null, circuit_seasons: null }, amount: 80, suffix: "/ personne" }, // repli
];
for (const c of displayCases) {
  const got = minDisplayPrice(c.p);
  checked += 1;
  if (got.amount !== c.amount || got.suffix !== c.suffix) {
    failures.push(
      `minDisplayPrice ${JSON.stringify(c.p)} : attendu ${c.amount} "${c.suffix}", obtenu ${got.amount} "${got.suffix}"`,
    );
  }
}

console.log(`${checked} cas vérifiés.`);
if (failures.length > 0) {
  console.error(`\n${failures.length} ÉCART(S) :`);
  failures.slice(0, 20).forEach((f) => console.error("  " + f));
  process.exit(1);
}
console.log("Parité per_person avec la formule d'avant C1 : OK — aucun prix ne change.");
console.log("Unités per_trip / per_night_room / per_unit : OK.");
