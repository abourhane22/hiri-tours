// Client Duffel — SERVEUR UNIQUEMENT : token, fetch, garde anti-import client.
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

// Types et helpers purs : lib/duffel-types.ts (importable côté client). Ré-exportés
// ici pour que le code serveur garde un seul point d'entrée.
export * from "@/lib/duffel-types";
import type { DuffelMode, DuffelPlace, DuffelOffer, OfferSearchInput, OfferSearchResult, DuffelOrder, DuffelOrderPassengerInput, DuffelOrderCancellation } from "@/lib/duffel-types";

const BASE_URL = "https://api.duffel.com";
const API_VERSION = "v2";
const SUPPLIER_TIMEOUT_MS = 20_000;

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
