import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ArrowLeft, Plus, Search, X } from "lucide-react";
import { formatMAD, formatDateShort } from "@/lib/utils";
import { getMonthRange } from "@/lib/finance";

export default async function DepensesPage({ searchParams }: { searchParams: Promise<{ month?: string; category?: string; type?: string }> }) {
  const { month, category, type } = await searchParams;
  const range = getMonthRange(month);
  const supabase = await createClient();

  const [expensesRes, categoriesRes] = await Promise.all([
    supabase.from("expenses")
      .select("*, cost_categories(name, type), reservations(reference), circuits(title), vehicles(registration)")
      .gte("expense_date", range.start)
      .lte("expense_date", range.end)
      .order("expense_date", { ascending: false }),
    supabase.from("cost_categories").select("*").eq("is_active", true).order("sort_order"),
  ]);

  let expenses = (expensesRes.data || []) as any[];
  if (category) expenses = expenses.filter((e) => e.category_id === category);
  if (type) expenses = expenses.filter((e) => e.cost_categories?.type === type);

  const total = expenses.reduce((s, e) => s + Number(e.amount_mad), 0);
  const categories = (categoriesRes.data || []) as any[];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin/finance" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Finance
      </Link>

      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">États financiers</p>
          <h1 className="font-display text-3xl text-ink">Dépenses</h1>
          <p className="text-sm text-sand-700 mt-1">{range.label} · Total filtré : <span className="font-medium text-ink">{formatMAD(total)}</span></p>
        </div>
        <Link href="/admin/finance/depenses/new"><Button><Plus className="size-4" />Nouvelle dépense</Button></Link>
      </div>

      <form method="get" className="bg-white border border-sand-200 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs uppercase tracking-wide text-sand-600 mb-1">Mois</label>
          <Input name="month" type="month" defaultValue={month ?? new Date().toISOString().slice(0, 7)} />
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs uppercase tracking-wide text-sand-600 mb-1">Catégorie</label>
          <Select name="category" defaultValue={category || ""}>
            <option value="">Toutes</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs uppercase tracking-wide text-sand-600 mb-1">Type</label>
          <Select name="type" defaultValue={type || ""}>
            <option value="">Tous</option>
            <option value="direct">Coûts directs</option>
            <option value="overhead">Frais généraux</option>
          </Select>
        </div>
        <Button type="submit"><Search className="size-3.5" />Filtrer</Button>
        <Link href="/admin/finance/depenses"><Button type="button" variant="secondary"><X className="size-3.5" />Reset</Button></Link>
      </form>

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Date</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Catégorie</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Description</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Lien</th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {expenses.length > 0 ? expenses.map((e) => (
              <tr key={e.id} className="hover:bg-sand-50">
                <td className="px-5 py-3 text-sand-800 tabular-nums">{formatDateShort(e.expense_date)}</td>
                <td className="px-5 py-3">
                  <Link href={`/admin/finance/depenses/${e.id}`} className="text-terracotta-600 hover:underline font-medium">{e.cost_categories?.name}</Link>
                  <div className="mt-0.5"><Badge tone={e.cost_categories?.type === "direct" ? "info" : "neutral"}>{e.cost_categories?.type === "direct" ? "Direct" : "Overhead"}</Badge></div>
                </td>
                <td className="px-5 py-3 text-sand-800">{e.description || <span className="text-sand-500">—</span>}</td>
                <td className="px-5 py-3 text-xs text-sand-700 space-y-0.5">
                  {e.reservations && <div>📋 {e.reservations.reference}</div>}
                  {e.circuits && <div>🗺 {e.circuits.title}</div>}
                  {e.vehicles && <div>🚐 {e.vehicles.registration}</div>}
                  {!e.reservations && !e.circuits && !e.vehicles && <span className="text-sand-500">—</span>}
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-medium">{formatMAD(e.amount_mad)}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-sand-700">Aucune dépense sur cette période.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
