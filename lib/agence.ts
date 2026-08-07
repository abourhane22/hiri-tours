import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/customers";

export type Agence = {
  name: string;
  tel: string;
  email: string;
  address: string;
  whatsapp: string; // format wa.me (chiffres)
};

// Valeurs de repli issues de la maquette (main.js) si un champ manque en base.
const FALLBACK = {
  name: "Hiri Tours",
  tel: "+212 5 28 00 00 00",
  email: "contact@hiritours.ma",
  address: "Avenue Hassan II, Talborjt, Agadir 80000, Maroc",
  whatsapp: "212600000000",
};

/**
 * Coordonnées publiques de l'agence, lues depuis company_settings
 * (service-role). Repli sur les valeurs de la maquette champ par champ.
 * NB : company_settings n'a pas de colonne WhatsApp dédiée → repli maquette.
 */
export async function getAgence(): Promise<Agence> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("company_settings")
    .select("commercial_name, legal_name, phone, email, address_line, postal_code, city, country")
    .limit(1)
    .maybeSingle();

  const c = (data ?? {}) as any;
  const address =
    [c.address_line, [c.postal_code, c.city].filter(Boolean).join(" "), c.country]
      .filter(Boolean)
      .join(", ") || FALLBACK.address;

  return {
    name: c.commercial_name || c.legal_name || FALLBACK.name,
    tel: c.phone || FALLBACK.tel,
    email: c.email || FALLBACK.email,
    address,
    whatsapp: FALLBACK.whatsapp,
  };
}

export function waLink(whatsapp: string, message?: string): string {
  const text = encodeURIComponent(
    message || "Bonjour Hiri Tours, je souhaite des informations sur vos circuits.",
  );
  return `https://wa.me/${whatsapp}?text=${text}`;
}

// Réexport pratique pour d'éventuels usages futurs.
export { normalizePhone };
