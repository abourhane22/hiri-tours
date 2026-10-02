// Identité réutilisable du client (fiche client → voyageurs) — fonctions pures.
//
// Règles (validées) :
//  - COPIE, jamais lien : modifier la fiche client ne change aucun dossier existant ;
//  - on ne recopie QUE ce que le profil du dossier exige (lib/dossier-profile.ts) ;
//  - la nationalité vient de customers.nationality, JAMAIS de customers.country (résidence) ;
//  - une pièce n'est copiée que si son type est admis par le profil (billetterie :
//    passeport seulement — une CIN n'est jamais copiée).
// Données sensibles : backoffice uniquement (jamais public, suivi, voucher, manifeste, emails).

import type { DossierProfile } from "@/lib/dossier-profile";
import { foldAccents } from "@/lib/utils";

export type CustomerIdentity = {
  nationality: string | null;
  date_of_birth: string | null;
  gender: "m" | "f" | null;
  id_document_type: "cin" | "passeport" | null;
  id_document_number: string | null;
  id_document_expires_on: string | null;
};

/** Colonnes de la fiche client utiles à l'identité (jamais `select("*")`). */
export const CUSTOMER_IDENTITY_COLUMNS = "nationality, date_of_birth, gender, id_document_type, id_document_number, id_document_expires_on";

const filled = (v: unknown): boolean => typeof v === "string" ? v.trim() !== "" : v !== null && v !== undefined;

/** Champs voyageur (reservation_travelers) pré-remplis depuis la fiche client, selon le profil. */
export function travelerFieldsFromCustomer(c: Partial<CustomerIdentity> | null | undefined, profile: DossierProfile): Record<string, string> {
  const out: Record<string, string> = {};
  if (!c) return out;
  const req = profile.travelerRequired;
  if (req.includes("date_of_birth") && filled(c.date_of_birth)) out.date_of_birth = String(c.date_of_birth);
  if (req.includes("gender") && (c.gender === "m" || c.gender === "f")) out.gender = c.gender;
  if (req.includes("nationality") && filled(c.nationality)) out.nationality = String(c.nationality);
  const docAllowed = !!c.id_document_type && profile.idDocumentTypes.includes(c.id_document_type);
  if (req.includes("id_document") && docAllowed && filled(c.id_document_number)) {
    out.passport_number = String(c.id_document_number).trim();
    out.id_document_type = String(c.id_document_type);
    if (req.includes("passport_expires_on") && c.id_document_type === "passeport" && filled(c.id_document_expires_on)) {
      out.passport_expires_on = String(c.id_document_expires_on);
    }
  }
  return out;
}

/** La fiche client n'a encore aucune donnée d'identité. */
export function customerIdentityEmpty(c: Partial<CustomerIdentity> | null | undefined): boolean {
  if (!c) return true;
  return !filled(c.date_of_birth) && !filled(c.gender) && !filled(c.id_document_number) && !filled(c.id_document_expires_on);
}

/** Sens inverse (case « Enregistrer aussi sur la fiche client ») : seuls les champs SAISIS sont recopiés. */
export function customerFieldsFromTraveler(t: {
  date_of_birth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  id_document_type?: string | null;
  passport_number?: string | null;
  passport_expires_on?: string | null;
}): Partial<CustomerIdentity> {
  const out: Partial<CustomerIdentity> = {};
  if (filled(t.date_of_birth)) out.date_of_birth = String(t.date_of_birth);
  if (t.gender === "m" || t.gender === "f") out.gender = t.gender;
  if (filled(t.nationality)) out.nationality = String(t.nationality);
  if (filled(t.passport_number) && (t.id_document_type === "cin" || t.id_document_type === "passeport")) {
    out.id_document_type = t.id_document_type;
    out.id_document_number = String(t.passport_number).trim();
    out.id_document_expires_on = filled(t.passport_expires_on) ? String(t.passport_expires_on) : null;
  }
  return out;
}

/** La pièce expire dans moins de `months` mois (ou est déjà expirée). */
export function documentExpiresSoon(expiresOn: string | null | undefined, months = 6, now: Date = new Date()): boolean {
  if (!expiresOn) return false;
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() + months);
  return new Date(expiresOn + "T00:00:00") < limit;
}

/** Clé de dédoublonnage des voyageurs habituels : nom (sans accents ni casse) + date de naissance. */
export function habitualKey(fullName: string, dob: string | null | undefined): string {
  return `${foldAccents(fullName).trim().toLowerCase().replace(/\s+/g, " ")}|${dob ?? ""}`;
}
