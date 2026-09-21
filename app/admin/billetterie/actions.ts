"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  amountNumber,
  type DuffelMode,
  type DuffelOffer,
  type DuffelPlace,
  type OfferSearchResult,
} from "@/lib/duffel";
import { buildProductFromOffer, fxConvert, offerPax } from "@/lib/distribution";
import { storeDistributionCost } from "@/lib/cost-snapshot";
import { createReservation } from "@/app/admin/reservations/new/actions";

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

// ---------------------------------------------------------------------------
// Lot D1b — création du dossier depuis une offre
// ---------------------------------------------------------------------------

export type CreateDossierState =
  | { ok: true; reservationId: string; reference: string }
  | { ok: false; error: string }
  | { ok: null };

/**
 * Offre → produit `billetterie` inactif (per_unit, prix = MAD converti au taux
 * figé) → dossier via le chemin backoffice existant → voyageurs pré-créés →
 * `distribution_bookings` avec le snapshot. Compensation à chaque étape : on
 * ne laisse ni produit orphelin ni dossier sans snapshot.
 */
export async function createDossierFromOfferAction(_prev: CreateDossierState, fd: FormData): Promise<CreateDossierState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée — reconnectez-vous." };
  if (!duffelConfigured()) return { ok: false, error: "Distribution aérienne non configurée." };

  const offerId = ((fd.get("offer_id") as string) || "").trim();
  const customerId = ((fd.get("customer_id") as string) || "").trim();
  const fxRate = parseFloat(((fd.get("fx_rate") as string) || "").replace(",", "."));
  const fxSource = ((fd.get("fx_source") as string) || "saisi") === "parametres" ? "parametres" : "saisi";

  if (!/^off_[A-Za-z0-9]+$/.test(offerId)) return { ok: false, error: "Identifiant d'offre invalide." };
  if (!customerId) return { ok: false, error: "Sélectionnez ou créez le client payeur." };
  if (!Number.isFinite(fxRate) || fxRate <= 0) return { ok: false, error: "Saisissez le taux de change (MAD pour 1 unité de devise)." };

  // 1) Re-lecture : prix et expiration À JOUR. Jamais d'engagement sur la liste.
  let offer: DuffelOffer;
  try {
    offer = await getOffer(offerId);
  } catch (e) {
    return { ok: false, error: duffelErrorMessage(e) };
  }
  if (offerIsExpired(offer)) return { ok: false, error: "Cette offre a expiré — relancez la recherche." };
  if (offer.live_mode || duffelTokenMode() === "live") {
    return { ok: false, error: "Offre LIVE : ce démonstrateur ne crée pas de dossier sur de vrais vols. Utilisez un token de test." };
  }

  const { data: customer } = await supabase.from("customers").select("id, full_name").eq("id", customerId).maybeSingle();
  if (!customer) return { ok: false, error: "Client introuvable." };

  const amount = amountNumber(offer.total_amount);
  const amountMad = fxConvert(amount, fxRate);
  const pax = offerPax(offer);
  const product = buildProductFromOffer(offer, Math.random().toString(36).slice(2, 8));

  // 2) Produit billetterie — inactif, au forfait : le total du dossier est EXACTEMENT le total converti.
  const { data: created, error: prodErr } = await supabase
    .from("circuits")
    .insert({
      slug: product.slug,
      title: product.title,
      category: "billetterie",
      short_description: product.short_description,
      description: null,
      duration_days: 1,
      duration_hours: null,
      base_price_mad: amountMad,
      child_price_mad: null,
      max_participants: pax.adults + pax.children,
      meeting_point: product.category_fields.origin as string,
      is_active: false,
      sale_unit: "per_unit",
      pricing_mode: "fixed",
      category_fields: product.category_fields,
    })
    .select("id")
    .single();
  if (prodErr || !created) {
    console.error("[distribution] produit :", prodErr);
    return { ok: false, error: "Impossible de créer le produit billetterie." };
  }
  const productId = (created as any).id as string;

  // 3) Dossier — chemin backoffice existant (recalcul serveur per_unit, allotement → no_allotment).
  const resa = await createReservation({
    circuit_id: productId,
    customer_id: customerId,
    departure_date: product.departure_date,
    adults: pax.adults,
    children: pax.children,
    total_amount_mad: amountMad,
    status: "pending",
    notes: `Dossier billetterie · distribution aérienne (Duffel${offer.live_mode ? "" : " — test"}) · offre ${offer.id} · ${offer.total_amount} ${offer.total_currency} × ${fxRate} = ${amountMad} MAD (${fxSource === "parametres" ? "taux paramétré" : "taux saisi"}).`,
  });
  if (!resa.ok) {
    await supabase.from("circuits").delete().eq("id", productId); // compensation
    return { ok: false, error: `Création du dossier refusée : ${resa.error}` };
  }

  // 4) Voyageurs pré-créés — un par passager de l'offre, à compléter avant émission.
  let adultIdx = 0;
  let childIdx = 0;
  const travelers = offer.passengers.map((p) => {
    const isAdult = (p.type ?? "adult") === "adult";
    const n = isAdult ? ++adultIdx : ++childIdx;
    return {
      reservation_id: resa.id,
      full_name: isAdult ? `Adulte ${n}` : `Enfant ${n}`,
      traveler_type: isAdult ? "adult" : "child",
      notes: p.age !== null && p.age !== undefined ? `Âge déclaré à la recherche : ${p.age} ans — à remplacer par le nom exact du passeport et la date de naissance.` : "À remplacer par le nom exact du passeport et la date de naissance.",
    };
  });
  const { error: travErr } = await supabase.from("reservation_travelers").insert(travelers);
  if (travErr) console.error("[distribution] voyageurs :", travErr); // non bloquant : l'agent peut les saisir

  // 5) Snapshot figé.
  const { error: bookErr } = await supabase.from("distribution_bookings").insert({
    reservation_id: resa.id,
    product_id: productId,
    provider: "duffel",
    kind: "flight",
    live_mode: offer.live_mode,
    offer_request_id: ((fd.get("offer_request_id") as string) || "").trim() || null,
    offer_id: offer.id,
    offer_snapshot: offer,
    offer_expires_at: offer.expires_at,
    currency: offer.total_currency,
    amount,
    fx_rate: fxRate,
    fx_source: fxSource,
    amount_mad: amountMad,
    status: "draft",
    created_by: user.id,
  });
  if (bookErr) {
    console.error("[distribution] booking :", bookErr);
    // Compensation : sans snapshot, le dossier n'a pas de sens.
    const admin = createAdminClient();
    await admin.from("reservation_travelers").delete().eq("reservation_id", resa.id);
    await admin.from("reservations").delete().eq("id", resa.id);
    await supabase.from("circuits").delete().eq("id", productId);
    return { ok: false, error: "Impossible d'enregistrer le détail de l'offre — dossier annulé." };
  }

  // 6) Coût prévisionnel = montant figé de l'offre (source distribution).
  await storeDistributionCost(supabase, resa.id, {
    amount,
    currency: offer.total_currency,
    fxRate,
    amountMad,
    pax,
    supplierName: offer.owner.name,
    actorId: user.id,
  });

  revalidatePath("/admin/reservations");
  revalidatePath("/admin/produits");
  revalidatePath(`/admin/reservations/${resa.id}`);
  return { ok: true, reservationId: resa.id, reference: resa.reference };
}
