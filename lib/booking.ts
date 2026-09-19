// Vocabulaire du dossier de réservation backoffice (lot « Nouveau dossier ») :
// origine, remise, langue, acompte, canal prévu, quantités selon l'unité de
// vente. Client-safe — aucune dépendance serveur.

import type { LineQuantity } from "@/lib/pricing";
import type { SaleUnit } from "@/lib/types";

// ---------------------------------------------------------------------------
// Origine du dossier
// ---------------------------------------------------------------------------

export type BookingChannel = "telephone" | "comptoir" | "whatsapp" | "email" | "partenaire" | "site_web";

export const BOOKING_CHANNELS: { value: BookingChannel; label: string }[] = [
  { value: "telephone", label: "Téléphone" },
  { value: "comptoir", label: "Comptoir" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "partenaire", label: "Partenaire" },
  { value: "site_web", label: "Site web" },
];
export const BOOKING_CHANNEL_LABEL: Record<string, string> = Object.fromEntries(BOOKING_CHANNELS.map((c) => [c.value, c.label]));
export function isBookingChannel(v: unknown): v is BookingChannel {
  return typeof v === "string" && v in BOOKING_CHANNEL_LABEL;
}

// ---------------------------------------------------------------------------
// Remise commerciale
// ---------------------------------------------------------------------------

export type DiscountReason = "client_fidele" | "groupe" | "geste_commercial" | "partenaire" | "autre";

export const DISCOUNT_REASONS: { value: DiscountReason; label: string }[] = [
  { value: "client_fidele", label: "Client fidèle" },
  { value: "groupe", label: "Groupe" },
  { value: "geste_commercial", label: "Geste commercial" },
  { value: "partenaire", label: "Partenaire" },
  { value: "autre", label: "Autre" },
];
export const DISCOUNT_REASON_LABEL: Record<string, string> = Object.fromEntries(DISCOUNT_REASONS.map((r) => [r.value, r.label]));
export function isDiscountReason(v: unknown): v is DiscountReason {
  return typeof v === "string" && v in DISCOUNT_REASON_LABEL;
}

export type DiscountMode = "mad" | "pct";

/** Remise en MAD, arrondie au centime, bornée à [0, brut]. */
export function discountAmount(mode: DiscountMode, value: number, gross: number): number {
  if (!Number.isFinite(value) || value <= 0 || gross <= 0) return 0;
  const raw = mode === "pct" ? (gross * Math.min(value, 100)) / 100 : value;
  return Math.min(gross, Math.round(raw * 100) / 100);
}

// ---------------------------------------------------------------------------
// Langue du groupe
// ---------------------------------------------------------------------------

export const GROUP_LANGUAGES: { value: string; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "es", label: "Espagnol" },
  { value: "de", label: "Allemand" },
  { value: "ar", label: "Arabe" },
  { value: "it", label: "Italien" },
];
export const GROUP_LANGUAGE_LABEL: Record<string, string> = Object.fromEntries(GROUP_LANGUAGES.map((l) => [l.value, l.label]));

// ---------------------------------------------------------------------------
// Paiement à la création
// ---------------------------------------------------------------------------

/** Canal de règlement prévu (même vocabulaire que le tunnel public). */
export type IntendedChannel = "carte" | "virement" | "agence";
export const INTENDED_CHANNELS: { value: IntendedChannel; label: string; hint: string }[] = [
  { value: "carte", label: "Lien de paiement carte", hint: "Le client règle en ligne via un lien sécurisé (24 h)." },
  { value: "virement", label: "Virement", hint: "RIB communiqué au client ; encaissement saisi à réception." },
  { value: "agence", label: "Règlement à l'agence", hint: "Espèces ou carte au comptoir, au plus tard 7 jours avant le départ (J-7)." },
];
export function isIntendedChannel(v: unknown): v is IntendedChannel {
  return v === "carte" || v === "virement" || v === "agence";
}

/** Modes d'encaissement immédiat au comptoir (valeurs de l'enum payment_method). */
export type DepositMethod = "cash" | "card_tpe" | "transfer";
export const DEPOSIT_METHODS: { value: DepositMethod; label: string; needsRef: boolean }[] = [
  { value: "cash", label: "Espèces", needsRef: false },
  { value: "card_tpe", label: "Carte (TPE agence)", needsRef: false },
  { value: "transfer", label: "Virement reçu", needsRef: true },
];
export function isDepositMethod(v: unknown): v is DepositMethod {
  return v === "cash" || v === "card_tpe" || v === "transfer";
}

// ---------------------------------------------------------------------------
// Quantités selon l'unité de vente
// ---------------------------------------------------------------------------

/** Quantités saisies sur un dossier — colonnes reservations (adults/children + trips/nights/rooms/units). */
export type BookingQuantity = {
  adults: number;
  children: number;
  trips: number;
  nights: number;
  rooms: number;
  units: number;
};

export const DEFAULT_QUANTITY: BookingQuantity = { adults: 1, children: 0, trips: 1, nights: 1, rooms: 1, units: 1 };

const int = (n: unknown, min: number, fallback: number) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= min ? v : fallback;
};

/**
 * Normalise les quantités pour une unité de vente : les champs qui ne la
 * concernent pas retombent à leur défaut, pour que le total serveur soit
 * reproductible depuis les colonnes stockées.
 */
export function normalizeQuantity(saleUnit: SaleUnit, q: Partial<BookingQuantity>): BookingQuantity {
  const adults = int(q.adults, 0, 0);
  const children = int(q.children, 0, 0);
  switch (saleUnit) {
    case "per_trip":
      return { adults: Math.max(1, adults), children, trips: int(q.trips, 1, 1), nights: 1, rooms: 1, units: 1 };
    case "per_night_room":
      return { adults: Math.max(1, adults), children, trips: 1, nights: int(q.nights, 1, 1), rooms: int(q.rooms, 1, 1), units: 1 };
    case "per_unit":
      return { adults: Math.max(1, adults), children, trips: 1, nights: 1, rooms: 1, units: int(q.units, 1, 1) };
    case "per_person":
    default:
      return { adults: Math.max(1, adults), children, trips: 1, nights: 1, rooms: 1, units: 1 };
  }
}

/** Vue « ligne de prix » attendue par computeLineTotal. */
export function toLineQuantity(q: BookingQuantity): LineQuantity {
  return { adults: q.adults, children: q.children, trips: q.trips, nights: q.nights, rooms: q.rooms, units: q.units };
}

/** Passagers du dossier (capacité, allotement, manifeste) : adultes + enfants, quelle que soit l'unité. */
export function paxOf(q: BookingQuantity): number {
  return q.adults + q.children;
}

/** Libellé des quantités pour le récapitulatif et la facture. */
export function quantityLabel(saleUnit: SaleUnit, q: BookingQuantity): string {
  const pax = `${q.adults} adulte${q.adults > 1 ? "s" : ""}${q.children > 0 ? `, ${q.children} enfant${q.children > 1 ? "s" : ""}` : ""}`;
  switch (saleUnit) {
    case "per_trip":
      return `${q.trips} trajet${q.trips > 1 ? "s" : ""} · ${pax}`;
    case "per_night_room":
      return `${q.nights} nuit${q.nights > 1 ? "s" : ""} × ${q.rooms} chambre${q.rooms > 1 ? "s" : ""} · ${pax}`;
    case "per_unit":
      return `${q.units} unité${q.units > 1 ? "s" : ""} · ${pax}`;
    default:
      return pax;
  }
}

/** Statut déduit à la création : encaissement (acompte ou avoir) → confirmé, solde couvert → payé, sinon en attente. */
export function deducedStatus(total: number, collected: number): "pending" | "confirmed" | "paid" {
  if (total > 0 && collected >= total - 0.005) return "paid";
  if (collected > 0) return "confirmed";
  return "pending";
}
