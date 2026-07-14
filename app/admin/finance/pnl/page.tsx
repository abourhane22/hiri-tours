import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { computePnL, getMonthRange } from "@/lib/finance";
import { formatMAD } from "@/lib/utils";
import { VoucherPrintButton } from "@/components/voucher-print-button";

export default async function PnLPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const range = getMonthRange(month);
  const supabase = await createClient();

  const [resRes, expRes, catRes] = await Promise.all([
    supabase.from("reservations").select("id, status, total_amount_mad, departure_date").gte("departure_date", range.start).lte("departure_date", range.end),
    supabase.from("expenses").select("id, expense_date, amount_mad, category_id").gte("expense_date", range.start).lte("expense_date", range.end),
    supabase.from("cost_categories").select("id, name, type"),
  ]);

  const pnl = computePnL({
    reservations: (resRes.data || []) as any[],
    expenses: (expRes.data || []) as any[],
    categories: (catRes.data || []) as any[],
    start: range.start,
    end: range.end,
    label: range.label,
  });

  const currentMonth = month ?? new Date().toISOString().slice(0, 7);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-start mb-8 print:hidden">
        <div>
          <Link href="/admin/finance" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-2">
            <ArrowLeft className="size-4" /> Finance
          </Link>
          <p className="eyebrow mb-2">États financiers</p>
          <h1 className="font-display text-3xl text-ink">P&amp;L mensuel</h1>
          <p className="text-sm text-sand-700 mt-1">{range.label}</p>
        </div>
        <div className="flex items-end gap-2">
          <form method="get" className="flex items-end gap-2">
            <Input name="month" type="month" defaultValue={currentMonth} />
            <Button type="submit">Voir</Button>
          </form>
          <VoucherPrintButton />
        </div>
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="font-display text-2xl text-ink">Hiri Tours — Compte de résultat</h1>
        <p className="text-xs text-sand-700">{range.label} · Édité le {new Date().toLocaleDateString("fr-FR")} · <span className="text-sand-500">by Bright Strategy</span></p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Revenu" value={formatMAD(pnl.revenue)} sub={`${pnl.reservationCount} départ(s)`} tone="info" />
        <KpiCard label="Coûts directs" value={formatMAD(pnl.directCosts)} sub={`${pnl.grossMarginRate.toFixed(0)}% marge brute`} tone="warning" />
        <KpiCard label="Frais généraux" value={formatMAD(pnl.overheadCosts)} sub="Overhead" tone="warning" />
        <KpiCard label="Marge nette" value={formatMAD(pnl.netMargin)} sub={`${pnl.netMarginRate.toFixed(0)}%`} tone={pnl.netMargin >= 0 ? "success" : "danger"} />
      </div>

      <Card className="mb-6">
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Synthèse</h2>
        </div>
        <CardBody>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-sand-200">
                <td className="py-2 font-medium">Revenu (réservations payées avec départ dans le mois)</td>
                <td className="py-2 text-right tabular-nums font-medium">{formatMAD(pnl.revenue)}</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-sand-700">− Coûts directs</td>
                <td className="py-2 text-right tabular-nums text-red-700">−{formatMAD(pnl.directCosts)}</td>
              </tr>
              <tr className="border-b-2 border-sand-300 bg-sand-50">
                <td className="py-2 px-1 font-medium">= Marge brute</td>
                <td className="py-2 px-1 text-right tabular-nums font-medium">
                  {formatMAD(pnl.grossMargin)} <span className="text-xs text-sand-600">({pnl.grossMarginRate.toFixed(0)}%)</span>
                </td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-sand-700">− Frais généraux</td>
                <td className="py-2 text-right tabular-nums text-red-700">−{formatMAD(pnl.overheadCosts)}</td>
              </tr>
              <tr className="border-t-2 border-sand-300 bg-sand-100">
                <td className="py-3 px-1 font-display text-lg">Marge nette</td>
                <td className={`py-3 px-1 text-right tabular-nums font-display text-lg ${pnl.netMargin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {formatMAD(pnl.netMargin)} <span className="text-xs">({pnl.netMarginRate.toFixed(0)}%)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Dépenses par catégorie</h2>
        </div>
        {pnl.expensesByCategory.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-sand-50 border-b border-sand-200">
              <tr>
                <th className="text-left px-5 py-2 font-medium text-sand-800">Catégorie</th>
                <th className="text-left px-5 py-2 font-medium text-sand-800">Type</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Montant</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">% du total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {pnl.expensesByCategory.map((c) => (
                <tr key={c.categoryId} className="hover:bg-sand-50">
                  <td className="px-5 py-3 text-ink">{c.categoryName}</td>
                  <td className="px-5 py-3 text-xs text-sand-700">{c.type === "direct" ? "Direct" : "Overhead"}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatMAD(c.amount)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-sand-600">
                    {pnl.totalCosts > 0 ? ((c.amount / pnl.totalCosts) * 100).toFixed(0) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <CardBody><p className="text-sm text-sand-700 text-center py-2">Aucune dépense enregistrée sur ce mois.</p></CardBody>
        )}
      </Card>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "info" | "warning" | "success" | "danger" }) {
  const valueColor = tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : "text-ink";
  return (
    <div className="bg-white border border-sand-200 rounded-lg p-5">
      <div className="text-xs uppercase tracking-wide text-sand-600 mb-2">{label}</div>
      <div className={`font-display text-2xl tabular-nums ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-sand-600 mt-1">{sub}</div>}
    </div>
  );
}
