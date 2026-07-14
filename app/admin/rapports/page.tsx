import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { VoucherPrintButton } from "@/components/voucher-print-button";
import { RevenueChart, TopCircuitsChart, SourcesChart } from "@/components/analytics-charts";
import { formatMAD } from "@/lib/utils";
import { TrendingUp, Calendar, Target, AlertCircle } from "lucide-react";

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

export default async function RapportsPage() {
  const supabase = await createClient();
  const now = new Date();
  const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const startStr = yearAgo.toISOString().split("T")[0];
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const [reservationsRes, circuitsRes, staffRes] = await Promise.all([
    supabase.from("reservations")
      .select("id, status, total_amount_mad, paid_amount_mad, departure_date, created_at, adults, children, circuit_id, customer_id, guide_id, driver_id, circuits(title, max_participants), customers(acquisition_source)")
      .gte("departure_date", startStr),
    supabase.from("circuits").select("id, title, max_participants").eq("is_active", true),
    supabase.from("staff_members").select("id, full_name, role").eq("is_active", true),
  ]);

  const reservations = (reservationsRes.data || []) as any[];
  const circuits = (circuitsRes.data || []) as any[];
  const staff = (staffRes.data || []) as any[];

  // KPIs du mois en cours
  const monthRes = reservations.filter((r) => r.departure_date >= currentMonthStart);
  const monthActive = monthRes.filter((r) => r.status !== "cancelled");
  const monthConverted = monthActive.filter((r) => r.status === "paid" || r.status === "completed");
  const monthRevenue = monthConverted.reduce((s, r) => s + Number(r.total_amount_mad), 0);
  const conversionRate = monthActive.length > 0 ? Math.round((monthConverted.length / monthActive.length) * 100) : 0;
  const outstanding = reservations.filter((r) => r.status === "pending" || r.status === "confirmed")
    .reduce((s, r) => s + (Number(r.total_amount_mad) - Number(r.paid_amount_mad)), 0);

  // Revenu mensuel sur 12 mois
  const monthlyRevenue: { month: string; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = `${MONTHS_FR_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
    const rev = reservations
      .filter((r) => r.departure_date >= monthStart && r.departure_date <= monthEnd && (r.status === "paid" || r.status === "completed"))
      .reduce((s, r) => s + Number(r.total_amount_mad), 0);
    monthlyRevenue.push({ month: monthLabel, revenue: Math.round(rev) });
  }

  // Top 5 circuits par CA
  const circuitTotals: Record<string, { id: string; title: string; revenue: number; count: number }> = {};
  reservations.filter((r) => r.status === "paid" || r.status === "completed").forEach((r) => {
    const id = r.circuit_id;
    if (!circuitTotals[id]) circuitTotals[id] = { id, title: r.circuits?.title || "Sans titre", revenue: 0, count: 0 };
    circuitTotals[id].revenue += Number(r.total_amount_mad);
    circuitTotals[id].count += 1;
  });
  const topCircuits = Object.values(circuitTotals)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((c) => ({ title: c.title.length > 22 ? c.title.slice(0, 22) + "…" : c.title, revenue: Math.round(c.revenue), count: c.count }));

  // Sources acquisition
  const sourceCounts: Record<string, number> = {};
  reservations.filter((r) => r.status !== "cancelled").forEach((r) => {
    const src = r.customers?.acquisition_source || "other";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  const sourcesData = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source: SOURCE_LABELS[source] || source, count }))
    .sort((a, b) => b.count - a.count);

  // Taux d'occupation
  const occupancy = circuits.map((c) => {
    const cReservations = reservations.filter((r) => r.circuit_id === c.id && r.status !== "cancelled");
    const totalPax = cReservations.reduce((s, r) => s + r.adults + r.children, 0);
    const avgPax = cReservations.length > 0 ? totalPax / cReservations.length : 0;
    const occupancyRate = (c.max_participants || 0) > 0 ? Math.round((avgPax / c.max_participants) * 100) : 0;
    return { id: c.id, title: c.title, max: c.max_participants, totalPax, reservations: cReservations.length, avgPax: Math.round(avgPax * 10) / 10, occupancyRate };
  }).filter((c) => c.reservations > 0).sort((a, b) => b.occupancyRate - a.occupancyRate);

  // Performance équipe
  const staffStats: Record<string, { id: string; name: string; role: string; guideCount: number; driverCount: number }> = {};
  staff.forEach((s) => { staffStats[s.id] = { id: s.id, name: s.full_name, role: s.role, guideCount: 0, driverCount: 0 }; });
  reservations.filter((r) => r.status !== "cancelled").forEach((r) => {
    if (r.guide_id && staffStats[r.guide_id]) staffStats[r.guide_id].guideCount += 1;
    if (r.driver_id && staffStats[r.driver_id]) staffStats[r.driver_id].driverCount += 1;
  });
  const topStaff = Object.values(staffStats)
    .filter((s) => s.guideCount + s.driverCount > 0)
    .sort((a, b) => (b.guideCount + b.driverCount) - (a.guideCount + a.driverCount));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8 print:hidden">
        <div>
          <p className="eyebrow mb-2">Module 6 — Reporting BI</p>
          <h1 className="font-display text-3xl text-ink">Rapports analytiques</h1>
          <p className="text-sm text-sand-700 mt-2">Performance commerciale et opérationnelle sur les 12 derniers mois de départs.</p>
        </div>
        <VoucherPrintButton />
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="font-display text-2xl text-ink">Hiri Tours — Rapport analytique</h1>
        <p className="text-xs text-sand-700">Édité le {new Date().toLocaleDateString("fr-FR")} · <span className="text-sand-500">by Bright Strategy</span></p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="CA réalisé ce mois" value={formatMAD(monthRevenue)} icon={<TrendingUp className="size-5 text-terracotta-600" />} />
        <KpiCard label="Réservations ce mois" value={String(monthActive.length)} icon={<Calendar className="size-5 text-atlantic-700" />} />
        <KpiCard label="Taux de conversion" value={`${conversionRate}%`} icon={<Target className="size-5 text-emerald-700" />} sub={`${monthConverted.length} / ${monthActive.length}`} />
        <KpiCard label="À encaisser" value={formatMAD(outstanding)} icon={<AlertCircle className="size-5 text-amber-700" />} sub={`${reservations.filter((r) => r.status === "pending" || r.status === "confirmed").length} dossier(s)`} />
      </div>

      <Card className="mb-6">
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Revenu mensuel — 12 derniers mois</h2>
        </div>
        <CardBody>
          <RevenueChart data={monthlyRevenue} />
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <div className="px-5 py-4 border-b border-sand-200">
            <h2 className="font-display text-lg text-ink">Top 5 circuits par CA</h2>
          </div>
          <CardBody>
            <TopCircuitsChart data={topCircuits} />
          </CardBody>
        </Card>
        <Card>
          <div className="px-5 py-4 border-b border-sand-200">
            <h2 className="font-display text-lg text-ink">Sources d&apos;acquisition</h2>
            <p className="text-xs text-sand-700 mt-1">Réservations actives sur 12 mois</p>
          </div>
          <CardBody>
            <SourcesChart data={sourcesData} />
          </CardBody>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Taux d&apos;occupation par circuit</h2>
          <p className="text-xs text-sand-700 mt-1">Moyenne des passagers par départ rapportée à la capacité maximale</p>
        </div>
        {occupancy.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-sand-50 border-b border-sand-200">
              <tr>
                <th className="text-left px-5 py-2 font-medium text-sand-800">Circuit</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Réservations</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Pax total</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Pax moyen / départ</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Capacité max</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Occupation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {occupancy.map((c) => (
                <tr key={c.id} className="hover:bg-sand-50">
                  <td className="px-5 py-3 text-ink">{c.title}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.reservations}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.totalPax}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.avgPax}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-sand-700">{c.max}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-1.5 bg-sand-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${c.occupancyRate > 70 ? "bg-emerald-600" : c.occupancyRate > 40 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, c.occupancyRate)}%` }}
                        />
                      </div>
                      <span className="font-medium tabular-nums text-xs w-10 text-right">{c.occupancyRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <CardBody><p className="text-sm text-sand-700 text-center py-4">Aucun circuit avec réservations sur la période.</p></CardBody>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Performance équipe</h2>
          <p className="text-xs text-sand-700 mt-1">Affectations actives sur les 12 derniers mois</p>
        </div>
        {topStaff.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-sand-50 border-b border-sand-200">
              <tr>
                <th className="text-left px-5 py-2 font-medium text-sand-800">Nom</th>
                <th className="text-left px-5 py-2 font-medium text-sand-800">Rôle</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Comme guide</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Comme chauffeur</th>
                <th className="text-right px-5 py-2 font-medium text-sand-800">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {topStaff.map((s) => (
                <tr key={s.id} className="hover:bg-sand-50">
                  <td className="px-5 py-3 text-ink">{s.name}</td>
                  <td className="px-5 py-3 text-sand-800">{ROLE_LABELS[s.role] ?? s.role}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.guideCount || "—"}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.driverCount || "—"}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">{s.guideCount + s.driverCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <CardBody><p className="text-sm text-sand-700 text-center py-4">Aucune affectation enregistrée sur la période.</p></CardBody>
        )}
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon, sub }: { label: string; value: string; icon: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white border border-sand-200 rounded-lg p-5">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-sand-600">{label}</span>
        {icon}
      </div>
      <div className="font-display text-2xl text-ink tabular-nums">{value}</div>
      {sub && <div className="text-xs text-sand-600 mt-1">{sub}</div>}
    </div>
  );
}
