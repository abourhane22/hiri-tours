import crypto from "crypto";

/**
 * Couche SIMULATEUR Attijari Payment.
 *
 * Tout ce qui est propre à l'environnement de démonstration vit ici.
 * Pour brancher le vrai Attijari/CMI plus tard, on remplace uniquement
 * ce module (génération d'ordre + signature + règles de décision), sans
 * toucher aux server actions, aux pages, ni au schéma SQL.
 */

/** Cartes de test affichées sur la page de paiement. */
export const ATTIJARI_TEST_CARDS = {
  /** Se termine par 0001 → paiement accepté. */
  approved: "4000 0000 0000 0001",
  /** Se termine par 0002 → paiement refusé (fonds insuffisants). */
  declined: "4000 0000 0000 0002",
} as const;

/** Code 3D Secure de test. */
export const ATTIJARI_TEST_OTP = "123456";

/** Numéro masqué affiché à l'étape 3D Secure. */
export const ATTIJARI_MASKED_PHONE = "+212 6XX XXX X47";

function getSecret(): string {
  // Valeur de dev par défaut si ATTIJARI_TEST_SECRET n'est pas défini.
  return process.env.ATTIJARI_TEST_SECRET || "attijari-test-secret-dev-only";
}

/** Génère un identifiant d'ordre unique : ATJ-{timestamp}-{4 chars}. */
export function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(4).toString("hex").slice(0, 4).toUpperCase();
  return `ATJ-${ts}-${rand}`;
}

/**
 * Signature HMAC-SHA256 du couple (orderId, montant).
 * C'est le mécanisme d'intégrité utilisé par les gateways marocaines :
 * la gateway rejette tout ordre dont la signature ne correspond pas.
 */
export function signOrder(orderId: string, amountMad: number): string {
  const payload = `${orderId}:${amountMad.toFixed(2)}`;
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/** Vérifie qu'une signature correspond bien à l'ordre (comparaison constante). */
export function verifyOrderSignature(
  orderId: string,
  amountMad: number,
  signature: string,
): boolean {
  const expected = signOrder(orderId, amountMad);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature ?? "", "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Retire tout ce qui n'est pas un chiffre (espaces de formatage, etc.). */
export function normalizeCardNumber(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/**
 * Décision de la "banque" simulée.
 * Réel plus tard : cette fonction disparaît, le verdict vient du callback CMI.
 */
export function evaluateSimulatedPayment(
  cardNumberRaw: string,
  otpCode: string,
): { approved: boolean; reason?: "card_declined" | "otp_invalid" } {
  const card = normalizeCardNumber(cardNumberRaw);
  if (!card.endsWith("0001")) return { approved: false, reason: "card_declined" };
  if ((otpCode ?? "").trim() !== ATTIJARI_TEST_OTP) {
    return { approved: false, reason: "otp_invalid" };
  }
  return { approved: true };
}
