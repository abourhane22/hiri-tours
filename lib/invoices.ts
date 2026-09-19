// Facturation légale : mentions attendues sur une facture marocaine d'agence
// de voyages, et libellés partagés (fiche réservation, page facture, registre).
import type { CompanySettings } from "@/lib/types";

/** Mentions légales dont l'absence déclenche un avertissement à la génération (backoffice). */
export const LEGAL_MENTIONS: { key: keyof CompanySettings; label: string }[] = [
  { key: "legal_form", label: "Forme juridique" },
  { key: "capital_mad", label: "Capital social" },
  { key: "address_line", label: "Adresse du siège" },
  { key: "rc", label: "RC" },
  { key: "ice", label: "ICE" },
  { key: "if_number", label: "IF" },
  { key: "patente", label: "Patente" },
  { key: "tva_number", label: "N° TVA" },
  { key: "travel_license", label: "Licence agence de voyages" },
];

/** Libellés des mentions manquantes (vide = dossier légal complet). */
export function missingLegalMentions(company: Partial<CompanySettings> | null | undefined): string[] {
  if (!company) return LEGAL_MENTIONS.map((m) => m.label);
  return LEGAL_MENTIONS.filter((m) => {
    const v = company[m.key];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  }).map((m) => m.label);
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  attijari: "Attijari Payment",
  cmi: "Attijari Payment", // legacy : anciens paiements stockés en 'cmi'
  stripe: "Carte internationale (Stripe)",
  paypal: "PayPal",
  cash: "Espèces",
  card_tpe: "Carte (TPE agence)",
  transfer: "Virement",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  issued: "Émise",
  paid: "Payée",
  cancelled: "Annulée",
};

const fmtMoney = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);

/** « SARL au capital de 100 000 MAD » — première ligne d'identité de l'émetteur. */
export function legalFormLine(c: Partial<CompanySettings>): string | null {
  const parts: string[] = [];
  if (c.legal_form) parts.push(c.legal_form);
  if (c.capital_mad !== null && c.capital_mad !== undefined && Number(c.capital_mad) > 0) {
    parts.push(`au capital de ${fmtMoney(Number(c.capital_mad))} MAD`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Identifiants réglementaires, dans l'ordre d'usage sur les factures marocaines. */
export function legalIdentifiers(c: Partial<CompanySettings>): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (c.rc) out.push({ label: c.rc_city ? `RC ${c.rc_city}` : "RC", value: c.rc });
  if (c.ice) out.push({ label: "ICE", value: c.ice });
  if (c.if_number) out.push({ label: "IF", value: c.if_number });
  if (c.patente) out.push({ label: "Patente", value: c.patente });
  if (c.tva_number) out.push({ label: "TVA", value: c.tva_number });
  if (c.cnss) out.push({ label: "CNSS", value: c.cnss });
  if (c.travel_license) out.push({ label: "Licence agence de voyages", value: c.travel_license });
  return out;
}
