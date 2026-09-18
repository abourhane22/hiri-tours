"use server";

import { createClient } from "@/lib/supabase/server";
import {
  duffelConfigured,
  duffelErrorMessage,
  duffelTokenMode,
  getOffer,
  isCabinClass,
  searchOffers,
  suggestPlaces,
  DuffelApiError,
  offerIsExpired,
  type DuffelMode,
  type DuffelOffer,
  type DuffelPlace,
  type OfferSearchResult,
} from "@/lib/duffel";

// Toutes les actions passent par le serveur : le token ne quitte jamais
// lib/duffel.ts. Lot D1a : lecture seule, aucune écriture en base.

async function requireStaff(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée — reconnectez-vous." };
  return { ok: true };
}

export type PlacesResult = { ok: true; places: DuffelPlace[] } | { ok: false; error: string };

/** Autocomplétion : déclenchée par la frappe (≥ 2 caractères), jamais au chargement. */
export async function suggestPlacesAction(query: string): Promise<PlacesResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  if (!duffelConfigured()) return { ok: false, error: "Distribution aérienne non configurée." };
  try {
    const places = await suggestPlaces(query);
    return { ok: true, places };
  } catch (e) {
    console.error("[duffel] places :", e instanceof DuffelApiError ? `${e.status} ${e.requestId ?? ""}` : e);
    return { ok: false, error: duffelErrorMessage(e) };
  }
}

export type SearchState =
  | { ok: true; result: OfferSearchResult; mode: DuffelMode; input: SearchEcho }
  | { ok: false; error: string }
  | { ok: null }; // état initial : aucune recherche lancée

export type SearchEcho = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  adults: number;
  childAges: number[];
  cabinClass: string;
};

const IATA = /^[A-Z]{3}$/;

/** Recherche d'offres — uniquement à l'action explicite de l'utilisateur. */
export async function searchOffersAction(_prev: SearchState, fd: FormData): Promise<SearchState> {
  const auth = await requireStaff();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!duffelConfigured()) return { ok: false, error: "Distribution aérienne non configurée." };

  const origin = ((fd.get("origin") as string) || "").trim().toUpperCase();
  const destination = ((fd.get("destination") as string) || "").trim().toUpperCase();
  const departureDate = ((fd.get("departure_date") as string) || "").trim();
  const returnDateRaw = ((fd.get("return_date") as string) || "").trim();
  const adults = parseInt((fd.get("adults") as string) || "1", 10);
  const cabin = ((fd.get("cabin_class") as string) || "economy").trim();

  if (!IATA.test(origin)) return { ok: false, error: "Choisissez un aéroport de départ dans la liste." };
  if (!IATA.test(destination)) return { ok: false, error: "Choisissez un aéroport d'arrivée dans la liste." };
  if (origin === destination) return { ok: false, error: "Le départ et l'arrivée doivent être différents." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) return { ok: false, error: "Date de départ invalide." };
  if (returnDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(returnDateRaw)) return { ok: false, error: "Date de retour invalide." };
  if (returnDateRaw && returnDateRaw < departureDate) return { ok: false, error: "Le retour doit être postérieur au départ." };
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) return { ok: false, error: "Entre 1 et 9 adultes." };
  if (!isCabinClass(cabin)) return { ok: false, error: "Classe de cabine invalide." };

  // Âges des enfants : champs child_age_0 … child_age_n (Duffel exige l'âge des mineurs).
  const childAges: number[] = [];
  for (let i = 0; i < 9; i++) {
    const raw = fd.get(`child_age_${i}`);
    if (raw === null) continue;
    const age = parseInt(String(raw), 10);
    if (!Number.isInteger(age) || age < 0 || age > 17) {
      return { ok: false, error: `Âge de l'enfant ${i + 1} invalide (0 à 17 ans).` };
    }
    childAges.push(age);
  }
  if (adults + childAges.length > 9) return { ok: false, error: "9 passagers maximum par recherche." };

  try {
    const result = await searchOffers({
      origin,
      destination,
      departureDate,
      returnDate: returnDateRaw || null,
      adults,
      childAges,
      cabinClass: cabin,
    });
    return {
      ok: true,
      result,
      mode: duffelTokenMode(),
      input: { origin, destination, departureDate, returnDate: returnDateRaw || null, adults, childAges, cabinClass: cabin },
    };
  } catch (e) {
    console.error("[duffel] recherche :", e instanceof DuffelApiError ? `${e.status} ${e.requestId ?? ""} ${e.errors.map((x) => x.code).join(",")}` : e);
    return { ok: false, error: duffelErrorMessage(e) };
  }
}

export type OfferDetailResult =
  | { ok: true; offer: DuffelOffer; expired: boolean; priceChanged: boolean }
  | { ok: false; error: string; expired: boolean };

/**
 * Re-lecture d'une offre avant tout engagement : prix et expiration à jour.
 * `previousTotal` permet de signaler un changement de prix depuis la liste.
 */
export async function getOfferAction(offerId: string, previousTotal?: string): Promise<OfferDetailResult> {
  const auth = await requireStaff();
  if (!auth.ok) return { ok: false, error: auth.error, expired: false };
  if (!duffelConfigured()) return { ok: false, error: "Distribution aérienne non configurée.", expired: false };
  if (!/^off_[A-Za-z0-9]+$/.test(offerId)) return { ok: false, error: "Identifiant d'offre invalide.", expired: false };

  try {
    const offer = await getOffer(offerId);
    const expired = offerIsExpired(offer);
    const priceChanged = previousTotal !== undefined && previousTotal !== offer.total_amount;
    return { ok: true, offer, expired, priceChanged };
  } catch (e) {
    const isGone = e instanceof DuffelApiError && (e.status === 404 || e.has("offer_no_longer_available"));
    console.error("[duffel] offre :", e instanceof DuffelApiError ? `${e.status} ${e.requestId ?? ""}` : e);
    return { ok: false, error: duffelErrorMessage(e), expired: isGone };
  }
}
