import { createClient } from "@/lib/supabase/server";
import { VoucherPrintButton } from "@/components/voucher-print-button";
import { PerformanceTrendChart, type TrendPoint } from "@/components/performance-trend-chart";
import { formatMAD } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart3, Info, AlertTriangle } from "lucide-react";

const MONTHS_FR_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const SOURCE_LABELS: Record<string, string> = {
  walk_in: "Walk-in",
  phone: "Téléphone",
  whatsapp: "WhatsApp",
  email: "Email",
  website: "Site web",
  referral: "Recommandation",
  social_media: "Réseaux sociaux",
  partner: "Partenaire",
  other: "Autre",
};

const ROLE_LABELS: Record<string, string> = { guide: "Guide", driver: "Chauffeur", both: "Guide + Chauffeur" };

const SOURCE_COLORS = ["#0C6B8A", "#4C96B0", "#D98324", "#E8B36A", "#C9C4BA"];

const iso = (d: Date) => d.toISOString().split("T")[0];
const isConverted = (r: any) => r.status === "paid" || r.status === "completed";

export default async function RapportsPage() {
  const supabase = await createClient();
  const now = new Date();
  const start24 = new Date(now.getFullYear(), now.getMonth() - 23, 1); // 24 mois pour le comparatif N-1
  const twelveAgoStr = iso(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  const currentMonthStart = iso(new Date(now.getFullYear(), now.getMonth(), 1));

  const [reservationsRes, circuitsRes, staffRes, invoicesRes] = await Promise.all([
    supabase.from("reservations")
      .select("id, status, total_amount_mad, paid_amount_mad, departure_date, adults, children, circuit_id, guide_id, driver_id, circuits(title, max_participants), customers(acquisition_source)")
      .gte("departure_date", iso(start24)),
    supabase.from("circuits").select("id, title, max_participants").eq("is_active", true),
    supabase.from("staff_members").select("id, full_name, role").eq("is_active", true),
    supabase.from("invoices").select("id, issued_at").eq("status", "issued"),
  ]);

  const all = (reservationsRes.data || []) as any[]; // 24 mois
  const circuits = (circuitsRes.data || []) as any[];
  const staff = (staffRes.data || []) as any[];
  const invoices = (invoicesRes.data || []) as any[];

  // Sous-ensembles temporels
  const recent12 = all.filter((r) => r.departure_date >= twelveAgoStr);
  const prev12 = all.filter((r) => r.departure_date < twelveAgoStr);

  // Somme CA (paid/completed) sur une plage de dates
  const sumRev = (startStr: string, endStr: string) =>
    all
      .filter((r) => isConverted(r) && r.departure_date >= startStr && r.departure_date <= endStr)
      .reduce((s, r) => s + Number(r.total_amount_mad), 0);

  // Trend 12 mois (current + N-1 même mois)
  const trend: TrendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dPrev = new Date(d.getFullYear() - 1, d.getMonth(), 1);
    trend.push({
      label: MONTHS_FR_SHORT[d.getMonth()],
      current: sumRev(iso(d), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))),
      previous: sumRev(iso(dPrev), iso(new Date(dPrev.getFullYear(), dPrev.getMonth() + 1, 0))),
      isCurrent: i === 0,
    });
  }
  const chartTotal = trend.reduce((s, t) => s + t.current, 0);

  // KPI a. CA réalisé ce mois + delta N-1
  const monthRevenue = trend[11].current;
  const monthPrevRevenue = trend[11].previous;
  const yoy = monthPrevRevenue > 0 ? Math.round(((monthRevenue - monthPrevRevenue) / monthPrevRevenue) * 100) : null;
  const currentMonthName = now.toLocaleDateString("fr-FR", { month: "long" });
  const prevMonthName = new Date(now.getFullYear() - 1, now.getMonth(), 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // KPI b. Panier moyen (12 mois) + delta vs 12 mois précédents
  const conv12 = recent12.filter(isConverted);
  const ca12 = conv12.reduce((s, r) => s + Number(r.total_amount_mad), 0);
  const basket = conv12.length > 0 ? ca12 / conv12.length : 0;
  const convPrev = prev12.filter(isConverted);
  const basketPrev = convPrev.length > 0 ? convPrev.reduce((s, r) => s + Number(r.total_amount_mad), 0) / convPrev.length : 0;
  const basketDelta = basketPrev > 0 ? Math.round(((basket - basketPrev) / basketPrev) * 100) : null;

  // KPI c. Conversion (mois en cours)
  const monthActive = recent12.filter((r) => r.departure_date >= currentMonthStart && r.status !== "cancelled");
  const monthConverted = monthActive.filter(isConverted);
  const conversionRate = monthActive.length > 0 ? Math.round((monthConverted.length / monthActive.length) * 100) : 0;

  // KPI d. À encaisser (dossiers ouverts) + factures > 90 j
  const openDossiers = all.filter((r) => r.status === "pending" || r.status === "confirmed");
  const outstanding = openDossiers.reduce((s, r) => s + (Number(r.total_amount_mad) - Number(r.paid_amount_mad)), 0);
  const oldInvoicesCount = invoices.filter(
    (inv) => Math.floor((Date.now() - new Date(inv.issued_at).getTime()) / 86400000) > 90,
  ).length;

  // Top 5 circuits par CA (12 mois) + concentration
  const circuitTotals: Record<string, { title: string; revenue: number; count: number }> = {};
  conv12.forEach((r) => {
    const id = r.circuit_id;
    if (!circuitTotals[id]) circuitTotals[id] = { title: r.circuits?.title || "Sans titre", revenue: 0, count: 0 };
    circuitTotals[id].revenue += Number(r.total_amount_mad);
    circuitTotals[id].count += 1;
  });
  const topCircuits = Object.values(circuitTotals).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const topMax = topCircuits[0]?.revenue || 1;
  const topShare = ca12 > 0 && topCircuits[0] ? Math.round((topCircuits[0].revenue / ca12) * 100) : 0;

  // Sources d'acquisition (12 mois, actives)
  const sourceCounts: Record<string, number> = {};
  recent12.filter((r) => r.status !== "cancelled").forEach((r) => {
    const src = r.customers?.acquisition_source || "other";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  const sourcesTotal = Object.values(sourceCounts).reduce((s, n) => s + n, 0);
  const sources = Object.entries(sourceCounts)
    .map(([source, count]) => ({ label: SOURCE_LABELS[source] || source, count }))
    .sort((a, b) => b.count - a.count)
    .map((s, i) => ({ ...s, color: SOURCE_COLORS[i] ?? SOURCE_COLORS[SOURCE_COLORS.length - 1], pct: sourcesTotal > 0 ? Math.round((s.count / sourcesTotal) * 100) : 0 }));

  // Occupation (12 mois)
  const occupancy = circuits.map((c) => {
    const cRes = recent12.filter((r) => r.circuit_id === c.id && r.status !== "cancelled");
    const totalPax = cRes.reduce((s, r) => s + r.adults + r.children, 0);
    const avgPax = cRes.length > 0 ? totalPax / cRes.length : 0;
    const occupancyRate = (c.max_participants || 0) > 0 ? Math.round((avgPax / c.max_participants) * 100) : 0;
    return { id: c.id, title: c.title, max: c.max_participants, totalPax, reservations: cRes.length, avgPax: Math.round(avgPax * 10) / 10, occupancyRate };
  }).filter((c) => c.reservations > 0).sort((a, b) => b.occupancyRate - a.occupancyRate);

  // Performance équipe (12 mois)
  const staffStats: Record<string, { id: string; name: string; role: string; guideCount: number; driverCount: number }> = {};
  staff.forEach((s) => { staffStats[s.id] = { id: s.id, name: s.full_name, role: s.role, guideCount: 0, driverCount: 0 }; });
  recent12.filter((r) => r.status !== "cancelled").forEach((r) => {
    if (r.guide_id && staffStats[r.guide_id]) staffStats[r.guide_id].guideCount += 1;
    if (r.driver_id && staffStats[r.driver_id]) staffStats[r.driver_id].driverCount += 1;
  });
  const topStaff = Object.values(staffStats)
    .filter((s) => s.guideCount + s.driverCount > 0)
    .sort((a, b) => (b.guideCount + b.driverCount) - (a.guideCount + a.driverCount));

  const cardCls = "bg-white border border-[#E5E0D7] rounded-xl";
  const cardLabel = "flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[#968F84] font-medium";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 gap-4 print:hidden">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">
            Reporting · Analytique
          </p>
          <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Rapports analytiques</h1>
          <p className="text-[12px] text-[#6B6862] mt-1">
            Performance sur les 12 derniers mois de départs · au {now.toLocaleDateString("fr-FR")}
          </p>
        </div>
        <VoucherPrintButton />
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="font-display text-2xl text-ink">Hiri Tours — Rapport analytique</h1>
        <p className="text-xs text-sand-700">Édité le {now.toLocaleDateString("fr-FR")} · <span className="text-sand-500">by Bright Strategy</span></p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <KpiCard
          label={`CA réalisé · ${currentMonthName}`}
          value={formatMAD(monthRevenue)}
          accent="ocean"
          sub={`vs ${prevMonthName} · ${formatMAD(monthPrevRevenue)}`}
          delta={yoy !== null ? <DeltaPill up={yoy >= 0}>{yoy >= 0 ? "+" : "−"}{Math.abs(yoy)} %</DeltaPill> : undefined}
        />
        <KpiCard
          label="Panier moyen"
          value={formatMAD(basket)}
          sub="par réservation · 12 mois"
          delta={basketDelta !== null ? <DeltaPill up={basketDelta >= 0}>{basketDelta >= 0 ? "+" : "−"}{Math.abs(basketDelta)} %</DeltaPill> : undefined}
        />
        <KpiCard
          label="Taux de conversion"
          value={`${conversionRate} %`}
          sub={`${monthConverted.length} confirmées / ${monthActive.length} demandes`}
        />
        <KpiCard
          label="À encaisser"
          value={formatMAD(outstanding)}
          accent="amber"
          sub={`${openDossiers.length} dossier${openDossiers.length > 1 ? "s" : ""} ouvert${openDossiers.length > 1 ? "s" : ""}`}
          delta={
            oldInvoicesCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "#FCEBEB", color: "#791F1F" }}>
                <AlertTriangle className="size-3" />{oldInvoicesCount} &gt; 90 j
              </span>
            ) : undefined
          }
        />
      </div>

      {/* Chart revenu mensuel */}
      <div className={`${cardCls} p-4 mb-6`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className={cardLabel}>
            <BarChart3 className="size-3.5" /> Revenu mensuel — 12 derniers mois
          </span>
          <span className="text-[11px] text-[#6B6862]">Total : {formatMAD(chartTotal)}</span>
        </div>
        <PerformanceTrendChart trend={trend} previousLabel="N-1" />
      </div>

      {/* Top 5 + Sources */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6 items-start">
        {/* Top 5 circuits */}
        <div className={`${cardCls} p-4`}>
          <span className={`${cardLabel} mb-3`}>Top 5 circuits par CA</span>
          {topCircuits.length > 0 ? (
            <div className="space-y-3 mt-3">
              {topCircuits.map((c, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between gap-3 text-[13px] mb-1">
                    <span className="min-w-0 flex items-center gap-2">
                      <span className="font-display text-[#C84B31] w-4 shrink-0">{i + 1}</span>
                      <span className="text-[#1A1F2E] truncate">{c.title}</span>
                    </span>
                    <span className="font-medium tabular-nums shrink-0">{formatMAD(c.revenue)}</span>
                  </div>
                  <div className="h-[5px] rounded-full overflow-hidden" style={{ backgroundColor: "#EEE9E0" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round((c.revenue / topMax) * 100)}%`, backgroundColor: "#0C6B8A" }} />
                  </div>
                </div>
              ))}
              {topShare > 40 && (
                <p className="flex items-start gap-1.5 text-[10.5px] mt-3" style={{ color: "#B25F0B" }}>
                  <Info className="size-3.5 shrink-0 mt-px" />
                  Le n°1 concentre {topShare} % du CA — dépendance à surveiller.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-[#968F84] py-4 text-center">Aucune donnée sur la période.</p>
          )}
        </div>

        {/* Sources d'acquisition */}
        <div className={`${cardCls} p-4`}>
          <span className={`${cardLabel} mb-3`}>Sources d&apos;acquisition</span>
          {sources.length > 0 ? (
            <div className="mt-3">
              <div className="flex h-2.5 rounded-full overflow-hidden mb-4">
                {sources.map((s, i) => (
                  <div key={i} style={{ width: `${s.pct}%`, backgroundColor: s.color }} title={`${s.label} · ${s.pct} %`} />
                ))}
              </div>
              <div className="divide-y divide-[#F1EDE5]">
                {sources.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="size-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-[#1A1F2E] truncate">{s.label}</span>
                    </span>
                    <span className="text-[#6B6862] tabular-nums shrink-0">{s.count} · {s.pct} %</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#968F84] py-4 text-center">Aucune donnée sur la période.</p>
          )}
        </div>
      </div>

      {/* Occupation */}
      <div className={`${cardCls} overflow-hidden mb-6`}>
        <div className="px-5 py-4 border-b border-[#E5E0D7]">
          <h2 className="font-display text-lg text-[#1A1F2E]">Taux d&apos;occupation par circuit</h2>
          <p className="text-xs text-[#6B6862] mt-1">Moyenne des passagers par départ rapportée à la capacité maximale · 12 mois</p>
        </div>
        {occupancy.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FBF9F5] border-b border-[#E5E0D7]">
                <tr>
                  <th className="text-left px-5 py-2 font-medium text-[#58524A]">Circuit</th>
                  <th className="text-right px-5 py-2 font-medium text-[#58524A]">Réservations</th>
                  <th className="text-right px-5 py-2 font-medium text-[#58524A]">Pax total</th>
                  <th className="text-right px-5 py-2 font-medium text-[#58524A]">Pax moyen / départ</th>
                  <th className="text-right px-5 py-2 font-medium text-[#58524A]">Capacité max</th>
                  <th className="text-right px-5 py-2 font-medium text-[#58524A]">Occupation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {occupancy.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FBF9F5]">
                    <td className="px-5 py-3 text-[#1A1F2E]">{c.title}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.reservations}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.totalPax}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.avgPax}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#6B6862]">{c.max}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#EEE9E0" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, c.occupancyRate)}%`, backgroundColor: c.occupancyRate > 70 ? "#0F6E56" : c.occupancyRate > 40 ? "#D98324" : "#A32D2D" }}
                          />
                        </div>
                        <span className="font-medium tabular-nums text-xs w-10 text-right">{c.occupancyRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#6B6862] text-center py-4">Aucun circuit avec réservations sur la période.</p>
        )}
      </div>

      {/* Performance équipe */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-[#E5E0D7]">
          <h2 className="font-display text-lg text-[#1A1F2E]">Performance équipe</h2>
          <p className="text-xs text-[#6B6862] mt-1">Affectations actives sur les 12 derniers mois</p>
        </div>
        {topStaff.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FBF9F5] border-b border-[#E5E0D7]">
                <tr>
                  <th className="text-left px-5 py-2 font-medium text-[#58524A]">Nom</th>
                  <th className="text-left px-5 py-2 font-medium text-[#58524A]">Rôle</th>
                  <th className="text-right px-5 py-2 font-medium text-[#58524A]">Comme guide</th>
                  <th className="text-right px-5 py-2 font-medium text-[#58524A]">Comme chauffeur</th>
                  <th className="text-right px-5 py-2 font-medium text-[#58524A]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {topStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FBF9F5]">
                    <td className="px-5 py-3 text-[#1A1F2E]">{s.name}</td>
                    <td className="px-5 py-3 text-[#6B6862]">{ROLE_LABELS[s.role] ?? s.role}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{s.guideCount || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{s.driverCount || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">{s.guideCount + s.driverCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#6B6862] text-center py-4">Aucune affectation enregistrée sur la période.</p>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "ocean" | "amber";
  delta?: React.ReactNode;
}) {
  const borderStyle =
    accent === "ocean"
      ? { borderLeft: "3px solid #0C6B8A", borderRadius: "0 12px 12px 0" }
      : accent === "amber"
        ? { borderLeft: "3px solid #D98324", borderRadius: "0 12px 12px 0" }
        : undefined;
  return (
    <div className="bg-white border border-[#E5E0D7] rounded-xl p-3.5" style={borderStyle}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-[#968F84] font-medium">{label}</span>
        {delta}
      </div>
      <div className="font-display text-[21px] text-[#1A1F2E] tabular-nums mt-1">{value}</div>
      {sub && <div className="text-[10px] text-[#968F84] mt-0.5 capitalize">{sub}</div>}
    </div>
  );
}

function DeltaPill({ up, children }: { up: boolean; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
      style={up ? { backgroundColor: "#E3F0F5", color: "#0C447C" } : { backgroundColor: "#FCEBEB", color: "#791F1F" }}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {children}
    </span>
  );
}
