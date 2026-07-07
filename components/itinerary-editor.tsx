"use client";

import { useState } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { ItineraryDay } from "@/lib/types";

type Props = { name: string; defaultValue?: ItineraryDay[] | null };

export function ItineraryEditor({ name, defaultValue }: Props) {
  const [days, setDays] = useState<ItineraryDay[]>(defaultValue || []);

  function addDay() {
    setDays([...days, { day: days.length + 1, title: "", description: "" }]);
  }
  function removeDay(index: number) {
    setDays(days.filter((_, i) => i !== index).map((d, i) => ({ ...d, day: i + 1 })));
  }
  function updateDay(index: number, field: "title" | "description", value: string) {
    setDays(days.map((d, i) => i === index ? { ...d, [field]: value } : d));
  }
  function moveDay(index: number, direction: -1 | 1) {
    const newDays = [...days];
    const target = index + direction;
    if (target < 0 || target >= newDays.length) return;
    [newDays[index], newDays[target]] = [newDays[target], newDays[index]];
    setDays(newDays.map((d, i) => ({ ...d, day: i + 1 })));
  }

  return (
    <div>
      <Label>Étapes détaillées (titre + description par jour)</Label>
      <input type="hidden" name={name} value={days.length > 0 ? JSON.stringify(days) : ""} />

      {days.length > 0 ? (
        <div className="space-y-3 mb-3">
          {days.map((d, i) => (
            <div key={i} className="border border-sand-200 rounded-md p-3 bg-sand-50">
              <div className="flex items-start gap-3">
                <div className="shrink-0 size-8 rounded-full bg-terracotta-100 text-terracotta-700 flex items-center justify-center font-display text-sm font-medium">{d.day}</div>
                <div className="flex-1 space-y-2">
                  <Input placeholder="Titre de la journée (ex: Arrivée à Tafraout)" value={d.title} onChange={(e) => updateDay(i, "title", e.target.value)} />
                  <Textarea rows={2} placeholder="Description détaillée du programme" value={d.description} onChange={(e) => updateDay(i, "description", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button type="button" onClick={() => moveDay(i, -1)} disabled={i === 0} className="size-7 rounded border border-sand-300 hover:bg-sand-100 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center" title="Monter"><ArrowUp className="size-3" /></button>
                  <button type="button" onClick={() => moveDay(i, 1)} disabled={i === days.length - 1} className="size-7 rounded border border-sand-300 hover:bg-sand-100 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center" title="Descendre"><ArrowDown className="size-3" /></button>
                  <button type="button" onClick={() => removeDay(i)} className="size-7 rounded border border-red-200 text-red-700 hover:bg-red-50 flex items-center justify-center" title="Supprimer"><Trash2 className="size-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-sand-700 mb-3">Aucune journée définie. Idéal pour les circuits de plusieurs jours.</p>
      )}

      <Button type="button" variant="secondary" size="sm" onClick={addDay}>
        <Plus className="size-4" /> Ajouter une journée
      </Button>
    </div>
  );
}
