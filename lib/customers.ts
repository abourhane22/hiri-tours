// Normalisation partagée pour la déduplication des clients.
// Ces clés servent de comparaison brute (index uniques DB), à distinguer de
// `normalizePhoneForWa` (payment-link-panel) qui vise l'envoi WhatsApp.

/**
 * Clé de comparaison d'un téléphone : chiffres uniquement, avec les numéros
 * marocains ramenés au préfixe international 212.
 *  - "0661 23 45 67"   → "212661234567"
 *  - "+212 661-234567" → "212661234567"
 *  - "00212661234567"  → "212661234567"
 * Retourne null si aucune donnée exploitable.
 * IMPORTANT : cette règle doit rester alignée avec le SQL de backfill de
 * `customers.phone_normalized` (voir migration 20260806).
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) {
    // Préfixe d'appel international (00…) → on le retire.
    d = d.slice(2);
  } else if (/^0[567]/.test(d)) {
    // Numéro marocain (mobile 06/07, fixe 05) → préfixe pays 212.
    d = "212" + d.slice(1);
  }
  return d || null;
}

/** Clé de comparaison d'un email : trim + minuscules. Null si vide. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e || null;
}

/**
 * Masque un téléphone normalisé pour un affichage prudent (RGPD) dans les
 * suggestions de doublon : "+212 6•• ••• ••67".
 */
export function maskPhone(normalized: string | null | undefined): string | null {
  if (!normalized) return null;
  const d = normalized;
  if (d.startsWith("212") && d.length >= 6) {
    const rest = d.slice(3); // ex. 661234567
    const first = rest.slice(0, 1);
    const last2 = rest.slice(-2);
    return `+212 ${first}•• ••• ••${last2}`;
  }
  const last2 = d.slice(-2);
  return `•• ••• ••${last2}`;
}
