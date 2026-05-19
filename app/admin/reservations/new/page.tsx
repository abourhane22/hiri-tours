"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { CustomerPicker } from "@/components/customer-picker";
import { formatMAD } from "@/lib/utils";
import { ArrowLeft, Info } from "lucide-react";
import type { Circuit, Customer, CircuitSeason } from "@/lib/types";

type CircuitWithSeasons = Circuit & { circuit_seasons: CircuitSeason[] };

function findSeasonForDate(date: string, seasons: CircuitSeason[]): CircuitSeason | null {
  if (!date || !seasons) return null;
  return seasons.find((s) => date >= s.starts_on && date <= s.ends_on) || null;
}

export default function NewReservationPage() {
  const router = useRouter();
  const supabase = createClient();
  const [circuits, setCircuits] = useState<CircuitWithSeasons[]>([]);
  const [selectedCircuitId, setSelectedCircuitId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [departureDate, setDepartureDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("circuits").select("*, circuit_seasons(*)").eq("is_active", true).order("title").then(({ data }) => {
      if (data && data.length > 0) {
        setCircuits(data as CircuitWithSeasons[]);
        setSelectedCircuitId(data[0].id);
      }
    });
  }, []);

  const selectedCircuit = circuits.find((c) => c.id === selectedCircuitId);
  const matchingSeason = useMemo(
    () => selectedCircuit && departureDate ? findSeasonForDate(departureDate, selectedCircuit.circuit_seasons || []) : null,
    [selectedCircuit, departureDate]
  );

  const multiplier = matchingSeason ? Number(matchingSeason.price_multiplier) : 1;
  const baseAdult = selectedCircuit ? Number(selectedCircuit.base_price_mad) : 0;
  const baseChild = selectedCircuit ? Number(selectedCircuit.child_price_mad ?? selectedCircuit.base_price_mad) : 0;
  const effectiveAdult = baseAdult * multiplier;
  const effectiveChild = baseChild * multiplier;
  const total = adults * effectiveAdult + children * effectiveChild;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedCustomer) { setError("Veuillez sélectionner ou créer un client."); return; }
    setSubmitting(true); setError(null);
    const formData = new FormData(e.currentTarget);
    const payload = {
      circuit_id: selectedCircuitId,
      customer_id: selectedCustomer.id,
      departure_date: formData.get("departure_date") as string,
      adults, children,
      total_amount_mad: total,
      status: formData.get("status") as string,
      notes: (formData.get("notes") as string) || null,
    };
    const { data, error: insErr } = await supabase.from("reservations").insert(payload).select("reference").single();
    if (insErr) { setError(insErr.message); setSubmitting(false); return; }
    router.push(`/admin/reservations?created=${data?.reference}`);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/admin/reservations" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour aux réservations
      </Link>
      <div className="mb-8">
        <p className="eyebrow mb-2">Module 1 — Réservations</p>
        <h1 className="font-display text-3xl text-ink">Nouvelle réservation</h1>
        <p className="text-sand-700 mt-2">Créer manuellement un dossier (téléphone, walk-in, WhatsApp...).</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white border border-sand-200 rounded-lg p-6 space-y-5">
        <div>
          <Label>Client</Label>
          <CustomerPicker selectedCustomer={selectedCustomer} onSelect={setSelectedCustomer} />
        </div>

        <div className="pt-4 border-t border-sand-200">
          <Label htmlFor="circuit_id">Circuit / Prestation</Label>
          <Select id="circuit_id" value={selectedCircuitId} onChange={(e) => setSelectedCircuitId(e.target.value)} required>
            {circuits.length === 0 && <option value="">Chargement…</option>}
            {circuits.map((c) => <option key={c.id} value={c.id}>{c.title} — {formatMAD(c.base_price_mad)}/adulte</option>)}
          </Select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="departure_date">Date de départ</Label>
            <Input id="departure_date" name="departure_date" type="date" required min={new Date().toISOString().split("T")[0]} value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="status">Statut initial</Label>
            <Select id="status" name="status" defaultValue="pending" required>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmée</option>
              <option value="paid">Payée</option>
            </Select>
          </div>
        </div>

        {matchingSeason && (
          <div className="p-3 rounded-md bg-atlantic-50 border border-atlantic-200 text-sm text-atlantic-900 flex items-start gap-2">
            <Info className="size-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Tarif saisonnier appliqué : {matchingSeason.name}</div>
              <div className="text-xs">Multiplicateur ×{Number(matchingSeason.price_multiplier).toFixed(2)} ({Math.round((Number(matchingSeason.price_multiplier) - 1) * 100) >= 0 ? "+" : ""}{Math.round((Number(matchingSeason.price_multiplier) - 1) * 100)}%)</div>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="adults">Adultes</Label>
            <Input id="adults" type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value, 10) || 1))} required />
          </div>
          <div>
            <Label htmlFor="children">Enfants</Label>
            <Input id="children" type="number" min={0} value={children} onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value, 10) || 0))} />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes internes</Label>
          <Textarea id="notes" name="notes" rows={3} />
        </div>

        <div className="pt-4 border-t border-sand-200 flex items-center justify-between bg-sand-50 -mx-6 -mb-1 px-6 py-4">
          <div>
            <div className="text-xs text-sand-600 uppercase tracking-wide">Total</div>
            <div className="font-display text-3xl text-terracotta-600 tabular-nums">{formatMAD(total)}</div>
          </div>
          {selectedCircuit && (
            <div className="text-xs text-sand-700 text-right tabular-nums">
              {adults} × {formatMAD(effectiveAdult)}
              {children > 0 && <><br />{children} × {formatMAD(effectiveChild)}</>}
              {matchingSeason && <div className="text-atlantic-700 mt-1">(saisonnier ×{Number(matchingSeason.price_multiplier).toFixed(2)})</div>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/admin/reservations"><Button type="button" variant="secondary" disabled={submitting}>Annuler</Button></Link>
          <Button type="submit" disabled={submitting || !selectedCustomer || !selectedCircuit}>{submitting ? "Création…" : "Créer la réservation"}</Button>
        </div>
      </form>
    </div>
  );
}
