import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { computeCircuitProfitability } from "@/lib/finance";
import { formatMAD } from "@/lib/utils";

export default async function RentabilitePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const now = new Date();
  let start: string | undefined, end: string | undefined, label: string;

  if (period === "ytd") {
    start = `${now.getFullYear()}-01-01`;
    end = now.toISOString().split("T")[0];
    label = `Année ${now.getFullYear()}`;
  } else if (period === "all") {
    label = "Cumulé depuis le début";
  } else {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 12);
    start = d.toISOString().split("T")[0];
    end = now.toISOString().split("T")[0];
    label = "12 derniers mois";
  }

  const supabase = await createClient();
  let resQ = supabase.from("reservations").select("id, status, total_amount_mad, departure_date, circuit_id");
  let expQ = supabase.from("expenses").select("id, expense_date, amount_mad, reservation_id, circuit_id");
  if (start && end) {
    resQ = resQ.gte("departure_date", start).lte("departure_date", end);
    expQ = expQ.gte("expense_date", start).lte("expense_date", end);
  }
  const [resRes, expRes, circuitsRes] = await Promise.all([resQ, expQ, supabase.from("circuits").select("id, title").eq("is_active", true)]);

  const data = computeCircuitProfitability({
    reservations: (resRes.data || []) as any[],
    expenses: (expRes.data || []) as any[],
    circuits: (circuitsRes.data || []) as any[],
    start,
    end,
  });

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalCosts = data.reduce((s, d) => s + d.directCosts, 0);
  const totalMargin = totalRevenue - totalCosts;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/admin/finance" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Finance
      </Link>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">États financiers</p>
          <h1 className="font-display text-3xl text-ink">Rentabilité par circuit</h1>
          <p className="text-sm text-sand-700 mt-1">{label}</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <Select name="period" defaultValue={period || "12m"}>
            <option value="12m">12 derniers mois</option>
            <option value="ytd">Année en cours</option>
            <option value="all">Cumulé depuis le début</option>
          </Select>
          <Button type="submit">Appliquer</Button>
        </form>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-sand-200 rounded-lg p-5">
          <div className="text-xs uppercase tracking-wide text-sand-600 mb-2">Revenu total</div>
          <div className="font-display text-2xl text-ink tabular-nums">{formatMAD(totalRevenue)}</div>
        </div>
        <div className="bg-white border border-sand-200 rounded-lg p-5">
          <div className="text-xs uppercase tracking-wide text-sand-600 mb-2">Coûts directs alloués</div>
          <div className="font-display text-2xl text-amber-700 tabular-nums">{formatMAD(totalCosts)}</div>
        </div>
        <div className="bg-white border border-sand-200 rounded-lg p-5">
          <div className="text-xs uppercase tracking-wide text-sand-600 mb-2">Marge cumulée</div>
          <div className={`font-display text-2xl tabular-nums ${totalMargin >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatMAD(totalMargin)}</div>
        </div>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Détail par circuit</h2>
          <p className="text-xs text-sand-700 mt-1">Seuls les coûts directs liés à un circuit ou à une de ses réservations sont alloués. Les frais généraux ne sont pas répartis.</p>
        </div>
        {data.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-sand-50 border-b border-sand-200">
              <tr>
                <th className="text-left px-5 py-2 font-medium text-sand-800">Circuit</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Réservations</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Revenu</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Coûts directs</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Marge</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">% marge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {data.map((d) => (
                <tr key={d.circuitId} className="hover:bg-sand-50">
                  <td className="px-5 py-3 text-ink">{d.circuitTitle}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{d.reservationCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatMAD(d.revenue)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-amber-700">{formatMAD(d.directCosts)}</td>
                  <td className={`px-5 py-3 text-right tabular-nums font-medium ${d.margin >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatMAD(d.margin)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-sand-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${d.marginRate > 30 ? "bg-emerald-600" : d.marginRate > 10 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, Math.max(0, d.marginRate))}%` }}
                        />
                      </div>
                      <span className="w-12 text-right">{d.marginRate.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <CardBody><p className="text-sm text-sand-700 text-center py-4">Aucune donnée sur cette période.</p></CardBody>
        )}
      </Card>
    </div>
  );
}
