"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { LocationPicker } from "@/components/location-picker";
import { ItineraryDayList } from "@/components/itinerary-day-list";
import {
  CATEGORY_FIELDS_CONFIG,
  CATEGORY_META,
  categoryFieldFormName,
  type AnyCategoryFields,
  type FieldConfig,
} from "@/lib/category-fields";
import type { CircuitCategory } from "@/lib/types";

type Props = {
  defaultCategory: CircuitCategory;
  defaultFields: AnyCategoryFields | null;
  /** Numéro affiché dans la pastille de section (défaut 3). */
  sectionNumber?: number;
};

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

export function CategoryFieldsSection({
  defaultCategory,
  defaultFields,
  sectionNumber = 3,
}: Props) {
  const [category, setCategory] = useState<CircuitCategory>(defaultCategory);

  const meta = CATEGORY_META[category];
  const fields = CATEGORY_FIELDS_CONFIG[category];
  const categoryChanged = category !== defaultCategory;
  const seedFields: AnyCategoryFields =
    category === defaultCategory ? (defaultFields ?? {}) : {};

  return (
    <>
      <div>
        <label htmlFor="category" className={labelCls}>
          Catégorie <span className="text-red-600">*</span>
        </label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as CircuitCategory)}
          required
          className={fieldCls}
        >
          <option value="circuit">Circuit</option>
          <option value="excursion">Excursion</option>
          <option value="transfert">Transfert</option>
          <option value="sejour">Séjour</option>
        </select>
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[#968F84]">
          <Info className="size-3.5 shrink-0 mt-px" />
          Changer de catégorie réinitialise les champs spécifiques.
          {categoryChanged && (
            <span className="text-[#B25F0B] font-medium"> Champs réinitialisés.</span>
          )}
        </p>
      </div>

      <div className="pt-4 border-t border-[#EBE6DC]">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-md bg-[#1A1F2E] text-white text-[11px] font-medium flex items-center justify-center">
              {sectionNumber}
            </span>
            <h2 className="font-display text-base text-[#1A1F2E] m-0">
              Champs spécifiques
            </h2>
          </div>
          <span
            className="px-2 py-0.5 rounded-md text-xs font-medium"
            style={meta.badgeStyle}
          >
            {meta.sectionSuffix}
          </span>
        </div>

        <div key={category} className="grid sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <FieldRenderer key={f.key} config={f} seed={seedFields} />
          ))}
        </div>
      </div>
    </>
  );
}

function FieldRenderer({
  config,
  seed,
}: {
  config: FieldConfig;
  seed: AnyCategoryFields;
}) {
  const seedRecord = seed as Record<string, unknown>;
  const name = categoryFieldFormName(config.key);

  const requiredMark =
    config.type !== "checkbox" && (config as { required?: boolean }).required ? (
      <span className="text-red-600"> *</span>
    ) : null;

  if (config.type === "day_list") {
    return (
      <ItineraryDayList
        label={config.label}
        required={config.required}
        defaultValue={seedRecord[config.key]}
      />
    );
  }

  if (config.type === "location") {
    const address = seedRecord[config.addressField];
    const lat = seedRecord[config.latField];
    const lng = seedRecord[config.lngField];
    return (
      <div className="sm:col-span-2">
        <LocationPicker
          label={config.label}
          required={config.required}
          addressName={categoryFieldFormName(config.addressField)}
          latName={categoryFieldFormName(config.latField)}
          lngName={categoryFieldFormName(config.lngField)}
          defaultValue={{
            address: typeof address === "string" ? address : "",
            lat: typeof lat === "number" ? lat : null,
            lng: typeof lng === "number" ? lng : null,
          }}
        />
      </div>
    );
  }

  const raw = seedRecord[config.key];

  if (config.type === "checkbox") {
    const checked = raw === true;
    return (
      <label className="flex items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          name={name}
          defaultChecked={checked}
          className="size-4 rounded border-sand-300 text-[#1A1F2E] focus:ring-[#1A1F2E]/20"
        />
        <span className="text-sm text-[#1A1F2E]">{config.label}</span>
      </label>
    );
  }

  if (config.type === "textarea") {
    return (
      <div className="sm:col-span-2">
        <label htmlFor={name} className={labelCls}>
          {config.label}
          {requiredMark}
        </label>
        <textarea
          id={name}
          name={name}
          rows={4}
          defaultValue={typeof raw === "string" ? raw : ""}
          required={!!config.required}
          placeholder={config.placeholder}
          className={`${fieldCls} h-auto py-2`}
        />
      </div>
    );
  }

  if (config.type === "select") {
    const current = typeof raw === "string" ? raw : "";
    return (
      <div>
        <label htmlFor={name} className={labelCls}>
          {config.label}
          {requiredMark}
        </label>
        <select
          id={name}
          name={name}
          defaultValue={current}
          required={!!config.required}
          className={fieldCls}
        >
          <option value="">— Choisir —</option>
          {config.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const inputType =
    config.type === "number" ? "number" : config.type === "time" ? "time" : "text";

  const defaultVal =
    config.type === "number"
      ? typeof raw === "number"
        ? String(raw)
        : ""
      : typeof raw === "string"
        ? raw
        : "";

  return (
    <div>
      <label htmlFor={name} className={labelCls}>
        {config.label}
        {requiredMark}
      </label>
      <input
        id={name}
        name={name}
        type={inputType}
        defaultValue={defaultVal}
        required={!!config.required}
        min={config.type === "number" ? config.min : undefined}
        step={config.type === "number" ? config.step : undefined}
        placeholder={
          config.type === "number"
            ? config.placeholder
            : (config as { placeholder?: string }).placeholder
        }
        className={fieldCls}
      />
    </div>
  );
}
