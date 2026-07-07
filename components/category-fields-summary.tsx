import {
  CATEGORY_FIELDS_CONFIG,
  CATEGORY_META,
  formatCategoryFieldValue,
  normalizeItinerary,
  type AnyCategoryFields,
  type FieldConfig,
} from "@/lib/category-fields";
import type { CircuitCategory } from "@/lib/types";

type Props = {
  category: CircuitCategory;
  fields: AnyCategoryFields | null | undefined;
};

function osmLink(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
}

export function CategoryFieldsSummary({ category, fields }: Props) {
  const config = CATEGORY_FIELDS_CONFIG[category];
  const meta = CATEGORY_META[category];
  const data = (fields ?? {}) as AnyCategoryFields;
  const dataRecord = data as Record<string, unknown>;

  // Split visible fields: day_list rendered on its own; others as label/value.
  const dayListConfig = config.find((f) => f.type === "day_list");
  const dayList = dayListConfig
    ? normalizeItinerary(dataRecord[dayListConfig.key])
    : [];

  const otherRows = config
    .filter((f) => f.type !== "day_list")
    .map((f) => ({
      config: f,
      value: formatCategoryFieldValue(f, data),
    }))
    .filter((r) => r.value !== null);

  const hasContent = dayList.length > 0 || otherRows.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className="px-2 py-0.5 rounded-md text-xs font-medium"
          style={meta.badgeStyle}
        >
          {meta.sectionSuffix}
        </span>
      </div>

      {!hasContent && (
        <p className="text-sm text-sand-600 italic">
          Aucun champ spécifique renseigné.
        </p>
      )}

      {otherRows.length > 0 && (
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
          {otherRows.map(({ config: c, value }) => (
            <div key={c.key} className="flex items-baseline gap-2 flex-wrap">
              <dt className="text-sand-600 shrink-0">{c.label} :</dt>
              <dd className="text-ink font-medium">{value}</dd>
              {c.type === "location" && <LocationLink field={c} data={dataRecord} />}
            </div>
          ))}
        </dl>
      )}

      {dayListConfig && dayList.length > 0 && (
        <div>
          <div className="text-sm text-sand-600 mb-2">
            {dayListConfig.label} · {dayList.length} journée
            {dayList.length > 1 ? "s" : ""}
          </div>
          <ol className="space-y-1.5">
            {dayList.map((text, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className="shrink-0 min-w-9 h-7 px-2 rounded-full flex items-center justify-center text-xs font-medium tabular-nums"
                  style={{ backgroundColor: "#EEEDFE", color: "#3C3489" }}
                >
                  J{i + 1}
                </span>
                <span className="text-ink pt-0.5">{text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function LocationLink({
  field,
  data,
}: {
  field: Extract<FieldConfig, { type: "location" }>;
  data: Record<string, unknown>;
}) {
  const lat = data[field.latField];
  const lng = data[field.lngField];
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return (
    <a
      href={osmLink(lat, lng)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-atlantic-700 hover:text-atlantic-900 underline"
    >
      Voir sur la carte
    </a>
  );
}
