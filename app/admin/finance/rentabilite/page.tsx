import Link from "next/link";
import { ReportTabs } from "@/components/report-tabs";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info } from "lucide-react";
import { computeCircuitProfitability } from "@/lib/finance";
import { margin, variance, marginTone, varianceTone, formatPct, MARGIN_TONE_STYLE, COST_SOURCE_LABEL, type CostSnapshot } from "@/lib/margin";
import { formatMAD, formatDateShort } from "@/lib/utils";
import { ComputeMissingCostsButton } from "@/components/finance/compute-missing-costs-button";

// Rentabilité : marge PRÉVISIONNELLE (coût figé à la vente) vs marge RÉELLE
// (dépenses rattachées). Tous les calculs passent par lib/margin.ts.
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
  let resQ = supabase
    .from("reservations")
    .select("id, reference, status, total_amount_mad, departure_date, circuit_id, expected_cost_mad, cost_snapshot, circuits(title)")
    .neq("status", "cancelled")
    .order("departure_date", { ascending: false });
  let expQ = supabase.from("expenses").select("id, expense_date, amount_mad, reservation_id, circuit_id");
  if (start && end) {
    resQ = resQ.gte("departure_date", start).lte("departure_date", end);
    expQ = expQ.gte("expense_date", start).lte("expense_date", end);
  }
  const [resRes, expRes, circuitsRes] = await Promise.all([resQ, expQ, supabase.from("circuits").select("id, title").eq("is_active", true)]);
  const reservations = (resRes.data || []) as any[];
  const expenses = (expRes.data || []) as any[];

  const data = computeCircuitProfitability({ reservations, expenses, circuits: (circuitsRes.data || []) as any[], start, end });

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalReal = data.reduce((s, d) => s + d.directCosts, 0);
  const totalExpected = data.reduce((s, d) => s + (d.expectedCost ?? 0), 0);
  const coveredRevenue = data.reduce((s, d) => s + d.coveredRevenue, 0);
  const mExpTotal = margin(coveredRevenue, totalExpected);
  const mRealTotal = margin(totalRevenue, totalReal);
  const missingCount = reservations.filter((r) => !r.cost_snapshot && (r.status === "paid" || r.status === "completed" || r.status === "confirmed" || r.status === "pending")).length;

  // Par dossier : dossiers convertis de la période, coût réel = dépenses rattachées au dossier.
  const realByReservation = new Map<string, number>();
  for (const e of expenses) if (e.reservation_id) realByReservation.set(e.reservation_id, (realByReservation.get(e.reservation_id) ?? 0) + Number(e.amount_mad));
  const rows = reservations
    .filter((r) => r.status === "paid" || r.status === "completed")
    .slice(0, 200)
    .map((r) => {
      const sale = Number(r.total_amount_mad);
      const expected = r.expected_cost_mad === null ? null : Number(r.expected_cost_mad);
      const real = realByReservation.has(r.id) ? realByReservation.get(r.id)! : null;
      const snap = (r.cost_snapshot ?? null) as CostSnapshot | null;
      return { r, sale, expected, real, mExp: margin(sale, expected), mReal: margin(sale, real), v: variance(expected, real), source: snap?.source ?? null };
    });

  const th = "px-4 py-2 text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A]";
  const Pct = ({ pct }: { pct: number | null }) => {
    const t = MARGIN_TONE_STYLE[marginTone(pct)];
    return (
      <span className="inline-flex rounded px-1.5 py-px text-[11px] font-medium tabular-nums" style={{ backgroundColor: t.bg, color: t.color }}>
        {formatPct(pct)}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin/finance" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Finance
      </Link>
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">États financiers</p>
          <h1 className="font-display text-3xl text-ink">Rentabilité par produit</h1>
          <p className="text-sm text-sand-700 mt-1">{label} · marge prévisionnelle (coût figé à la vente) vs marge réelle (dépenses rattachées)</p>
        </div>
        <form method="get" className="flex items-end gap-2 print:hidden">
          <Select name="period" defaultValue={period || "12m"}>
            <option value="12m">12 derniers mois</option>
            <option value="ytd">Année en cours</option>
            <option value="all">Cumulé depuis le début</option>
          </Select>
          <Button type="submit">Appliquer</Button>
        </form>
      </div>

      <ReportTabs active="rentabilite" />

      {/* Synthèse période */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Kpi label="Revenu (converti)" value={formatMAD(totalRevenue)} />
        <Kpi label="Coût prévisionnel" value={formatMAD(totalExpected)} sub={`sur ${formatMAD(coveredRevenue)} de ventes renseignées`} />
        <Kpi label="Coût réel alloué" value={formatMAD(totalReal)} sub="dépenses dossier + produit" tone="#B25F0B" />
        <Kpi label="Marge prévisionnelle" value={mExpTotal.amount === null ? "—" : formatMAD(mExpTotal.amount)} sub={formatPct(mExpTotal.pct)} tone={MARGIN_TONE_STYLE[marginTone(mExpTotal.pct)].color} />
        <Kpi label="Marge réelle" value={mRealTotal.amount === null ? "—" : formatMAD(mRealTotal.amount)} sub={formatPct(mRealTotal.pct)} tone={MARGIN_TONE_STYLE[marginTone(mRealTotal.pct)].color} />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <p className="text-[12px] text-[#6B6862] flex items-start gap-1.5 max-w-2xl">
          <Info className="size-3.5 shrink-0 mt-px" />
          Le coût prévisionnel est figé au moment de la vente (tarif d&apos;achat résolu, coût interne du produit ou offre aérienne) et ne bouge qu&apos;à la demande.
          {missingCount > 0 && <> {missingCount} dossier{missingCount > 1 ? "s" : ""} de la période n&apos;ont pas de coût figé.</>}
        </p>
        <ComputeMissingCostsButton start={start} end={end} missingCount={missingCount} />
      </div>

      {/* Par produit */}
      <Card>
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Par produit</h2>
          <p className="text-xs text-sand-700 mt-1">
            Coût réel = dépenses rattachées aux dossiers du produit + dépenses rattachées au produit sur la période. Les frais généraux ne sont pas répartis.
          </p>
        </div>
        {data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FBF9F5] border-b border-sand-200">
                <tr>
                  <th className={`${th} text-left`}>Produit</th>
                  <th className={`${th} text-right`}>Dossiers</th>
                  <th className={`${th} text-right`}>Revenu</th>
                  <th className={`${th} text-right`}>Coût prév.</th>
                  <th className={`${th} text-right`}>Coût réel</th>
                  <th className={`${th} text-right`}>Marge prév.</th>
                  <th className={`${th} text-right`}>Marge réelle</th>
                  <th className={`${th} text-right`}>Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {data.map((d) => {
                  const mExp = margin(d.coveredRevenue, d.expectedCost);
                  const mReal = margin(d.revenue, d.directCosts);
                  const v = variance(d.expectedCost, d.directCosts);
                  const tv = MARGIN_TONE_STYLE[varianceTone(v)];
                  return (
                    <tr key={d.circuitId} className="hover:bg-sand-50">
                      <td className="px-4 py-3 text-ink">
                        {d.circuitTitle}
                        {d.missingCount > 0 && <span className="block text-[11px] text-[#968F84]">{d.missingCount}/{d.reservationCount} dossier{d.missingCount > 1 ? "s" : ""} sans coût figé</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{d.reservationCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMAD(d.revenue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{d.expectedCost === null ? <span className="text-[#968F84]">—</span> : formatMAD(d.expectedCost)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#B25F0B]">{formatMAD(d.directCosts)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {mExp.amount === null ? <span className="text-[#968F84]">—</span> : <div className="flex items-center justify-end gap-2"><span>{formatMAD(mExp.amount)}</span><Pct pct={mExp.pct} /></div>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-2"><span>{formatMAD(mReal.amount ?? 0)}</span><Pct pct={mReal.pct} /></div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {v.amount === null ? <span className="text-[#968F84]">—</span> : <span style={{ color: tv.color }}>{v.amount > 0 ? "+ " : ""}{formatMAD(v.amount)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <CardBody><p className="text-sm text-sand-700 text-center py-4">Aucune donnée sur cette période.</p></CardBody>
        )}
      </Card>

      {/* Par dossier */}
      <Card className="mt-6">
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Par dossier</h2>
          <p className="text-xs text-sand-700 mt-1">Dossiers convertis (payés / terminés) de la période · coût réel = dépenses explicitement rattachées au dossier{rows.length === 200 ? " · 200 plus récents" : ""}.</p>
        </div>
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FBF9F5] border-b border-sand-200">
                <tr>
                  <th className={`${th} text-left`}>Dossier</th>
                  <th className={`${th} text-left`}>Produit</th>
                  <th className={`${th} text-left`}>Départ</th>
                  <th className={`${th} text-right`}>Vente</th>
                  <th className={`${th} text-right`}>Coût prév.</th>
                  <th className={`${th} text-right`}>Coût réel</th>
                  <th className={`${th} text-right`}>Marge prév.</th>
                  <th className={`${th} text-right`}>Marge réelle</th>
                  <th className={`${th} text-right`}>Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {rows.map(({ r, sale, expected, real, mExp, mReal, v, source }) => {
                  const tv = MARGIN_TONE_STYLE[varianceTone(v)];
                  const circuit = Array.isArray(r.circuits) ? r.circuits[0] : r.circuits;
                  return (
                    <tr key={r.id} className="hover:bg-sand-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/reservations/${r.id}`} className="font-mono text-xs text-[#1A1F2E] hover:text-[#C84B31]">{r.reference}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-[#6B6862] text-xs">{circuit?.title ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[#6B6862] text-xs whitespace-nowrap">{formatDateShort(r.departure_date)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatMAD(sale)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" title={source ? COST_SOURCE_LABEL[source] : "non renseigné"}>
                        {expected === null ? <span className="text-[#968F84]">—</span> : formatMAD(expected)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{real === null ? <span className="text-[#968F84]">—</span> : <span className="text-[#B25F0B]">{formatMAD(real)}</span>}</td>
                      <td className="px-4 py-2.5 text-right"><Pct pct={mExp.pct} /></td>
                      <td className="px-4 py-2.5 text-right"><Pct pct={mReal.pct} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {v.amount === null ? <span className="text-[#968F84]">—</span> : <span style={{ color: tv.color }}>{v.amount > 0 ? "+ " : ""}{formatMAD(v.amount)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <CardBody><p className="text-sm text-sand-700 text-center py-4">Aucun dossier converti sur cette période.</p></CardBody>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
      <div className="text-[10.5px] uppercase tracking-wide text-[#968F84] mb-1.5">{label}</div>
      <div className="font-display text-[22px] tabular-nums leading-none" style={{ color: tone ?? "#1A1F2E" }}>{value}</div>
      {sub && <div className="text-[11px] text-[#6B6862] mt-1.5">{sub}</div>}
    </div>
  );
}
