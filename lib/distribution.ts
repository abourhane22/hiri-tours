// Distribution aérienne (lot D1b) : passerelle entre une offre Duffel et le
// modèle métier — produit `billetterie`, dossier, voyageurs, passagers d'ordre.
// Fonctions pures, testables ; les écritures restent dans les server actions.

import type { DuffelOffer, DuffelOrderPassengerInput, DuffelIdentityDocument, DuffelDocument } from "@/lib/duffel-types";
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

// ---------------------------------------------------------------------------
// Profils passagers déclarés à la recherche
// ---------------------------------------------------------------------------

export type ExpectedProfile = { type: "adult" | "child"; age: number | null };

/**
 * Profil de chaque passager tel que déclaré à l'offer request : les adultes
 * par `type: "adult"` (toute date de naissance ≥ 18 ans acceptée), les
 * mineurs par `age` exact. Ordre = ordre des passagers de l'offre.
 */
export function expectedProfiles(offer: DuffelOffer): ExpectedProfile[] {
  return offer.passengers.map((p) =>
    (p.type ?? "adult") === "adult" && (p.age === null || p.age === undefined)
      ? { type: "adult", age: null }
      : { type: "child", age: p.age ?? null },
  );
}

/** Date à laquelle Duffel évalue l'âge : départ du DERNIER slice (doc offer_requests.passengers.age). */
export function offerAgeReferenceDate(offer: DuffelOffer): string {
  const last = offer.slices[offer.slices.length - 1];
  const seg = last?.segments[0];
  return (seg?.departing_at ?? offer.created_at).slice(0, 10);
}

/** Âge révolu à une date donnée (YYYY-MM-DD). null si illisible. */
export function ageAt(dob: string | null | undefined, at: string): number | null {
  if (!dob) return null;
  const b = new Date(dob + "T00:00:00Z");
  const d = new Date(at + "T00:00:00Z");
  if (isNaN(b.getTime()) || isNaN(d.getTime())) return null;
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  const m = d.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && d.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
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
  const refDate = offerAgeReferenceDate(offer);
  const pairs: { offerId: string; declaredAge: number | null; t: ReservationTraveler }[] = [
    ...offerAdults.map((p, i) => ({ offerId: p.id, declaredAge: null, t: travAdults[i] })).filter((x) => x.t),
    ...offerMinors.map((p, i) => ({ offerId: p.id, declaredAge: p.age ?? null, t: travChildren[i] })).filter((x) => x.t),
  ];

  const passengers: DuffelOrderPassengerInput[] = [];
  for (const { offerId, declaredAge, t } of pairs) {
    const who = t.full_name || "Voyageur";
    const isAdult = t.traveler_type === "adult";
    const label = `${who} (${isAdult ? "Adulte" : declaredAge !== null ? `Enfant, ${declaredAge} ans` : "Enfant"})`;
    const { given, family } = splitName(t.full_name);
    if (!given || !family) missing.push(`${label} : prénom ET nom (deux mots au moins)`);
    if (!t.date_of_birth) missing.push(`${label} : date de naissance`);
    if (t.gender !== "m" && t.gender !== "f") missing.push(`${label} : genre`);

    // Cohérence âge / profil déclaré à la recherche — Duffel refuse sinon
    // (« Field 'age' does not match date of birth »). Bloqué AVANT l'appel.
    let ageOk = true;
    const age = ageAt(t.date_of_birth, refDate);
    if (age !== null) {
      const plural = (n: number) => `${n} an${n > 1 ? "s" : ""}`;
      if (isAdult && age < 18) {
        ageOk = false;
        missing.push(`${label} : la date de naissance saisie donne ${plural(age)} à la date du vol — un adulte doit avoir 18 ans ou plus`);
      } else if (!isAdult && declaredAge !== null && age !== declaredAge) {
        ageOk = false;
        missing.push(
          `${label} : la date de naissance saisie donne ${plural(age)} à la date du vol — l'offre a été recherchée pour un enfant de ${plural(declaredAge)}`,
        );
      } else if (!isAdult && age >= 18) {
        ageOk = false;
        missing.push(`${label} : la date de naissance saisie donne ${plural(age)} à la date du vol — un enfant doit avoir moins de 18 ans`);
      }
    }

    let identity_documents: DuffelIdentityDocument[] | undefined;
    if (needDocs) {
      const country = countryCode(t.nationality);
      if (!t.passport_number) missing.push(`${label} : numéro de passeport`);
      if (!t.passport_expires_on) missing.push(`${label} : date d'expiration du passeport`);
      if (!country) missing.push(`${label} : nationalité (pays émetteur du passeport)`);
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

    if (given && family && t.date_of_birth && ageOk && (t.gender === "m" || t.gender === "f") && email && phone) {
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

/**
 * Numéros de billet électronique par voyageur, dans l'ordre des voyageurs
 * fournis. Même appariement qu'à l'émission : i-ème adulte ↔ i-ème passager
 * adulte de l'offre, idem enfants ; les documents Duffel portent
 * `passenger_ids`. Un document sans passenger_ids est rattaché à tous.
 */
export function ticketsByTraveler(
  offer: DuffelOffer,
  documents: DuffelDocument[],
  travelers: { traveler_type: "adult" | "child" }[],
): string[][] {
  const offerAdults = offer.passengers.filter((p) => (p.type ?? "adult") === "adult");
  const offerMinors = offer.passengers.filter((p) => (p.type ?? "adult") !== "adult");
  let a = 0;
  let c = 0;
  return travelers.map((t) => {
    const pid = t.traveler_type === "adult" ? offerAdults[a++]?.id : offerMinors[c++]?.id;
    if (!pid) return [];
    return documents
      .filter((d) => d.type === "electronic_ticket" && (!d.passenger_ids || d.passenger_ids.length === 0 || d.passenger_ids.includes(pid)))
      .map((d) => d.unique_identifier);
  });
}

/** Relecture typée d'un snapshot d'offre stocké en jsonb. */
export function offerFromSnapshot(snapshot: unknown): DuffelOffer | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const o = snapshot as Partial<DuffelOffer>;
  if (!o.id || !Array.isArray(o.slices) || !Array.isArray(o.passengers)) return null;
  return o as DuffelOffer;
}
