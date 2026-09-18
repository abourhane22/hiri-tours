// Client Duffel — SERVEUR UNIQUEMENT. Lot D1a : recherche en lecture seule.
//
// Six endpoints REST (v2) suffisent au démonstrateur ; pas de SDK, donc pas
// de dépendance à suivre et un contrôle total des headers. Les types sont
// réduits aux champs que l'interface affiche : le JSON complet d'une offre
// sera figé tel quel en snapshot au lot D1b.
//
// RÈGLES
//  - Le token ne sort JAMAIS de ce module (jamais loggé, jamais renvoyé).
//  - Aucune erreur Duffel brute n'atteint l'écran : `duffelErrorMessage`.
//  - Le mode (test / live) est déduit du préfixe du token ET confirmé par le
//    champ `live_mode` des réponses ; le second fait foi.

if (typeof window !== "undefined") {
  throw new Error("lib/duffel.ts ne doit jamais être importé côté client.");
}

const BASE_URL = "https://api.duffel.com";
const API_VERSION = "v2";
const SUPPLIER_TIMEOUT_MS = 20_000;

export type DuffelMode = "test" | "live" | "unknown";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function token(): string | null {
  const t = (process.env.DUFFEL_ACCESS_TOKEN ?? "").trim();
  return t.length > 0 ? t : null;
}

/** Variable présente et non vide. Aucun appel réseau. */
export function duffelConfigured(): boolean {
  return token() !== null;
}

/** Mode déduit du préfixe du token — indicatif ; `live_mode` des réponses fait foi. */
export function duffelTokenMode(): DuffelMode {
  const t = token();
  if (!t) return "unknown";
  if (t.startsWith("duffel_test_")) return "test";
  if (t.startsWith("duffel_live_")) return "live";
  return "unknown";
}

export const DUFFEL_ENV_VAR = "DUFFEL_ACCESS_TOKEN";

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

export type DuffelErrorItem = {
  type?: string;
  title?: string;
  message?: string;
  code?: string;
  documentation_url?: string;
};

export class DuffelApiError extends Error {
  readonly status: number;
  readonly errors: DuffelErrorItem[];
  readonly requestId: string | null;
  constructor(status: number, errors: DuffelErrorItem[], requestId: string | null) {
    super(errors[0]?.message ?? `Duffel HTTP ${status}`);
    this.name = "DuffelApiError";
    this.status = status;
    this.errors = errors;
    this.requestId = requestId;
  }
  has(code: string): boolean {
    return this.errors.some((e) => e.code === code || e.type === code);
  }
}

/** Traduit une erreur (Duffel ou réseau) en message métier, sans fuite technique. */
export function duffelErrorMessage(e: unknown): string {
  if (e instanceof DuffelApiError) {
    if (e.status === 401 || e.has("unauthorized") || e.has("access_token_not_found")) {
      return "Identifiant Duffel invalide ou révoqué. Vérifiez DUFFEL_ACCESS_TOKEN.";
    }
    if (e.has("offer_no_longer_available") || e.has("offer_request_not_found") || e.status === 404) {
      return "Cette offre a expiré ou son prix a changé — relancez la recherche.";
    }
    if (e.has("insufficient_balance")) {
      return "Solde de test insuffisant pour ce scénario (route LGW → STN simule cette erreur).";
    }
    if (e.has("rate_limit_exceeded") || e.status === 429) {
      return "Trop de requêtes vers Duffel — patientez quelques secondes.";
    }
    if (e.has("validation_error") || e.status === 422) {
      const detail = e.errors.map((x) => x.message).filter(Boolean).join(" · ");
      return detail ? `Requête refusée par Duffel : ${detail}` : "Requête refusée par Duffel : paramètres invalides.";
    }
    if (e.has("supplier_timeout") || e.status === 504) {
      return "Le fournisseur n'a pas répondu à temps — réessayez.";
    }
    return e.errors[0]?.message ? `Duffel : ${e.errors[0].message}` : `Duffel a répondu ${e.status}.`;
  }
  if (e instanceof Error && e.name === "AbortError") return "Recherche interrompue : délai dépassé.";
  return "Impossible de joindre Duffel. Réessayez dans un instant.";
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

async function duffelFetch<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T> {
  const t = token();
  if (!t) throw new Error("Duffel non configuré.");

  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPPLIER_TIMEOUT_MS + 5_000);
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${t}`,
        "Duffel-Version": API_VERSION,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify({ data: init.body }) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const requestId = res.headers.get("x-request-id");
    const json = (await res.json().catch(() => ({}))) as { data?: T; errors?: DuffelErrorItem[] };

    if (!res.ok) {
      throw new DuffelApiError(res.status, json.errors ?? [], requestId);
    }
    return json.data as T;
  } finally {
    clearTimeout(timer);
  }
}

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
// Endpoints
// ---------------------------------------------------------------------------

/** Autocomplétion aéroports / villes. */
export async function suggestPlaces(query: string): Promise<DuffelPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const data = await duffelFetch<DuffelPlace[]>("/places/suggestions", { query: { query: q } });
  return (data ?? []).filter((p) => p.iata_code);
}

/** Crée une Offer Request et renvoie ses offres (une seule requête, offres incluses). */
export async function searchOffers(input: OfferSearchInput): Promise<OfferSearchResult> {
  const slices: { origin: string; destination: string; departure_date: string }[] = [
    { origin: input.origin, destination: input.destination, departure_date: input.departureDate },
  ];
  if (input.returnDate) {
    slices.push({ origin: input.destination, destination: input.origin, departure_date: input.returnDate });
  }

  // Duffel : `type` OU `age`, jamais les deux sur un même passager.
  const passengers: ({ type: "adult" } | { age: number })[] = [
    ...Array.from({ length: input.adults }, () => ({ type: "adult" as const })),
    ...input.childAges.map((age) => ({ age })),
  ];

  const data = await duffelFetch<{ id: string; live_mode: boolean; offers?: DuffelOffer[] }>(
    "/air/offer_requests",
    {
      method: "POST",
      query: { return_offers: true, supplier_timeout: SUPPLIER_TIMEOUT_MS },
      body: {
        slices,
        passengers,
        cabin_class: input.cabinClass,
        max_connections: input.maxConnections ?? 1,
      },
    },
  );

  // Les offres `partial` ne sont pas réservables directement : écartées.
  const offers = (data.offers ?? []).filter((o) => !o.partial);
  return { offerRequestId: data.id, liveMode: data.live_mode, offers, searchedAt: new Date().toISOString() };
}

/** Re-lecture d'une offre : prix et expiration À JOUR — obligatoire avant tout engagement. */
export async function getOffer(offerId: string): Promise<DuffelOffer> {
  return duffelFetch<DuffelOffer>(`/air/offers/${encodeURIComponent(offerId)}`);
}

// ---------------------------------------------------------------------------
// Ordres (lot D1b) — émission et annulation
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

/**
 * Crée l'ordre : paiement `balance` (solde de test illimité en mode test),
 * type `instant`. L'appelant a DÉJÀ relu l'offre et vérifié live_mode.
 */
export async function createOrder(input: {
  offerId: string;
  passengers: DuffelOrderPassengerInput[];
  currency: string;
  amount: string;
  metadata?: Record<string, string>;
}): Promise<DuffelOrder> {
  return duffelFetch<DuffelOrder>("/air/orders", {
    method: "POST",
    body: {
      type: "instant",
      selected_offers: [input.offerId],
      passengers: input.passengers,
      payments: [{ type: "balance", currency: input.currency, amount: input.amount }],
      metadata: input.metadata,
    },
  });
}

export async function getOrder(orderId: string): Promise<DuffelOrder> {
  return duffelFetch<DuffelOrder>(`/air/orders/${encodeURIComponent(orderId)}`);
}

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

/** Devis d'annulation : rien n'est annulé tant que `confirmOrderCancellation` n'est pas appelée. */
export async function createOrderCancellation(orderId: string): Promise<DuffelOrderCancellation> {
  return duffelFetch<DuffelOrderCancellation>("/air/order_cancellations", {
    method: "POST",
    body: { order_id: orderId },
  });
}

export async function confirmOrderCancellation(cancellationId: string): Promise<DuffelOrderCancellation> {
  return duffelFetch<DuffelOrderCancellation>(
    `/air/order_cancellations/${encodeURIComponent(cancellationId)}/actions/confirm`,
    { method: "POST" },
  );
}

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
