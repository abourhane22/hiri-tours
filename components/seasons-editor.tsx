"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { createSeason, deleteSeason } from "@/app/admin/circuits/actions";
import { formatDateShort } from "@/lib/utils";
import type { CircuitSeason } from "@/lib/types";

type Props = { circuitId: string; seasons: CircuitSeason[] };

export function SeasonsEditor({ circuitId, seasons }: Props) {
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(formData: FormData) {
    setSubmitting(true); setError(null);
    try {
      await createSeason(circuitId, formData);
      setAdding(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(seasonId: string) {
    if (!confirm("Supprimer cette saison ?")) return;
    try {
      await deleteSeason(circuitId, seasonId);
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="space-y-4">
      {seasons.length > 0 ? (
        <div className="space-y-2">
          {seasons.map((s) => {
            const pct = Math.round((s.price_multiplier - 1) * 100);
            const pctLabel = pct >= 0 ? `+${pct}%` : `${pct}%`;
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 bg-sand-50 border border-sand-200 rounded-md">
                <div className="flex-1 min-w-0">
                  <div className="text-ink font-medium">{s.name}</div>
                  <div className="text-xs text-sand-600">Du {formatDateShort(s.starts_on)} au {formatDateShort(s.ends_on)} · ×{Number(s.price_multiplier).toFixed(2)} <span className={pct >= 0 ? "text-emerald-700" : "text-atlantic-700"}>({pctLabel})</span></div>
                </div>
                <button type="button" onClick={() => handleDelete(s.id)} className="size-8 rounded border border-red-200 text-red-700 hover:bg-red-50 flex items-center justify-center" title="Supprimer">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-sand-700">Aucune période saisonnière définie. Le tarif de base s&apos;applique toute l&apos;année.</p>
      )}

      {adding ? (
        <form action={handleAdd} className="border border-sand-200 rounded-md p-4 bg-sand-50 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-ink">Nouvelle période</p>
            <button type="button" onClick={() => { setAdding(false); setError(null); }} className="text-xs text-sand-700 hover:text-ink">Annuler</button>
          </div>
          {error && <div className="p-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded">{error}</div>}
          <div>
            <Label htmlFor="name">Nom de la période *</Label>
            <Input id="name" name="name" required placeholder="Haute saison été, Ramadan, Fêtes..." />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="starts_on">Date de début *</Label>
              <Input id="starts_on" name="starts_on" type="date" required />
            </div>
            <div>
              <Label htmlFor="ends_on">Date de fin *</Label>
              <Input id="ends_on" name="ends_on" type="date" required />
            </div>
          </div>
          <div>
            <Label htmlFor="price_multiplier">Multiplicateur de prix *</Label>
            <Input id="price_multiplier" name="price_multiplier" type="number" step="0.01" min="0.1" defaultValue="1.5" required />
            <p className="text-xs text-sand-600 mt-1">Ex : 1.5 pour +50%, 0.8 pour -20%, 1.0 pour pas de changement</p>
          </div>
          <Button type="submit" size="sm" disabled={submitting}>{submitting ? "Création..." : "Créer la période"}</Button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-terracotta-600 hover:bg-sand-100 rounded-md border border-dashed border-sand-300">
          <Plus className="size-4" /> Ajouter une période saisonnière
        </button>
      )}
    </div>
  );
}
