// Helpers d'affichage des voyageurs nominatifs (fiche réservation, manifeste,
// voucher). Aucune logique d'accès ici : la RLS et les server actions s'en
// chargent.
import type { TravelerType } from "@/lib/types";

export const TRAVELER_TYPE_LABEL: Record<TravelerType, string> = {
  adult: "Adulte",
  child: "Enfant",
};

/** Abréviation pour les documents de bord : A / E. */
export const TRAVELER_TYPE_SHORT: Record<TravelerType, string> = {
  adult: "A",
  child: "E",
};

/** « •••• 1234 » — seuls les 4 derniers caractères sont visibles. */
export function maskPassport(passport: string | null | undefined): string | null {
  if (!passport) return null;
  const compact = passport.replace(/\s+/g, "");
  if (compact.length <= 4) return "••••";
  return `•••• ${compact.slice(-4)}`;
}

/** Âge en années révolues à la date `at` (défaut : aujourd'hui). */
export function ageFromDob(dob: string, at: Date = new Date()): number {
  const d = new Date(dob);
  let age = at.getFullYear() - d.getFullYear();
  const m = at.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) age -= 1;
  return Math.max(0, age);
}

export type TravelersStatus = "complete" | "incomplete" | "over";

/** Compare les voyageurs renseignés au pax attendu du dossier (adultes + enfants). */
export function travelersStatus(count: number, expected: number): TravelersStatus {
  if (count > expected) return "over";
  if (count < expected) return "incomplete";
  return "complete";
}
