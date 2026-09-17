// Contrôle du lot C2a : `resolvePurchaseRate` est l'autorité unique du coût
// d'achat, comme `computeLineTotal` l'est du prix de vente. Elle doit être
// DÉTERMINISTE — jamais deux résultats possibles pour une même entrée.
//
//   npx tsx scripts/check-purchase-rate-resolution.mjs

import { resolvePurchaseRate } from "../lib/purchasing.ts";

const PROD_A = "aaaaaaaa-0000-0000-0000-000000000001";
const PROD_B = "bbbbbbbb-0000-0000-0000-000000000002";
const CONTRACT = "cccccccc-0000-0000-0000-000000000003";

const contracts = [
  { id: CONTRACT, status: "active", valid_from: "2026-01-01", valid_to: "2026-12-31", currency: "MAD" },
  { id: "expired", status: "expired", valid_from: "2026-01-01", valid_to: "2026-12-31", currency: "MAD" },
];

let seq = 0;
const rate = (o) => ({
  id: `rate-${String(++seq).padStart(3, "0")}`,
  contract_id: CONTRACT,
  product_id: null,
  valid_from: "2026-01-01",
  valid_to: "2026-12-31",
  unit_cost_mad: 100,
  child_cost_mad: null,
  currency: null,
  min_pax: null,
  max_pax: null,
  conditions: {},
  priority: 0,
  notes: null,
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...o,
});

const failures = [];
let checked = 0;

function expect(label, got, wantId) {
  checked += 1;
  const gotId = got?.id ?? null;
  if (gotId !== wantId) failures.push(`${label} : attendu ${wantId}, obtenu ${gotId}`);
}

// 1. Aucun tarif → null
expect("aucun tarif", resolvePurchaseRate([], contracts, { productId: PROD_A, date: "2026-06-01" }), null);

// 2. Hors période → null
const horsPeriode = rate({ valid_from: "2026-07-01", valid_to: "2026-08-31" });
expect("hors période", resolvePurchaseRate([horsPeriode], contracts, { productId: PROD_A, date: "2026-06-01" }), null);

// 3. Contrat non actif → ignoré
const surContratExpire = rate({ contract_id: "expired", product_id: PROD_A });
expect("contrat expiré ignoré", resolvePurchaseRate([surContratExpire], contracts, { productId: PROD_A, date: "2026-06-01" }), null);

// 4. Tarif d'un AUTRE produit → ignoré
const autreProduit = rate({ product_id: PROD_B });
expect("autre produit ignoré", resolvePurchaseRate([autreProduit], contracts, { productId: PROD_A, date: "2026-06-01" }), null);

// 5. Spécifique produit l'emporte sur générique
const generique = rate({ product_id: null, unit_cost_mad: 100 });
const specifique = rate({ product_id: PROD_A, unit_cost_mad: 90 });
expect(
  "spécifique > générique",
  resolvePurchaseRate([generique, specifique], contracts, { productId: PROD_A, date: "2026-06-01" }),
  specifique.id,
);
// … et l'ordre d'entrée ne change rien
expect(
  "spécifique > générique (ordre inversé)",
  resolvePurchaseRate([specifique, generique], contracts, { productId: PROD_A, date: "2026-06-01" }),
  specifique.id,
);

// 6. Priorité décroissante
const prio0 = rate({ product_id: PROD_A, priority: 0 });
const prio5 = rate({ product_id: PROD_A, priority: 5 });
expect("priorité la plus haute", resolvePurchaseRate([prio0, prio5], contracts, { productId: PROD_A, date: "2026-06-01" }), prio5.id);

// 7. Palier de pax : le plus étroit gagne
const large = rate({ product_id: PROD_A, min_pax: 1, max_pax: 100 });
const etroit = rate({ product_id: PROD_A, min_pax: 4, max_pax: 6 });
expect(
  "palier le plus étroit",
  resolvePurchaseRate([large, etroit], contracts, { productId: PROD_A, date: "2026-06-01", pax: 5 }),
  etroit.id,
);
// Hors du palier étroit → retombe sur le large
expect(
  "hors palier étroit",
  resolvePurchaseRate([large, etroit], contracts, { productId: PROD_A, date: "2026-06-01", pax: 20 }),
  large.id,
);

// 8. valid_from la plus récente
const ancien = rate({ product_id: PROD_A, valid_from: "2026-01-01", valid_to: "2026-12-31" });
const recent = rate({ product_id: PROD_A, valid_from: "2026-05-01", valid_to: "2026-12-31" });
expect("valid_from la plus récente", resolvePurchaseRate([ancien, recent], contracts, { productId: PROD_A, date: "2026-06-01" }), recent.id);

// 9. Conditions : une condition demandée non satisfaite exclut le tarif
const chambreDouble = rate({ product_id: PROD_A, conditions: { room_type: "double" } });
const chambreSuite = rate({ product_id: PROD_A, conditions: { room_type: "suite" } });
expect(
  "condition respectée",
  resolvePurchaseRate([chambreDouble, chambreSuite], contracts, {
    productId: PROD_A, date: "2026-06-01", conditions: { room_type: "suite" },
  }),
  chambreSuite.id,
);

// 10. DÉTERMINISME : mêmes entrées dans 24 ordres différents → même résultat
const pool = [generique, specifique, prio5, large, etroit, recent];
const input = { productId: PROD_A, date: "2026-06-01", pax: 5 };
const reference = resolvePurchaseRate(pool, contracts, input)?.id ?? null;
for (let i = 0; i < 24; i++) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const got = resolvePurchaseRate(shuffled, contracts, input)?.id ?? null;
  checked += 1;
  if (got !== reference) {
    failures.push(`déterminisme : permutation ${i} donne ${got} au lieu de ${reference}`);
  }
}

// 11. Pureté : la fonction ne modifie pas le tableau reçu
const before = pool.map((r) => r.id).join(",");
resolvePurchaseRate(pool, contracts, input);
checked += 1;
if (pool.map((r) => r.id).join(",") !== before) failures.push("pureté : le tableau d'entrée a été réordonné");

console.log(`${checked} cas vérifiés.`);
if (failures.length > 0) {
  console.error(`\n${failures.length} ÉCART(S) :`);
  failures.forEach((f) => console.error("  " + f));
  process.exit(1);
}
console.log("Résolution du tarif d'achat : déterministe, pure, ordre de préférence respecté.");
