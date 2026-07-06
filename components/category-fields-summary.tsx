import {
  CATEGORY_FIELDS_CONFIG,
  CATEGORY_META,
  formatCategoryFieldValue,
  type AnyCategoryFields,
} from "@/lib/category-fields";
import type { CircuitCategory } from "@/lib/types";

type Props = {
  category: CircuitCategory;
  fields: AnyCategoryFields | null | undefined;
};

export function CategoryFieldsSummary({ category, fields }: Props) {
  const config = CATEGORY_FIELDS_CONFIG[category];
  const meta = CATEGORY_META[category];
  const data = (fields ?? {}) as AnyCategoryFields;

  const rows = config
    .map((f) => ({ config: f, value: formatCategoryFieldValue(f, data) }))
    .filter((r) => r.value !== null);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span
          className="px-2 py-0.5 rounded-md text-xs font-medium"
          style={meta.badgeStyle}
        >
          {meta.sectionSuffix}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-sand-600 italic">
          Aucun champ spécifique renseigné.
        </p>
      ) : (
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {rows.map(({ config: c, value }) => (
            <div key={c.key} className="flex items-baseline gap-2">
              <dt className="text-sand-600 shrink-0">{c.label} :</dt>
              <dd className="text-ink font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
