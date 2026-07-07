import type { CircuitCategory } from "@/lib/types";

// -------- Per-category field shapes --------

export type CircuitFields = {
  duration_days?: number;         // computed = itinerary.length, still stored for display
  stage_cities?: string;
  itinerary?: string[];           // one entry per day
  lodging_included?: boolean;
  meals_included?: boolean;
};

export type ExcursionFields = {
  duration_hours?: number;
  departure_time?: string;
  meeting_point?: string;
  meeting_lat?: number | null;
  meeting_lng?: number | null;
  difficulty?: "facile" | "modere" | "sportif";
  meals_included?: boolean;
  equipment_included?: boolean;
};

export type TransfertFields = {
  pickup_location?: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_location?: string;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  vehicle_type?: "berline" | "van" | "minibus";
  trip_type?: "aller_simple" | "aller_retour";
  trip_duration_min?: number;
};

export type SejourFields = {
  nights?: number;
  address?: string;
  address_lat?: number | null;
  address_lng?: number | null;
  lodging_type?: "riad" | "hotel_4" | "hotel_5" | "ecolodge";
  board_type?: "petit_dejeuner" | "demi_pension" | "pension_complete";
  included_activities?: string;
};

export type CategoryFields = CircuitFields | ExcursionFields | TransfertFields | SejourFields;
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

// -------- Field configuration --------

export type SelectOption = { value: string; label: string };

export type FieldConfig =
  | { key: string; label: string; type: "text" | "textarea" | "time"; required?: boolean; placeholder?: string }
  | { key: string; label: string; type: "number"; required?: boolean; min?: number; step?: number; placeholder?: string }
  | { key: string; label: string; type: "checkbox"; required?: never }
  | { key: string; label: string; type: "select"; required?: boolean; options: SelectOption[] }
  | {
      key: string;              // config key (also used as base for form field names)
      label: string;
      type: "location";
      required?: boolean;
      addressField: string;     // storage key for the text address
      latField: string;
      lngField: string;
    }
  | {
      key: string;              // "itinerary" for Circuit
      label: string;
      type: "day_list";
      required?: boolean;
    };

export const CATEGORY_FIELDS_CONFIG: Record<CircuitCategory, FieldConfig[]> = {
  circuit: [
    { key: "stage_cities", label: "Villes étapes", type: "text", placeholder: "Agadir → Taroudant → Tafraout" },
    { key: "itinerary", label: "Itinéraire jour par jour", type: "day_list", required: true },
    { key: "lodging_included", label: "Hébergement inclus", type: "checkbox" },
    { key: "meals_included", label: "Repas inclus", type: "checkbox" },
  ],
  excursion: [
    { key: "duration_hours", label: "Durée (heures)", type: "number", required: true, min: 1 },
    { key: "departure_time", label: "Heure de départ", type: "time" },
    {
      key: "meeting",
      label: "Point de rendez-vous",
      type: "location",
      addressField: "meeting_point",
      latField: "meeting_lat",
      lngField: "meeting_lng",
    },
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
    {
      key: "pickup",
      label: "Lieu de prise en charge",
      type: "location",
      required: true,
      addressField: "pickup_location",
      latField: "pickup_lat",
      lngField: "pickup_lng",
    },
    {
      key: "dropoff",
      label: "Destination",
      type: "location",
      required: true,
      addressField: "dropoff_location",
      latField: "dropoff_lat",
      lngField: "dropoff_lng",
    },
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
      key: "address",
      label: "Adresse du séjour",
      type: "location",
      required: true,
      addressField: "address",
      latField: "address_lat",
      lngField: "address_lng",
    },
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

// -------- FormData helpers --------

const FORM_FIELD_PREFIX = "cf_";
export const categoryFieldFormName = (key: string) => `${FORM_FIELD_PREFIX}${key}`;
export const ITINERARY_DAY_FORM_NAME = categoryFieldFormName("itinerary_day");

export type ParseResult =
  | { ok: true; fields: CategoryFields }
  | { ok: false; error: string };

function parseLatLng(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function parseCategoryFieldsFromForm(
  category: CircuitCategory,
  formData: FormData,
): ParseResult {
  const config = CATEGORY_FIELDS_CONFIG[category];
  const out: Record<string, unknown> = {};

  for (const f of config) {
    if (f.type === "checkbox") {
      const raw = formData.get(categoryFieldFormName(f.key));
      out[f.key] = raw === "on" || raw === "true";
      continue;
    }

    if (f.type === "day_list") {
      const days = formData
        .getAll(ITINERARY_DAY_FORM_NAME)
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean);
      if (f.required && days.length === 0) {
        return { ok: false, error: `Le champ "${f.label}" doit contenir au moins une journée.` };
      }
      if (days.length > 0) out[f.key] = days;
      // Only inject duration_days when itinerary drives it (Circuit)
      out.duration_days = days.length || undefined;
      continue;
    }

    if (f.type === "location") {
      const address = formData.get(categoryFieldFormName(f.addressField));
      const lat = formData.get(categoryFieldFormName(f.latField));
      const lng = formData.get(categoryFieldFormName(f.lngField));

      const addressStr = typeof address === "string" ? address.trim() : "";
      if (f.required && !addressStr) {
        return { ok: false, error: `Le champ "${f.label}" est requis.` };
      }
      if (addressStr) out[f.addressField] = addressStr;
      const latN = parseLatLng(lat);
      const lngN = parseLatLng(lng);
      if (latN !== null) out[f.latField] = latN;
      if (lngN !== null) out[f.lngField] = lngN;
      continue;
    }

    const raw = formData.get(categoryFieldFormName(f.key));
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

    out[f.key] = str;
  }

  return { ok: true, fields: out as CategoryFields };
}

// -------- Legacy column derivation --------

export function deriveLegacyColumns(category: CircuitCategory, fields: AnyCategoryFields) {
  let duration_days = 1;
  let duration_hours: number | null = null;
  let meeting_point: string | null = null;

  switch (category) {
    case "circuit":
      duration_days = Number(fields.duration_days) || (Array.isArray(fields.itinerary) ? fields.itinerary.length : 0) || 1;
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

// -------- Backward compat for old itinerary strings --------

export function normalizeItinerary(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    return trimmed.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// -------- Format for display --------

export function formatCategoryFieldValue(
  config: FieldConfig,
  fields: AnyCategoryFields,
): string | null {
  const data = fields as Record<string, unknown>;

  if (config.type === "checkbox") {
    return data[config.key] === true ? "Oui" : null;
  }

  if (config.type === "location") {
    const addr = data[config.addressField];
    return typeof addr === "string" && addr.trim() ? addr.trim() : null;
  }

  if (config.type === "day_list") {
    const days = normalizeItinerary(data[config.key]);
    return days.length > 0 ? `${days.length} journée${days.length > 1 ? "s" : ""}` : null;
  }

  const v = data[config.key];
  if (v === undefined || v === null || v === "") return null;

  if (config.type === "select") {
    const found = config.options.find((o) => o.value === v);
    return found?.label ?? String(v);
  }

  return String(v);
}
