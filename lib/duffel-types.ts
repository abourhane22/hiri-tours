// Types et helpers d'affichage Duffel — ZÉRO dépendance au token ni au réseau.
// Importable côté client (composants "use client") comme côté serveur.
// Le client HTTP (token, fetch, garde anti-import client) vit dans lib/duffel.ts,
// qui ré-exporte ce module ; les composants client n'importent QUE ce fichier.

export type DuffelMode = "test" | "live" | "unknown";

// ---------------------------------------------------------------------------
// Types (sous-ensemble affiché)
// ---------------------------------------------------------------------------

export type DuffelPlace = {
  id: string;
  type: "airport" | "city";
  iata_code: string | null;
  name: string;
  city_name: string | null;
  iata_city_code: string | null;
  iata_country_code: string | null;
  time_zone: string | null;
};

export type DuffelAirline = {
  name: string;
  iata_code: string | null;
  logo_symbol_url?: string | null;
  logo_lockup_url?: string | null;
};

export type DuffelAirport = {
  iata_code: string | null;
  name: string;
  city_name?: string | null;
  iata_country_code?: string | null;
  time_zone?: string | null;
};

export type DuffelBaggage = { type: "checked" | "carry_on"; quantity: number };

export type DuffelSegmentPassenger = {
  passenger_id: string;
  cabin_class?: string | null;
  cabin_class_marketing_name?: string | null;
  baggages?: DuffelBaggage[];
};

export type DuffelSegment = {
  id: string;
  departing_at: string;
  arriving_at: string;
  duration: string | null; // ISO 8601, ex. PT7H25M
  origin: DuffelAirport;
  destination: DuffelAirport;
  marketing_carrier: DuffelAirline;
  operating_carrier?: DuffelAirline | null;
  marketing_carrier_flight_number?: string | null;
  aircraft?: { name: string; iata_code?: string | null } | null;
  passengers?: DuffelSegmentPassenger[];
};

export type DuffelSlice = {
  id: string;
  duration?: string | null;
  origin: DuffelAirport;
  destination: DuffelAirport;
  segments: DuffelSegment[];
};

export type DuffelCondition = {
  allowed: boolean;
  penalty_amount?: string | null;
  penalty_currency?: string | null;
} | null;

export type DuffelOffer = {
  id: string;
  live_mode: boolean;
  created_at: string;
  expires_at: string;
  total_amount: string;
  total_currency: string;
  base_amount?: string | null;
  tax_amount?: string | null;
  owner: DuffelAirline;
  slices: DuffelSlice[];
  passengers: { id: string; type?: string | null; age?: number | null }[];
  conditions?: {
    refund_before_departure?: DuffelCondition;
    change_before_departure?: DuffelCondition;
  } | null;
  passenger_identity_documents_required?: boolean;
  payment_requirements?: {
    requires_instant_payment?: boolean;
    price_guarantee_expires_at?: string | null;
    payment_required_by?: string | null;
  } | null;
  partial?: boolean;
};

export type CabinClass = "economy" | "premium_economy" | "business" | "first";
export const CABIN_CLASSES: { value: CabinClass; label: string }[] = [
  { value: "economy", label: "Économique" },
  { value: "premium_economy", label: "Premium économique" },
  { value: "business", label: "Affaires" },
  { value: "first", label: "Première" },
];
export function isCabinClass(v: unknown): v is CabinClass {
  return v === "economy" || v === "premium_economy" || v === "business" || v === "first";
}

export type OfferSearchInput = {
  origin: string; // IATA
  destination: string; // IATA
  departureDate: string; // YYYY-MM-DD
  returnDate?: string | null;
  adults: number;
  /** Âges des enfants (Duffel exige `age` pour les mineurs). */
  childAges: number[];
  cabinClass: CabinClass;
  maxConnections?: number;
};

export type OfferSearchResult = {
  offerRequestId: string;
  liveMode: boolean;
  offers: DuffelOffer[];
  searchedAt: string;
};

// ---------------------------------------------------------------------------
// Ordres (lot D1b) — types
// ---------------------------------------------------------------------------

export type DuffelIdentityDocument = {
  type: "passport";
  unique_identifier: string;
  expires_on: string; // YYYY-MM-DD
  issuing_country_code: string; // ISO 3166-1 alpha-2
};

/** Passager tel qu'attendu par POST /air/orders. `id` = celui du passager de l'offre. */
export type DuffelOrderPassengerInput = {
  id: string;
  given_name: string;
  family_name: string;
  born_on: string; // YYYY-MM-DD
  gender: "m" | "f";
  title: "mr" | "ms" | "mrs" | "miss";
  email: string;
  phone_number: string; // E.164
  identity_documents?: DuffelIdentityDocument[];
};

export type DuffelDocument = {
  type: string; // electronic_ticket…
  unique_identifier: string;
  passenger_ids?: string[];
};

export type DuffelOrder = {
  id: string;
  live_mode: boolean;
  created_at: string;
  booking_reference: string | null;
  total_amount: string;
  total_currency: string;
  owner: DuffelAirline;
  slices: DuffelSlice[];
  passengers: { id: string; given_name?: string; family_name?: string; type?: string | null }[];
  documents?: DuffelDocument[];
  payment_status?: {
    awaiting_payment?: boolean;
    payment_required_by?: string | null;
    price_guarantee_expires_at?: string | null;
  } | null;
  cancelled_at?: string | null;
  metadata?: Record<string, string> | null;
};

export type DuffelOrderCancellation = {
  id: string;
  order_id: string;
  live_mode: boolean;
  refund_amount: string | null;
  refund_currency: string | null;
  refund_to: string | null;
  expires_at: string | null;
  confirmed_at: string | null;
};

// ---------------------------------------------------------------------------
// Helpers d'affichage (purs)
// ---------------------------------------------------------------------------

/** "PT7H25M" → 445 (minutes). null si illisible. */
export function isoDurationToMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return null;
  const days = Number(m[1] ?? 0);
  const hours = Number(m[2] ?? 0);
  const mins = Number(m[3] ?? 0);
  return days * 1440 + hours * 60 + mins;
}

export function formatMinutes(min: number | null): string {
  if (min === null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Durée d'un slice : champ Duffel si présent, sinon arrivée − départ. */
export function sliceMinutes(slice: DuffelSlice): number | null {
  const fromField = isoDurationToMinutes(slice.duration);
  if (fromField !== null) return fromField;
  const first = slice.segments[0];
  const last = slice.segments[slice.segments.length - 1];
  if (!first || !last) return null;
  const ms = Date.parse(last.arriving_at) - Date.parse(first.departing_at);
  return Number.isFinite(ms) ? Math.round(ms / 60000) : null;
}

/** Durée totale de l'offre (somme des slices), pour le tri. */
export function offerTotalMinutes(offer: DuffelOffer): number {
  return offer.slices.reduce((s, sl) => s + (sliceMinutes(sl) ?? 0), 0);
}

export function offerIsExpired(offer: DuffelOffer, now: number = Date.now()): boolean {
  const t = Date.parse(offer.expires_at);
  return Number.isFinite(t) && t <= now;
}

/** Résumé bagages d'un segment pour le premier passager : « 1 soute · 1 cabine ». */
export function baggageSummary(segment: DuffelSegment): string | null {
  const p = segment.passengers?.[0];
  if (!p?.baggages || p.baggages.length === 0) return null;
  const checked = p.baggages.filter((b) => b.type === "checked").reduce((s, b) => s + b.quantity, 0);
  const carry = p.baggages.filter((b) => b.type === "carry_on").reduce((s, b) => s + b.quantity, 0);
  const parts: string[] = [];
  if (checked > 0) parts.push(`${checked} soute`);
  if (carry > 0) parts.push(`${carry} cabine`);
  return parts.length > 0 ? parts.join(" · ") : "sans bagage";
}

/** Montant Duffel (chaîne décimale) → nombre. */
export function amountNumber(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(amount: string | number, currency: string): string {
  const n = typeof amount === "string" ? amountNumber(amount) : amount;
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}
