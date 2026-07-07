"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import {
  ITINERARY_DAY_FORM_NAME,
  normalizeItinerary,
} from "@/lib/category-fields";

type Props = {
  label: string;
  required?: boolean;
  defaultValue?: unknown;
};

type Day = { id: string; text: string };

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `d-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function ItineraryDayList({ label, required, defaultValue }: Props) {
  const initial = normalizeItinerary(defaultValue);
  const [days, setDays] = useState<Day[]>(() => {
    const seed = initial.length > 0 ? initial : [""];
    return seed.map((text) => ({ id: makeId(), text }));
  });

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const focusIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusIdRef.current) {
      const el = inputRefs.current.get(focusIdRef.current);
      el?.focus();
      focusIdRef.current = null;
    }
  }, [days.length]);

  function addDay() {
    const newDay: Day = { id: makeId(), text: "" };
    focusIdRef.current = newDay.id;
    setDays((prev) => [...prev, newDay]);
  }

  function removeDay(id: string) {
    setDays((prev) => (prev.length === 1 ? prev : prev.filter((d) => d.id !== id)));
  }

  function updateDay(id: string, text: string) {
    setDays((prev) => prev.map((d) => (d.id === id ? { ...d, text } : d)));
  }

  return (
    <div className="sm:col-span-2 space-y-2">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <Label className="mb-0">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </Label>
        <span className="text-xs text-sand-600">
          Durée : {days.length} jour{days.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-2">
        {days.map((d, idx) => (
          <div key={d.id} className="flex items-center gap-2">
            <span
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium tabular-nums"
              style={{ backgroundColor: "#EEEDFE", color: "#3C3489" }}
            >
              J{idx + 1}
            </span>
            <Input
              ref={(el) => {
                if (el) inputRefs.current.set(d.id, el);
                else inputRefs.current.delete(d.id);
              }}
              name={ITINERARY_DAY_FORM_NAME}
              type="text"
              value={d.text}
              onChange={(e) => updateDay(d.id, e.target.value)}
              placeholder="Programme de la journée…"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeDay(d.id)}
              disabled={days.length === 1}
              className="shrink-0 size-9 rounded-md text-sand-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center"
              aria-label={`Supprimer la journée ${idx + 1}`}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addDay}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border-2 border-dashed border-sand-300 text-sm text-sand-700 hover:border-sand-400 hover:bg-sand-50 hover:text-ink transition"
      >
        <Plus className="size-4" /> Ajouter une journée
      </button>
    </div>
  );
}
