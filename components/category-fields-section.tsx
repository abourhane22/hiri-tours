"use client";

import { useState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
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
};

export function CategoryFieldsSection({ defaultCategory, defaultFields }: Props) {
  const [category, setCategory] = useState<CircuitCategory>(defaultCategory);

  const meta = CATEGORY_META[category];
  const fields = CATEGORY_FIELDS_CONFIG[category];
  const categoryChanged = category !== defaultCategory;
  const seedFields: AnyCategoryFields =
    category === defaultCategory ? (defaultFields ?? {}) : {};

  return (
    <>
      <div>
        <Label htmlFor="category">Catégorie</Label>
        <Select
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as CircuitCategory)}
          required
        >
          <option value="circuit">Circuit</option>
          <option value="excursion">Excursion</option>
          <option value="transfert">Transfert</option>
          <option value="sejour">Séjour</option>
        </Select>
        {categoryChanged && (
          <p className="text-xs text-amber-700 mt-1.5">
            Changer de catégorie réinitialise les champs spécifiques.
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-sand-200">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <h2 className="font-display text-lg text-ink m-0">Champs spécifiques</h2>
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
          className="size-4 rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500"
        />
        <span className="text-sm text-ink">{config.label}</span>
      </label>
    );
  }

  if (config.type === "textarea") {
    return (
      <div className="sm:col-span-2">
        <Label htmlFor={name}>
          {config.label}
          {requiredMark}
        </Label>
        <Textarea
          id={name}
          name={name}
          rows={4}
          defaultValue={typeof raw === "string" ? raw : ""}
          required={!!config.required}
          placeholder={config.placeholder}
        />
      </div>
    );
  }

  if (config.type === "select") {
    const current = typeof raw === "string" ? raw : "";
    return (
      <div>
        <Label htmlFor={name}>
          {config.label}
          {requiredMark}
        </Label>
        <Select
          id={name}
          name={name}
          defaultValue={current}
          required={!!config.required}
        >
          <option value="">— Choisir —</option>
          {config.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  const inputType =
    config.type === "number" ? "number" :
    config.type === "time" ? "time" :
    "text";

  const defaultVal =
    config.type === "number"
      ? (typeof raw === "number" ? String(raw) : "")
      : (typeof raw === "string" ? raw : "");

  return (
    <div>
      <Label htmlFor={name}>
        {config.label}
        {requiredMark}
      </Label>
      <Input
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
      />
    </div>
  );
}
