import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { ArrowLeft, Trash2 } from "lucide-react";
import { updateExpense, deleteExpense } from "../actions";
import type { Expense } from "@/lib/types";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [expRes, catRes, circuitsRes, vehiclesRes, reservationsRes] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", id).single(),
    supabase.from("cost_categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("circuits").select("id, title").eq("is_active", true).order("title"),
    supabase.from("vehicles").select("id, registration, make, model").eq("is_active", true).order("registration"),
    supabase.from("reservations").select("id, reference, departure_date, circuits(title)").order("departure_date", { ascending: false }).limit(80),
  ]);

  if (!expRes.data) notFound();
  const e = expRes.data as Expense;
  const categories = (catRes.data || []) as any[];
  const updateBound = updateExpense.bind(null, id);
  const deleteBound = deleteExpense.bind(null, id);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/admin/finance/depenses" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour aux dépenses
      </Link>
      <div className="mb-8">
        <p className="eyebrow mb-2">États financiers</p>
        <h1 className="font-display text-3xl text-ink">Modifier la dépense</h1>
      </div>

      <form action={updateBound} className="bg-white border border-sand-200 rounded-lg p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label htmlFor="expense_date">Date *</Label><Input id="expense_date" name="expense_date" type="date" required defaultValue={e.expense_date} /></div>
          <div><Label htmlFor="amount_mad">Montant (MAD) *</Label><Input id="amount_mad" name="amount_mad" type="number" min="0" step="0.01" required defaultValue={String(e.amount_mad)} /></div>
        </div>
        <div>
          <Label htmlFor="category_id">Catégorie *</Label>
          <Select id="category_id" name="category_id" required defaultValue={e.category_id}>
            <optgroup label="Coûts directs">
              {categories.filter((c) => c.type === "direct").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
            <optgroup label="Frais généraux">
              {categories.filter((c) => c.type === "overhead").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          </Select>
        </div>
        <div><Label htmlFor="description">Description</Label><Input id="description" name="description" defaultValue={e.description ?? ""} /></div>

        <div className="pt-3 border-t border-sand-200 space-y-4">
          <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">Lier à un élément (optionnel)</p>
          <div>
            <Label htmlFor="reservation_id">Réservation</Label>
            <Select id="reservation_id" name="reservation_id" defaultValue={e.reservation_id ?? ""}>
              <option value="">— Aucune —</option>
              {((reservationsRes.data || []) as any[]).map((r) => <option key={r.id} value={r.id}>{r.reference} · {(r.circuits as any)?.title} · {r.departure_date}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="circuit_id">Circuit</Label>
            <Select id="circuit_id" name="circuit_id" defaultValue={e.circuit_id ?? ""}>
              <option value="">— Aucun —</option>
              {((circuitsRes.data || []) as any[]).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="vehicle_id">Véhicule</Label>
            <Select id="vehicle_id" name="vehicle_id" defaultValue={e.vehicle_id ?? ""}>
              <option value="">— Aucun —</option>
              {((vehiclesRes.data || []) as any[]).map((v) => <option key={v.id} value={v.id}>{v.registration}{v.make ? ` · ${v.make} ${v.model || ""}` : ""}</option>)}
            </Select>
          </div>
        </div>

        <div><Label htmlFor="notes">Notes internes</Label><Textarea id="notes" name="notes" rows={2} defaultValue={e.notes ?? ""} /></div>

        <div className="flex justify-end gap-3 pt-3 border-t border-sand-200">
          <Link href="/admin/finance/depenses"><Button type="button" variant="secondary">Annuler</Button></Link>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>

      <form action={deleteBound} className="mt-6">
        <Card className="border-red-200">
          <div className="px-5 py-4 border-b border-red-200 bg-red-50">
            <h2 className="font-display text-lg text-red-900">Zone de danger</h2>
          </div>
          <CardBody>
            <p className="text-sm text-sand-800 mb-4">Suppression définitive de cette dépense.</p>
            <Button type="submit" variant="danger" size="sm"><Trash2 className="size-3.5" />Supprimer</Button>
          </CardBody>
        </Card>
      </form>
    </div>
  );
}
