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

/** Libellés français des valeurs de l'enum Postgres `customer_source`. */
export const SOURCE_LABELS: Record<string, string> = {
  walk_in: "Walk-in",
  phone: "Téléphone",
  whatsapp: "WhatsApp",
  email: "Email",
  website: "Site web",
  referral: "Bouche-à-oreille",
  social_media: "Réseaux sociaux",
  partner: "Agence partenaire",
  hotel: "Hôtel",
  event: "Salon / événement",
  other: "Autre",
};

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

/**
 * Traduit une violation d'index unique de `customers` (Postgres 23505) en message
 * métier. Noms réels des index (constat du 30/09/2026) :
 *   - customers_phone_normalized_unique (partiel, sur phone_normalized)
 *   - customers_email_unique (sur lower(email))
 * Repli sur le détail de l'erreur (« Key (phone_normalized)=… »).
 */
export function customerDuplicateMessage(error: { code?: string; message?: string; details?: string | null } | null | undefined): string | null {
  if (!error || error.code !== "23505") return null;
  const msg = (error.message ?? "").toLowerCase();
  const details = (error.details ?? "").toLowerCase();
  if (msg.includes("customers_phone_normalized_unique") || details.includes("phone_normalized")) {
    return "Un client existe déjà avec ce numéro de téléphone.";
  }
  if (msg.includes("customers_email_unique") || details.includes("email")) {
    return "Un client existe déjà avec cet email.";
  }
  return "Un client identique existe déjà.";
}
