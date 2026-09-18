// Distribution aérienne (lot D1b) : passerelle entre une offre Duffel et le
// modèle métier — produit `billetterie`, dossier, voyageurs, passagers d'ordre.
// Fonctions pures, testables ; les écritures restent dans les server actions.

import type { DuffelOffer, DuffelOrderPassengerInput, DuffelIdentityDocument } from "@/lib/duffel";
import type { DistributionStatus, FxSource, ReservationTraveler } from "@/lib/types";
import { countryCode } from "@/lib/countries";
import { normalizePhone } from "@/lib/customers";

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

export const DISTRIBUTION_STATUS_LABEL: Record<DistributionStatus, string> = {
  draft: "Dossier créé — ordre non émis",
  ordered: "Ordre émis",
  cancelled: "Ordre annulé",
  failed: "Émission impossible",
};

export const DISTRIBUTION_STATUS_STYLE: Record<DistributionStatus, { bg: string; color: string }> = {
  draft: { bg: "#FAEEDA", color: "#633806" },
  ordered: { bg: "#E1F5EE", color: "#085041" },
  cancelled: { bg: "#F1EFE8", color: "#5F5E5A" },
  failed: { bg: "#FCEBEB", color: "#791F1F" },
};

export const FX_SOURCE_LABEL: Record<FxSource, string> = {
  parametres: "taux paramétré",
  saisi: "taux saisi à la création",
};

// ---------------------------------------------------------------------------
// Offre → produit
// ---------------------------------------------------------------------------

/** Adultes / enfants de l'offre, d'après le type inféré par Duffel. */
export function offerPax(offer: DuffelOffer): { adults: number; children: number } {
  let adults = 0;
  let children = 0;
  for (const p of offer.passengers) {
    if ((p.type ?? "adult") === "adult") adults += 1;
    else children += 1;
  }
  return { adults: Math.max(1, adults), children };
}

/** Conversion figée : MAD = montant × taux, au centime. */
export function fxConvert(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

const ymd = (iso: string) => iso.slice(0, 10);

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ProductFromOffer = {
  title: string;
  slug: string;
  short_description: string;
  departure_date: string;
  category_fields: Record<string, unknown>;
};

/**
 * Produit `billetterie` décrivant exactement l'offre : titre lisible, slug
 * unique, champs typés de C1 + marqueur `source: 'duffel'` pour le filtre du
 * catalogue. Inactif (jamais en vitrine), au forfait (per_unit).
 */
export function buildProductFromOffer(offer: DuffelOffer, uniqueSuffix: string): ProductFromOffer {
  const first = offer.slices[0];
  const firstSeg = first?.segments[0];
  const lastSeg = first?.segments[first.segments.length - 1];
  const origin = firstSeg?.origin.iata_code ?? first?.origin.iata_code ?? "???";
  const destination = lastSeg?.destination.iata_code ?? first?.destination.iata_code ?? "???";
  const departureDate = firstSeg ? ymd(firstSeg.departing_at) : ymd(offer.created_at);
  const roundTrip = offer.slices.length > 1;
  const cabin = firstSeg?.passengers?.[0]?.cabin_class ?? null;
  const dateFr = new Date(departureDate + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

  const title = `Vol ${origin} → ${destination}${roundTrip ? " ↔" : ""} · ${dateFr} · ${offer.owner.name}`;
  const slug = `${slugify(`vol-${origin}-${destination}-${departureDate}`)}-${uniqueSuffix}`;
  const stops = (first?.segments.length ?? 1) - 1;

  return {
    title,
    slug,
    short_description: `${roundTrip ? "Aller-retour" : "Aller simple"} ${origin} → ${destination} · ${offer.owner.name}${
      stops > 0 ? ` · ${stops} escale${stops > 1 ? "s" : ""}` : " · direct"
    } · réservé via distribution aérienne (Duffel${offer.live_mode ? "" : ", test"}).`,
    departure_date: departureDate,
    category_fields: {
      ticket_kind: "vol",
      carrier_or_organizer: offer.owner.name,
      origin,
      destination,
      travel_class: mapCabin(cabin),
      is_round_trip: roundTrip,
      fixed_date: departureDate,
      refundable: offer.conditions?.refund_before_departure?.allowed ?? false,
      baggage_included: (firstSeg?.passengers?.[0]?.baggages ?? []).some((b) => b.type === "checked" && b.quantity > 0),
      source: "duffel",
    },
  };
}

function mapCabin(cabin: string | null): string {
  switch (cabin) {
    case "premium_economy":
      return "premium";
    case "business":
      return "affaires";
    case "first":
      return "premiere";
    case "economy":
      return "economique";
    default:
      return "standard";
  }
}

// ---------------------------------------------------------------------------
// Voyageurs → passagers Duffel
// ---------------------------------------------------------------------------

/** « Amina El Idrissi » → prénom « Amina », nom « El Idrissi ». Un seul mot ⇒ nom manquant. */
export function splitName(fullName: string): { given: string; family: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { given: parts[0] ?? "", family: "" };
  return { given: parts[0], family: parts.slice(1).join(" ") };
}

/** Numéro au format E.164 attendu par Duffel, depuis la normalisation maison (212…). */
export function toE164(phone: string | null | undefined): string | null {
  const digits = normalizePhone(phone);
  return digits ? `+${digits}` : null;
}

export type PassengerBuildResult =
  | { ok: true; passengers: DuffelOrderPassengerInput[] }
  | { ok: false; missing: string[] };

/**
 * Associe les voyageurs du dossier aux passagers de l'offre (adultes ↔ adultes,
 * enfants ↔ mineurs, dans l'ordre) et construit les passagers d'ordre.
 * Renvoie la liste EXACTE de ce qui manque — l'agent est renvoyé à la carte
 * Voyageurs avec cette liste, rien n'est envoyé à Duffel tant qu'elle n'est
 * pas vide.
 */
export function buildOrderPassengers(
  offer: DuffelOffer,
  travelers: ReservationTraveler[],
  contact: { email: string | null; phone: string | null },
): PassengerBuildResult {
  const missing: string[] = [];

  const offerAdults = offer.passengers.filter((p) => (p.type ?? "adult") === "adult");
  const offerMinors = offer.passengers.filter((p) => (p.type ?? "adult") !== "adult");
  const travAdults = travelers.filter((t) => t.traveler_type === "adult");
  const travChildren = travelers.filter((t) => t.traveler_type === "child");

  if (travAdults.length !== offerAdults.length) {
    missing.push(`${offerAdults.length} voyageur(s) adulte(s) attendu(s), ${travAdults.length} renseigné(s)`);
  }
  if (travChildren.length !== offerMinors.length) {
    missing.push(`${offerMinors.length} voyageur(s) enfant(s) attendu(s), ${travChildren.length} renseigné(s)`);
  }

  const email = (contact.email ?? "").trim();
  const phone = toE164(contact.phone);
  if (!email) missing.push("email du client payeur (utilisé comme contact des passagers)");
  if (!phone) missing.push("téléphone du client payeur (utilisé comme contact des passagers)");

  const needDocs = offer.passenger_identity_documents_required === true;
  const pairs: { offerId: string; t: ReservationTraveler }[] = [
    ...offerAdults.map((p, i) => ({ offerId: p.id, t: travAdults[i] })).filter((x) => x.t),
    ...offerMinors.map((p, i) => ({ offerId: p.id, t: travChildren[i] })).filter((x) => x.t),
  ];

  const passengers: DuffelOrderPassengerInput[] = [];
  for (const { offerId, t } of pairs) {
    const who = t.full_name || "Voyageur";
    const { given, family } = splitName(t.full_name);
    if (!given || !family) missing.push(`${who} : prénom ET nom (deux mots au moins)`);
    if (!t.date_of_birth) missing.push(`${who} : date de naissance`);
    if (t.gender !== "m" && t.gender !== "f") missing.push(`${who} : genre`);

    let identity_documents: DuffelIdentityDocument[] | undefined;
    if (needDocs) {
      const country = countryCode(t.nationality);
      if (!t.passport_number) missing.push(`${who} : numéro de passeport`);
      if (!t.passport_expires_on) missing.push(`${who} : date d'expiration du passeport`);
      if (!country) missing.push(`${who} : nationalité (pays émetteur du passeport)`);
      if (t.passport_number && t.passport_expires_on && country) {
        identity_documents = [
          {
            type: "passport",
            unique_identifier: t.passport_number.replace(/\s+/g, ""),
            expires_on: t.passport_expires_on,
            issuing_country_code: country.toUpperCase(),
          },
        ];
      }
    }

    if (given && family && t.date_of_birth && (t.gender === "m" || t.gender === "f") && email && phone) {
      passengers.push({
        id: offerId,
        given_name: given,
        family_name: family,
        born_on: t.date_of_birth,
        gender: t.gender,
        title: t.gender === "m" ? "mr" : "ms",
        email,
        phone_number: phone,
        ...(identity_documents ? { identity_documents } : {}),
      });
    }
  }

  if (missing.length > 0) return { ok: false, missing: Array.from(new Set(missing)) };
  return { ok: true, passengers };
}

/** Relecture typée d'un snapshot d'offre stocké en jsonb. */
export function offerFromSnapshot(snapshot: unknown): DuffelOffer | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const o = snapshot as Partial<DuffelOffer>;
  if (!o.id || !Array.isArray(o.slices) || !Array.isArray(o.passengers)) return null;
  return o as DuffelOffer;
}
