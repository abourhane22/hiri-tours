// Référentiel pays partagé (CountrySelect du formulaire client, liste CRM).
// `name` = valeur stockée dans customers.country (nom français, format déjà
// utilisé par l'app). `code` = ISO 3166-1 alpha-2 pour flag-icons
// (classes `fi fi-{code}`) ; null pour « Autre » (icône globe).
export type Country = { name: string; code: string | null };

// 30 pays (ordre imposé par la maquette) + « Autre ».
export const COUNTRIES: Country[] = [
  { name: "Maroc", code: "ma" },
  { name: "France", code: "fr" },
  { name: "Espagne", code: "es" },
  { name: "Allemagne", code: "de" },
  { name: "Royaume-Uni", code: "gb" },
  { name: "Italie", code: "it" },
  { name: "Belgique", code: "be" },
  { name: "Pays-Bas", code: "nl" },
  { name: "Suisse", code: "ch" },
  { name: "Portugal", code: "pt" },
  { name: "États-Unis", code: "us" },
  { name: "Canada", code: "ca" },
  { name: "Japon", code: "jp" },
  { name: "Chine", code: "cn" },
  { name: "Corée du Sud", code: "kr" },
  { name: "Australie", code: "au" },
  { name: "Brésil", code: "br" },
  { name: "Argentine", code: "ar" },
  { name: "Pologne", code: "pl" },
  { name: "Suède", code: "se" },
  { name: "Norvège", code: "no" },
  { name: "Danemark", code: "dk" },
  { name: "Autriche", code: "at" },
  { name: "Irlande", code: "ie" },
  { name: "Émirats arabes unis", code: "ae" },
  { name: "Arabie saoudite", code: "sa" },
  { name: "Qatar", code: "qa" },
  { name: "Turquie", code: "tr" },
  { name: "Tunisie", code: "tn" },
  { name: "Sénégal", code: "sn" },
  { name: "Autre", code: null },
];

const BY_NAME = new Map(COUNTRIES.map((c) => [c.name, c]));

/** Code drapeau flag-icons d'un pays stocké en base ; null si inconnu ou « Autre ». */
export function countryCode(name: string | null | undefined): string | null {
  if (!name) return null;
  return BY_NAME.get(name.trim())?.code ?? null;
}
