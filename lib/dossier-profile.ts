// Profil de dossier par type de produit — LA règle, en un seul endroit :
// quels champs voyageur afficher/exiger, quelle logistique attendre, quelle
// carte spéciale, quelles colonnes de manifeste. Consommée par la fiche
// dossier, le formulaire voyageurs, le badge de cohérence, les manifestes
// (liste + détail) et le formulaire de nouvelle réservation.
//
// Client-safe : fonctions pures, objets sérialisables.

import type { CircuitCategory, ReservationTraveler } from "@/lib/types";

export type TravelerField = "date_of_birth" | "id_document" | "nationality" | "gender" | "passport_expires_on";

export type DossierProfileKey = "light" | "transfer" | "identity" | "stay" | "flight";

export type DossierProfile = {
  key: DossierProfileKey;
  /** Libellé de la carte voyageurs. */
  travelerLabel: "Voyageurs" | "Occupants" | "Passagers";
  /** Champs affichés dans le formulaire voyageur (nom + type toujours). */
  travelerFields: TravelerField[];
  /** Champs requis pour compter un voyageur comme « renseigné ». */
  travelerRequired: TravelerField[];
  /** Aide sous le titre quand rien n'est requis au-delà du nom. */
  travelerHint: string | null;
  /** Pièce d'identité : type imposé (billetterie → passeport) ou libre (CIN / passeport). */
  idDocumentTypes: ("cin" | "passeport")[];
  /** Ressources attendues ; toutes fausses ⇒ carte Logistique masquée. */
  logistics: { vehicle: boolean; driver: boolean; guide: boolean };
  /** Carte spéciale de la fiche. */
  extraCard: "arrival" | "stay" | "flight" | null;
  /** Manifeste : jeu de colonnes, présence de l'équipage et du guide, liste des occupants. */
  manifest: { columns: "default" | "transfer" | "stay"; crew: boolean; guide: boolean; occupants: boolean; signatures: boolean };
};

const ID_FIELDS: TravelerField[] = ["date_of_birth", "id_document", "nationality"];

const BASE: Record<DossierProfileKey, DossierProfile> = {
  light: {
    key: "light",
    travelerLabel: "Voyageurs",
    travelerFields: [],
    travelerRequired: [],
    travelerHint: "Nom et type suffisent — pour le manifeste.",
    idDocumentTypes: ["cin", "passeport"],
    logistics: { vehicle: true, driver: true, guide: true },
    extraCard: null,
    manifest: { columns: "default", crew: true, guide: true, occupants: false, signatures: true },
  },
  transfer: {
    key: "transfer",
    travelerLabel: "Passagers",
    travelerFields: [],
    travelerRequired: [],
    travelerHint: "Nom et type suffisent — le chauffeur a besoin du vol et de l'heure d'arrivée (carte Arrivée).",
    idDocumentTypes: ["cin", "passeport"],
    logistics: { vehicle: true, driver: true, guide: false },
    extraCard: "arrival",
    manifest: { columns: "transfer", crew: true, guide: false, occupants: false, signatures: true },
  },
  identity: {
    key: "identity",
    travelerLabel: "Voyageurs",
    travelerFields: ID_FIELDS,
    travelerRequired: ID_FIELDS,
    travelerHint: null,
    idDocumentTypes: ["cin", "passeport"],
    logistics: { vehicle: true, driver: true, guide: true },
    extraCard: null,
    manifest: { columns: "default", crew: true, guide: true, occupants: false, signatures: true },
  },
  stay: {
    key: "stay",
    travelerLabel: "Occupants",
    travelerFields: ID_FIELDS,
    travelerRequired: ID_FIELDS,
    travelerHint: null,
    idDocumentTypes: ["cin", "passeport"],
    logistics: { vehicle: false, driver: false, guide: false },
    extraCard: "stay",
    manifest: { columns: "stay", crew: false, guide: false, occupants: true, signatures: false },
  },
  flight: {
    key: "flight",
    travelerLabel: "Passagers",
    travelerFields: ["date_of_birth", "gender", "id_document", "passport_expires_on", "nationality"],
    travelerRequired: ["date_of_birth", "gender", "id_document", "passport_expires_on", "nationality"],
    travelerHint: null,
    idDocumentTypes: ["passeport"],
    logistics: { vehicle: false, driver: false, guide: false },
    extraCard: "flight",
    manifest: { columns: "default", crew: false, guide: false, occupants: true, signatures: false },
  },
};

const BY_CATEGORY: Record<CircuitCategory, DossierProfileKey> = {
  excursion: "light",
  prestation: "light",
  transfert: "transfer",
  circuit: "identity",
  sejour: "identity",
  hebergement: "stay",
  billetterie: "flight",
};

export type ProfileProduct = { category: CircuitCategory | string | null | undefined; identity_documents_required?: boolean | null };

/**
 * Profil d'un dossier d'après son produit. `identity_documents_required`
 * (interrupteur produit) force la pièce d'identité quel que soit le type.
 */
export function getDossierProfile(product: ProfileProduct | null | undefined, _reservation?: unknown): DossierProfile {
  const key = BY_CATEGORY[(product?.category ?? "circuit") as CircuitCategory] ?? "identity";
  const base = BASE[key];
  if (!product?.identity_documents_required || base.travelerRequired.includes("id_document")) return base;
  const add = (list: TravelerField[]) => Array.from(new Set([...list, ...ID_FIELDS]));
  return {
    ...base,
    travelerFields: add(base.travelerFields),
    travelerRequired: add(base.travelerRequired),
    travelerHint: "Pièce d'identité exigée par un fournisseur ou une autorité.",
  };
}

export const TRAVELER_FIELD_LABEL: Record<TravelerField, string> = {
  date_of_birth: "date de naissance",
  id_document: "pièce d'identité",
  nationality: "nationalité",
  gender: "genre",
  passport_expires_on: "expiration du passeport",
};

export const ID_DOCUMENT_TYPE_LABEL: Record<"cin" | "passeport", string> = { cin: "CIN", passeport: "Passeport" };

export const MEAL_PLANS: { value: string; label: string }[] = [
  { value: "none", label: "Sans repas" },
  { value: "breakfast", label: "Petit-déjeuner" },
  { value: "half_board", label: "Demi-pension" },
  { value: "full_board", label: "Pension complète" },
  { value: "all_inclusive", label: "Tout inclus" },
];
export const MEAL_PLAN_LABEL: Record<string, string> = Object.fromEntries(MEAL_PLANS.map((m) => [m.value, m.label]));

type TravelerLike = Pick<ReservationTraveler, "full_name" | "date_of_birth" | "nationality" | "passport_number" | "gender" | "passport_expires_on"> & {
  id_document_type?: "cin" | "passeport" | null;
};

/** Champs requis du profil manquants pour un voyageur (vide ⇒ renseigné). */
export function missingTravelerFields(profile: DossierProfile, t: TravelerLike): TravelerField[] {
  const out: TravelerField[] = [];
  for (const f of profile.travelerRequired) {
    switch (f) {
      case "date_of_birth":
        if (!t.date_of_birth) out.push(f);
        break;
      case "nationality":
        if (!t.nationality) out.push(f);
        break;
      case "gender":
        if (t.gender !== "m" && t.gender !== "f") out.push(f);
        break;
      case "passport_expires_on":
        if (!t.passport_expires_on) out.push(f);
        break;
      case "id_document": {
        // Numéro requis ; type requis quand plusieurs sont admis (billetterie : passeport implicite).
        const typeOk = profile.idDocumentTypes.length === 1 || !!t.id_document_type;
        if (!t.passport_number || !typeOk) out.push(f);
        break;
      }
    }
  }
  return out;
}

export function travelerIsComplete(profile: DossierProfile, t: TravelerLike): boolean {
  return !!(t.full_name && t.full_name.trim()) && missingTravelerFields(profile, t).length === 0;
}

export type TravelersStatus = "complete" | "incomplete" | "over";

/**
 * Badge « renseignés / attendus » : un voyageur compte s'il a TOUS les champs
 * requis du profil. `over` quand il y a plus de voyageurs que de pax.
 */
export function travelersStatus(profile: DossierProfile, travelers: TravelerLike[], expected: number): { status: TravelersStatus; complete: number } {
  const complete = travelers.filter((t) => travelerIsComplete(profile, t)).length;
  if (travelers.length > expected) return { status: "over", complete };
  if (complete < expected) return { status: "incomplete", complete };
  return { status: "complete", complete };
}

/** Le manifeste ne porte jamais de numéro de pièce : seuls ces champs sont autorisés. */
export const MANIFEST_TRAVELER_COLUMNS = "reservation_id, full_name, traveler_type, date_of_birth" as const;

/** Check-in / check-out d'un hébergement : date de départ + nuits. */
export function stayDates(departureDate: string, nights: number | null | undefined): { checkIn: string; checkOut: string; nights: number } {
  const n = Math.max(1, Number(nights) || 1);
  const d = new Date(departureDate + "T00:00:00");
  const out = new Date(d);
  out.setDate(d.getDate() + n);
  const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { checkIn: departureDate, checkOut: ymd(out), nights: n };
}
