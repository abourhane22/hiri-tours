import type { CircuitCategory } from "@/lib/types";

// -------- Per-category field shapes --------

export type CircuitFields = {
  duration_days?: number;
  stage_cities?: string;
  itinerary?: string;
  lodging_included?: boolean;
  meals_included?: boolean;
};

export type ExcursionFields = {
  duration_hours?: number;
  departure_time?: string;
  meeting_point?: string;
  difficulty?: "facile" | "modere" | "sportif";
  meals_included?: boolean;
  equipment_included?: boolean;
};

export type TransfertFields = {
  pickup_location?: string;
  dropoff_location?: string;
  vehicle_type?: "berline" | "van" | "minibus";
  trip_type?: "aller_simple" | "aller_retour";
  trip_duration_min?: number;
};

export type SejourFields = {
  nights?: number;
  lodging_type?: "riad" | "hotel_4" | "hotel_5" | "ecolodge";
  board_type?: "petit_dejeuner" | "demi_pension" | "pension_complete";
  included_activities?: string;
};

// Stored jsonb shape — one category's fields, all optional at rest
export type CategoryFields = CircuitFields | ExcursionFields | TransfertFields | SejourFields;

// Convenience "any known key" record for reading legacy or unknown data
export type AnyCategoryFields = CircuitFields & ExcursionFields & TransfertFields & SejourFields;

// -------- Display metadata --------

export const CATEGORY_META: Record<
  CircuitCategory,
  {
    label: string;
    sectionSuffix: string;
    badgeStyle: { backgroundColor: string; color: string };
  }
> = {
  circuit: {
    label: "Circuit",
    sectionSuffix: "Multi-jours",
    badgeStyle: { backgroundColor: "#EEEDFE", color: "#3C3489" },
  },
  excursion: {
    label: "Excursion",
    sectionSuffix: "Journée",
    badgeStyle: { backgroundColor: "#E1F5EE", color: "#085041" },
  },
  transfert: {
    label: "Transfert",
    sectionSuffix: "Point à point",
    badgeStyle: { backgroundColor: "#E6F1FB", color: "#0C447C" },
  },
  sejour: {
    label: "Séjour",
    sectionSuffix: "Nuitées",
    badgeStyle: { backgroundColor: "#FAEEDA", color: "#633806" },
  },
};

// -------- Field configuration (drives both form rendering and server parsing) --------

export type SelectOption = { value: string; label: string };

export type FieldConfig =
  | { key: string; label: string; type: "text" | "textarea" | "time"; required?: boolean; placeholder?: string }
  | { key: string; label: string; type: "number"; required?: boolean; min?: number; step?: number; placeholder?: string }
  | { key: string; label: string; type: "checkbox"; required?: never }
  | { key: string; label: string; type: "select"; required?: boolean; options: SelectOption[] };

export const CATEGORY_FIELDS_CONFIG: Record<CircuitCategory, FieldConfig[]> = {
  circuit: [
    { key: "duration_days", label: "Durée (jours)", type: "number", required: true, min: 1 },
    { key: "stage_cities", label: "Villes étapes", type: "text", placeholder: "Agadir → Taroudant → Tafraout" },
    { key: "itinerary", label: "Itinéraire jour par jour", type: "textarea", placeholder: "Jour 1 : …\nJour 2 : …" },
    { key: "lodging_included", label: "Hébergement inclus", type: "checkbox" },
    { key: "meals_included", label: "Repas inclus", type: "checkbox" },
  ],
  excursion: [
    { key: "duration_hours", label: "Durée (heures)", type: "number", required: true, min: 1 },
    { key: "departure_time", label: "Heure de départ", type: "time" },
    { key: "meeting_point", label: "Point de rendez-vous", type: "text" },
    {
      key: "difficulty",
      label: "Niveau de difficulté",
      type: "select",
      options: [
        { value: "facile", label: "Facile — tout public" },
        { value: "modere", label: "Modéré — bonne condition" },
        { value: "sportif", label: "Sportif — expérimentés" },
      ],
    },
    { key: "meals_included", label: "Repas inclus", type: "checkbox" },
    { key: "equipment_included", label: "Matériel fourni", type: "checkbox" },
  ],
  transfert: [
    { key: "pickup_location", label: "Lieu de prise en charge", type: "text", required: true },
    { key: "dropoff_location", label: "Destination", type: "text", required: true },
    {
      key: "vehicle_type",
      label: "Type de véhicule",
      type: "select",
      options: [
        { value: "berline", label: "Berline — jusqu'à 3 pax" },
        { value: "van", label: "Van — jusqu'à 8 pax" },
        { value: "minibus", label: "Minibus — jusqu'à 14 pax" },
      ],
    },
    {
      key: "trip_type",
      label: "Formule",
      type: "select",
      options: [
        { value: "aller_simple", label: "Aller simple" },
        { value: "aller_retour", label: "Aller-retour" },
      ],
    },
    { key: "trip_duration_min", label: "Durée estimée du trajet (min)", type: "number", min: 1 },
  ],
  sejour: [
    { key: "nights", label: "Nombre de nuits", type: "number", required: true, min: 1 },
    {
      key: "lodging_type",
      label: "Hébergement",
      type: "select",
      options: [
        { value: "riad", label: "Riad" },
        { value: "hotel_4", label: "Hôtel 4★" },
        { value: "hotel_5", label: "Hôtel 5★" },
        { value: "ecolodge", label: "Écolodge" },
      ],
    },
    {
      key: "board_type",
      label: "Pension",
      type: "select",
      options: [
        { value: "petit_dejeuner", label: "Petit-déjeuner" },
        { value: "demi_pension", label: "Demi-pension" },
        { value: "pension_complete", label: "Pension complète" },
      ],
    },
    { key: "included_activities", label: "Activités incluses", type: "text" },
  ],
};

// -------- FormData → typed CategoryFields (server-side) --------

const FORM_FIELD_PREFIX = "cf_";
export const categoryFieldFormName = (key: string) => `${FORM_FIELD_PREFIX}${key}`;

export type ParseResult =
  | { ok: true; fields: CategoryFields }
  | { ok: false; error: string };

export function parseCategoryFieldsFromForm(
  category: CircuitCategory,
  formData: FormData,
): ParseResult {
  const config = CATEGORY_FIELDS_CONFIG[category];
  const out: Record<string, unknown> = {};

  for (const f of config) {
    const raw = formData.get(categoryFieldFormName(f.key));

    if (f.type === "checkbox") {
      out[f.key] = raw === "on" || raw === "true";
      continue;
    }

    const str = typeof raw === "string" ? raw.trim() : "";

    if (!str) {
      if (f.required) {
        return { ok: false, error: `Le champ "${f.label}" est requis pour la catégorie ${CATEGORY_META[category].label}.` };
      }
      continue;
    }

    if (f.type === "number") {
      const n = Number(str);
      if (!Number.isFinite(n)) {
        return { ok: false, error: `Le champ "${f.label}" doit être un nombre.` };
      }
      out[f.key] = n;
      continue;
    }

    if (f.type === "select") {
      if (!f.options.some((o) => o.value === str)) {
        return { ok: false, error: `Valeur invalide pour "${f.label}".` };
      }
      out[f.key] = str;
      continue;
    }

    // text | textarea | time
    out[f.key] = str;
  }

  return { ok: true, fields: out as CategoryFields };
}

// -------- Legacy column derivation --------
// Existing display code still reads circuits.duration_days, duration_hours, meeting_point.
// Keep them in sync from category_fields for backward compatibility.

export function deriveLegacyColumns(category: CircuitCategory, fields: AnyCategoryFields) {
  let duration_days = 1;
  let duration_hours: number | null = null;
  let meeting_point: string | null = null;

  switch (category) {
    case "circuit":
      duration_days = Number(fields.duration_days) || 1;
      break;
    case "excursion":
      duration_hours = Number(fields.duration_hours) || null;
      meeting_point = fields.meeting_point?.trim() || null;
      break;
    case "transfert":
      meeting_point = fields.pickup_location?.trim() || null;
      break;
    case "sejour":
      duration_days = Math.max(1, Number(fields.nights) || 1);
      break;
  }

  return { duration_days, duration_hours, meeting_point };
}

// -------- Format for display --------

export function formatCategoryFieldValue(
  config: FieldConfig,
  fields: AnyCategoryFields,
): string | null {
  const v = (fields as Record<string, unknown>)[config.key];

  if (config.type === "checkbox") {
    return v === true ? "Oui" : null; // hide false booleans
  }
  if (v === undefined || v === null || v === "") return null;

  if (config.type === "select") {
    const found = config.options.find((o) => o.value === v);
    return found?.label ?? String(v);
  }

  if (config.type === "number") {
    return String(v);
  }

  return String(v);
}
