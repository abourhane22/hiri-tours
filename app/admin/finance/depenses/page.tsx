import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, ArrowLeft } from "lucide-react";
import { formatMAD, formatDateShort } from "@/lib/utils";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export default async function DepensesPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; type?: string }> }) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month !== undefined ? parseInt(params.month, 10) : now.getMonth();
  const typeFilter = params.type || "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;

  const { data: categories } = await supabase
    .from("cost_categories")
    .select("id, name, type, sort_order")
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true });

  const { data: rawExpenses } = await supabase
    .from("expenses")
    .select(`id, expense_date, amount_mad, description, notes, category_id,
             vehicle:vehicles(registration, make, model),
             reservation:reservations(reference),
             circuit:circuits(title)`)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate)
    .order("expense_date", { ascending: false });

  const cats = categories || [];
  const expenses = rawExpenses || [];

  const filteredCats = typeFilter === "all" ? cats : cats.filter(c => c.type === typeFilter);
  const allowedCatIds = new Set(filteredCats.map(c => c.id));
  const filteredExpenses = typeFilter === "all" ? expenses : expenses.filter(e => allowedCatIds.has(e.category_id));

  const byCategory: Record<string, typeof filteredExpenses> = {};
  for (const e of filteredExpenses) {
    if (!byCategory[e.category_id]) byCategory[e.category_id] = [];
    byCategory[e.category_id].push(e);
  }

  const grandTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount_mad), 0);
  const directTotal = expenses.filter(e => cats.find(c => c.id === e.category_id)?.type === "direct").reduce((s, e) => s + Number(e.amount_mad), 0);
  const overheadTotal = expenses.filter(e => cats.find(c => c.id === e.category_id)?.type === "overhead").reduce((s, e) => s + Number(e.amount_mad), 0);

  const buildLink = (overrides: Record<string, any>) => {
    const sp = new URLSearchParams();
    const merged = { year, month, type: typeFilter, ...overrides };
    if (merged.year !== now.getFullYear()) sp.set("year", String(merged.year));
    if (merged.month !== now.getMonth()) sp.set("month", String(merged.month));
    if (merged.type && merged.type !== "all") sp.set("type", merged.type);
    const s = sp.toString();
    return s ? `?${s}` : "/admin/finance/depenses";
  };

  const prevMonth = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextMonth = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/admin/finance" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour à Finance
      </Link>

      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">Finance</p>
          <h1 className="font-display text-3xl text-ink">Dépenses</h1>
          <p className="text-sm text-sand-700 mt-1">{MONTHS[month]} {year} · {filteredExpenses.length} ligne{filteredExpenses.length > 1 ? "s" : ""}</p>
        </div>
        <Link href="/admin/finance/depenses/new"><Button><Plus className="size-4" />Nouvelle dépense</Button></Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <div className="px-4 py-3">
            <div className="text-xs text-sand-700 uppercase tracking-wider">Total mois</div>
            <div className="font-display text-2xl text-ink tabular-nums mt-1">{formatMAD(grandTotal)}</div>
          </div>
        </Card>
        <Card>
          <div className="px-4 py-3">
            <div className="text-xs text-sand-700 uppercase tracking-wider">Coûts directs</div>
            <div className="font-display text-2xl text-atlantic-700 tabular-nums mt-1">{formatMAD(directTotal)}</div>
          </div>
        </Card>
        <Card>
          <div className="px-4 py-3">
            <div className="text-xs text-sand-700 uppercase tracking-wider">Charges overhead</div>
            <div className="font-display text-2xl text-amber-700 tabular-nums mt-1">{formatMAD(overheadTotal)}</div>
          </div>
        </Card>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg p-3 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link href={buildLink({ year: prevMonth.y, month: prevMonth.m })}
            className="size-8 inline-flex items-center justify-center rounded border border-sand-300 hover:bg-sand-50 text-sm">‹</Link>
          <div className="font-medium text-sm min-w-[140px] text-center">{MONTHS[month]} {year}</div>
          <Link href={buildLink({ year: nextMonth.y, month: nextMonth.m })}
            className="size-8 inline-flex items-center justify-center rounded border border-sand-300 hover:bg-sand-50 text-sm">›</Link>
        </div>

        <div className="inline-flex gap-0.5 bg-sand-100 p-0.5 rounded-md">
          {[
            { v: "all",      l: "Tous" },
            { v: "direct",   l: "Coûts directs" },
            { v: "overhead", l: "Overhead" },
          ].map(opt => (
            <Link key={opt.v} href={buildLink({ type: opt.v })}
              className={`px-3 py-1 text-sm rounded transition ${typeFilter === opt.v ? "bg-white shadow-sm font-medium text-ink" : "text-sand-700 hover:text-ink"}`}>
              {opt.l}
            </Link>
          ))}
        </div>
      </div>

      {filteredExpenses.length === 0 ? (
        <Card><div className="p-8 text-center text-sand-700">Aucune dépense pour cette période.</div></Card>
      ) : (
        filteredCats
          .filter(cat => (byCategory[cat.id]?.length || 0) > 0)
          .map(cat => {
            const list = byCategory[cat.id];
            const catTotal = list.reduce((s, e) => s + Number(e.amount_mad), 0);
            const isDirect = cat.type === "direct";
            return (
              <details key={cat.id} open
                className="bg-white border border-sand-200 rounded-lg mb-3 overflow-hidden group [&_summary::-webkit-details-marker]:hidden">
                <summary className="px-4 py-3 bg-sand-50 cursor-pointer flex items-center justify-between hover:bg-sand-100 list-none">
                  <div className="flex items-center gap-3 flex-wrap">
                    <ChevronRight className="size-4 text-sand-600 transition-transform group-open:rotate-90" />
                    <h3 className="font-display text-base text-ink m-0">{cat.name}</h3>
                    <span className={`text-[10px] uppercase font-medium px-1.5 py-0.5 rounded ${isDirect ? "bg-atlantic-50 text-atlantic-800" : "bg-amber-50 text-amber-800"}`}>
                      {isDirect ? "Direct" : "Overhead"}
                    </span>
                    <span className="text-xs text-sand-700">{list.length} ligne{list.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="text-sm font-medium text-ink tabular-nums">{formatMAD(catTotal)}</div>
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-sand-50/50 border-y border-sand-200">
                      <tr>
                        <th className="text-left px-4 py-2 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Date</th>
                        <th className="text-left px-3 py-2 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Description</th>
                        <th className="text-left px-3 py-2 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Lié à</th>
                        <th className="text-right px-4 py-2 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(e => {
                        const v = e.vehicle as any;
                        const r = e.reservation as any;
                        const ci = e.circuit as any;
                        const linkLabel = v ? `${v.make} ${v.model} · ${v.registration}` : r ? r.reference : ci ? ci.title : "—";
                        return (
                          <tr key={e.id} className="border-t border-sand-100 hover:bg-sand-50/50">
                            <td className="px-4 py-2.5 text-sand-800 whitespace-nowrap">
                              <Link href={`/admin/finance/depenses/${e.id}`} className="hover:text-terracotta-700">{formatDateShort(e.expense_date)}</Link>
                            </td>
                            <td className="px-3 py-2.5 text-ink">
                              <Link href={`/admin/finance/depenses/${e.id}`} className="hover:text-terracotta-700">{e.description || "—"}</Link>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-sand-700">{linkLabel}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatMAD(e.amount_mad)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })
      )}
    </div>
  );
}
