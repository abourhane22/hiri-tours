import Link from "next/link";
import {
  TrendingUp, Bus, AlertTriangle, ChevronRight,
  Mountain, UserPlus, X as XIcon, Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const MONTH_LABELS_FR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}
function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function ageInDays(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}
function formatMad(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount);
}
function inDateRange(date: string, start: Date, end: Date): boolean {
  const d = new Date(date);
  return d >= start && d <= end;
}

type SearchParams = Promise<{ trendView?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const trendView = params.trendView ?? "12m";

  const supabase = await createClient();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastYearMonthStart = startOfMonth(new Date(now.getFullYear() - 1, now.getMonth(), 1));
  const lastYearMonthEnd = endOfMonth(new Date(now.getFullYear() - 1, now.getMonth(), 1));
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);
  const twelveMonthsStart = addMonths(now, -11);
  const trendFetchStart = addMonths(now, -48);
  const todayStr = isoDate(now);
  const thirtyDaysOut = isoDate(new Date(now.getTime() + 30 * 86400000));

  const [
    allReservationsResult,
    lastYearMonthResult,
    issuedInvoicesResult,
    todayReservationsResult,
    vehicleAlertsResult,
    pendingReservationsResult,
    companyResult,
    newCustomersResult,
  ] = await Promise.all([
    supabase
      .from("reservations")
      .select(`
        id, status, departure_date, total_amount_mad, adults, children,
        circuit:circuits(id, title)
      `)
      .gte("departure_date", isoDate(trendFetchStart)),
    supabase
      .from("reservations")
      .select("total_amount_mad, status")
      .gte("departure_date", isoDate(lastYearMonthStart))
      .lte("departure_date", isoDate(lastYearMonthEnd))
      .neq("status", "cancelled"),
    supabase
      .from("invoices")
      .select("id, issued_at, total_ttc_mad")
      .eq("status", "issued"),
    supabase
      .from("reservations")
      .select(`
        id, departure_date, status, adults, children, guide_id, vehicle_id,
        circuit:circuits(id, title)
      `)
      .eq("departure_date", todayStr)
      .neq("status", "cancelled"),
    supabase
      .from("vehicles")
      .select("id, registration")
      .or(`insurance_expires_on.lte.${thirtyDaysOut},inspection_expires_on.lte.${thirtyDaysOut},vignette_expires_on.lte.${thirtyDaysOut},next_maintenance_date.lte.${thirtyDaysOut}`),
    supabase
      .from("reservations")
      .select("id")
      .eq("status", "pending")
      .gte("departure_date", todayStr),
    supabase.from("company_settings").select("*").limit(1).maybeSingle(),
    supabase
      .from("customers")
      .select("id")
      .gte("created_at", monthStart.toISOString()),
  ]);

  const allReservations = (allReservationsResult.data ?? []) as any[];
  const lastYearMonthRes = (lastYearMonthResult.data ?? []) as any[];
  const issuedInvoices = (issuedInvoicesResult.data ?? []) as any[];
  const todayReservations = (todayReservationsResult.data ?? []) as any[];
  const vehicleAlerts = (vehicleAlertsResult.data ?? []) as any[];
  const pendingReservations = (pendingReservationsResult.data ?? []) as any[];
  const company = companyResult.data as any;
  const newCustomers = (newCustomersResult.data ?? []) as any[];

  // Années disponibles dans les données (desc)
  const yearsAvailable = Array.from(
    new Set(allReservations.map((r) => new Date(r.departure_date).getFullYear()))
  ).sort((a, b) => b - a);

  // Hero KPIs
  const currentMonthRes = allReservations.filter(
    (r) => r.status !== "cancelled" && inDateRange(r.departure_date, monthStart, monthEnd)
  );
  const currentMonthRevenue = currentMonthRes.reduce((s, r) => s + Number(r.total_amount_mad), 0);
  const currentMonthCount = currentMonthRes.length;
  const currentMonthPax = currentMonthRes.reduce((s, r) => s + r.adults + r.children, 0);

  const lastYearMonthRevenue = lastYearMonthRes.reduce((s, r) => s + Number(r.total_amount_mad), 0);
  const yoyVariation =
    lastYearMonthRevenue > 0
      ? Math.round(((currentMonthRevenue - lastYearMonthRevenue) / lastYearMonthRevenue) * 100)
      : null;

  const encoursTotal = issuedInvoices.reduce((s, inv) => s + Number(inv.total_ttc_mad), 0);
  const encoursCount = issuedInvoices.length;
  const dsoAvg =
    encoursCount > 0
      ? Math.round(issuedInvoices.reduce((s, inv) => s + ageInDays(inv.issued_at), 0) / encoursCount)
      : 0;

  // Annual progress
  const ytdRes = allReservations.filter(
    (r) => r.status !== "cancelled" && inDateRange(r.departure_date, yearStart, yearEnd)
  );
  const ytdRevenue = ytdRes.reduce((s, r) => s + Number(r.total_amount_mad), 0);
  const annualTarget = Number(company?.annual_revenue_target_mad ?? 600000);
  const ytdProgress = Math.min(100, Math.round((ytdRevenue / annualTarget) * 100));

  // Helper : somme CA d'une période
  const sumRev = (start: Date, end: Date) =>
    allReservations
      .filter((r) => r.status !== "cancelled" && inDateRange(r.departure_date, start, end))
      .reduce((s, r) => s + Number(r.total_amount_mad), 0);

  // Trend selon vue (12m glissants ou année), avec N-1 en comparaison
  const trend: {
    label: string;
    current: number;
    previous: number;
    isCurrent: boolean;
  }[] = [];

  if (trendView === "12m") {
    for (let i = 11; i >= 0; i--) {
      const d = addMonths(now, -i);
      const dPrev = new Date(d.getFullYear() - 1, d.getMonth(), 1);
      trend.push({
        label: MONTH_LABELS_FR[d.getMonth()],
        current: sumRev(startOfMonth(d), endOfMonth(d)),
        previous: sumRev(startOfMonth(dPrev), endOfMonth(dPrev)),
        isCurrent: i === 0,
      });
    }
  } else {
    const year = parseInt(trendView);
    for (let m = 0; m < 12; m++) {
      const d = new Date(year, m, 1);
      const dPrev = new Date(year - 1, m, 1);
      trend.push({
        label: MONTH_LABELS_FR[m],
        current: sumRev(startOfMonth(d), endOfMonth(d)),
        previous: sumRev(startOfMonth(dPrev), endOfMonth(dPrev)),
        isCurrent: year === now.getFullYear() && m === now.getMonth(),
      });
    }
  }

  const trendMax = Math.max(...trend.flatMap((t) => [t.current, t.previous]), 1);
  const previousLegendLabel = trendView === "12m" ? "N-1" : String(parseInt(trendView) - 1);
  const currentLegendLabel = trendView === "12m" ? "N" : trendView;

  // Points de la trajectoire (uniquement les mois avec données)
  const trajectoryPoints = trend
    .map((t, i) => ({
      x: 58.5 + i * 50,
      y: 165 - (t.current / trendMax) * 145,
      isCurrent: t.isCurrent,
      hasData: t.current > 0,
    }))
    .filter((p) => p.hasData);

  // Today's departures
  const todayDepartures = todayReservations.map((r) => ({
    id: r.id,
    title: r.circuit?.title ?? "—",
    pax: r.adults + r.children,
    isAssigned: r.guide_id !== null && r.vehicle_id !== null,
  }));
  const todayPaxTotal = todayDepartures.reduce((s, r) => s + r.pax, 0);

  // Alerts
  const pendingPaymentsCount = pendingReservations.length;
  const vehicleAlertCount = vehicleAlerts.length;
  const oldInvoicesCount = issuedInvoices.filter((inv) => ageInDays(inv.issued_at) > 90).length;
  const totalActions = pendingPaymentsCount + vehicleAlertCount + oldInvoicesCount;

  // Pilotage
  const circuitCounts = new Map<string, { title: string; count: number }>();
  currentMonthRes.forEach((r) => {
    const c = r.circuit;
    if (!c?.id) return;
    const existing = circuitCounts.get(c.id) ?? { title: c.title, count: 0 };
    existing.count++;
    circuitCounts.set(c.id, existing);
  });
  const topCircuit = Array.from(circuitCounts.values()).sort((a, b) => b.count - a.count)[0];

  const newCustomersCount = newCustomers.length;
  const total12m = allReservations.length;
  const cancelled12m = allReservations.filter((r) => r.status === "cancelled").length;
  const cancelRate = total12m > 0 ? ((cancelled12m / total12m) * 100).toFixed(1) : "0";

  // Labels
  const currentMonthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const lastYearMonthLabel = new Date(now.getFullYear() - 1, now.getMonth(), 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const todayLabel = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <p className="text-sm text-stone-500 capitalize">{todayLabel}</p>
        <h1 className="font-serif text-3xl text-navy-900 mt-1">Tableau de bord</h1>
      </div>

      {/* HERO KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2 bg-terracotta-50 border border-terracotta-200 rounded-2xl p-5">
          <p className="text-sm text-terracotta-700 capitalize">
            Chiffre d'affaires · {currentMonthLabel}
          </p>
          <p className="font-serif text-4xl text-terracotta-900 mt-2">
            {formatMad(currentMonthRevenue)} <span className="text-base font-sans">MAD</span>
          </p>
          {yoyVariation !== null && (
            <p className="text-xs text-terracotta-700 mt-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {yoyVariation >= 0 ? "+" : ""}
              {yoyVariation} % vs {lastYearMonthLabel} ({formatMad(lastYearMonthRevenue)} MAD)
            </p>
          )}
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <p className="text-sm text-stone-500">Réservations</p>
          <p className="font-serif text-3xl text-navy-900 mt-2">{currentMonthCount}</p>
          <p className="text-xs text-stone-500 mt-2">{currentMonthPax} passagers</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <p className="text-sm text-stone-500">Encours clients</p>
          <p className="font-serif text-3xl text-navy-900 mt-2">
            {formatMad(encoursTotal)} <span className="text-base font-sans">MAD</span>
          </p>
          <p className="text-xs text-stone-500 mt-2">
            {encoursCount} {encoursCount > 1 ? "factures" : "facture"} · DSO {dsoAvg} j
          </p>
        </div>
      </div>

      {/* ANNUAL PROGRESS */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <div className="flex items-baseline justify-between mb-3">
          <p className="font-medium">Progression annuelle {now.getFullYear()}</p>
          <p className="text-sm text-stone-500">
            {formatMad(ytdRevenue)} / {formatMad(annualTarget)} MAD · {ytdProgress} %
          </p>
        </div>
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${ytdProgress}%`, backgroundColor: "#C84B31" }}
          />
        </div>
      </div>

      {/* TODAY */}
      <div>
        <p className="text-sm text-stone-500 mb-2">Aujourd'hui</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bus className="w-5 h-5 text-atlantic-600" />
              <p className="font-medium">
                {todayDepartures.length} {todayDepartures.length > 1 ? "départs" : "départ"} ·{" "}
                {todayPaxTotal} passagers
              </p>
            </div>
            {todayDepartures.length === 0 ? (
              <p className="text-sm text-stone-500 py-2">Aucun départ aujourd'hui.</p>
            ) : (
              <div className="space-y-2">
                {todayDepartures.map((d) => (
                  <Link
                    key={d.id}
                    href={`/admin/reservations/${d.id}`}
                    className="flex items-center justify-between py-2 border-t border-stone-100 first:border-t-0 hover:bg-stone-50 -mx-1 px-1 rounded"
                  >
                    <span className="text-sm">
                      {d.title} · {d.pax} pax
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md ${
                        d.isAssigned
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {d.isAssigned ? "Affecté" : "À affecter"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="font-medium">
                {totalActions} {totalActions > 1 ? "actions à mener" : "action à mener"}
              </p>
            </div>
            {totalActions === 0 ? (
              <p className="text-sm text-stone-500 py-2">Rien d'urgent. Bonne journée.</p>
            ) : (
              <div className="space-y-2">
                {pendingPaymentsCount > 0 && (
                  <Link
                    href="/admin/reservations?status=pending"
                    className="flex items-center justify-between py-2 border-t border-stone-100 first:border-t-0 hover:bg-stone-50 -mx-1 px-1 rounded"
                  >
                    <span className="text-sm text-stone-700">
                      {pendingPaymentsCount}{" "}
                      {pendingPaymentsCount > 1
                        ? "paiements en attente"
                        : "paiement en attente"}
                    </span>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </Link>
                )}
                {vehicleAlertCount > 0 && (
                  <Link
                    href="/admin/logistique/vehicules"
                    className="flex items-center justify-between py-2 border-t border-stone-100 first:border-t-0 hover:bg-stone-50 -mx-1 px-1 rounded"
                  >
                    <span className="text-sm text-stone-700">
                      {vehicleAlertCount}{" "}
                      {vehicleAlertCount > 1
                        ? "véhicules avec documents à renouveler"
                        : "véhicule avec document à renouveler"}
                    </span>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </Link>
                )}
                {oldInvoicesCount > 0 && (
                  <Link
                    href="/admin/factures?status=issued"
                    className="flex items-center justify-between py-2 border-t border-stone-100 first:border-t-0 hover:bg-stone-50 -mx-1 px-1 rounded"
                  >
                    <span className="text-sm text-red-700">
                      {oldInvoicesCount} {oldInvoicesCount > 1 ? "factures" : "facture"} &gt; 90 j
                      (créance ancienne)
                    </span>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TREND */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-stone-500">
            {trendView === "12m" ? "Tendance · 12 derniers mois" : `Tendance · année ${trendView}`}
          </p>
          <div className="flex gap-1.5 text-xs">
            <Link
              href="/admin"
              className={`px-2.5 py-1 rounded-full transition ${
                trendView === "12m"
                  ? "bg-navy-900 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              12 mois
            </Link>
            {yearsAvailable.map((y) => (
              <Link
                key={y}
                href={`/admin?trendView=${y}`}
                className={`px-2.5 py-1 rounded-full transition ${
                  trendView === String(y)
                    ? "bg-navy-900 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="flex justify-end gap-4 text-xs text-stone-500 mb-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#D6D3D1" }}></span>
              {previousLegendLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#D85A30" }}></span>
              {currentLegendLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded-full" style={{ background: "#1A1F2E" }}></span>
              Trajectoire
            </span>
          </div>

          <svg
            viewBox="0 0 640 200"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label="Tendance mensuelle comparée année actuelle et précédente"
          >
            {trend.map((t, i) => {
              const xPrev = 36 + i * 50;
              const xCur = 52 + i * 50;
              const hPrev = (t.previous / trendMax) * 145;
              const hCur = (t.current / trendMax) * 145;
              const yPrev = 165 - hPrev;
              const yCur = 165 - hCur;
              const labelX = 50 + i * 50;
              return (
                <g key={i}>
                  {t.previous > 0 && (
                    <rect x={xPrev} y={yPrev} width="13" height={hPrev} rx="2" fill="#D6D3D1">
                      <title>{`${t.label} ${previousLegendLabel} : ${formatMad(t.previous)} MAD`}</title>
                    </rect>
                  )}
                  {t.current > 0 && (
                    <rect x={xCur} y={yCur} width="13" height={hCur} rx="2" fill="#D85A30">
                      <title>{`${t.label} ${currentLegendLabel} : ${formatMad(t.current)} MAD`}</title>
                    </rect>
                  )}
                  <text
                    x={labelX}
                    y="182"
                    fontSize="11"
                    fill={t.isCurrent ? "#712B13" : "#78716C"}
                    textAnchor="middle"
                    fontWeight={t.isCurrent ? 500 : 400}
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}

            {trajectoryPoints.length > 0 && (
              <>
                <polyline
                  points={trajectoryPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#1A1F2E"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {trajectoryPoints.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={p.isCurrent ? 5.5 : 3}
                    fill="#1A1F2E"
                    stroke={p.isCurrent ? "white" : "none"}
                    strokeWidth={p.isCurrent ? 2 : 0}
                  />
                ))}
              </>
            )}
          </svg>
        </div>
      </div>

      {/* PILOTAGE */}
      <div>
        <p className="text-sm text-stone-500 mb-2">Pilotage</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniCard
            icon={<Mountain className="w-3.5 h-3.5" />}
            label="Top circuit"
            valueIsText
            value={topCircuit?.title ?? "—"}
            sub={
              topCircuit
                ? `${topCircuit.count} ${topCircuit.count > 1 ? "réservations" : "réservation"}`
                : "Aucune ce mois"
            }
          />
          <MiniCard
            icon={<UserPlus className="w-3.5 h-3.5" />}
            label="Nouveaux clients"
            value={newCustomersCount}
            sub="ce mois"
          />
          <MiniCard
            icon={<XIcon className="w-3.5 h-3.5" />}
            label="Taux d'annulation"
            value={`${cancelRate} %`}
            sub="12 mois glissants"
          />
          <MiniCard
            icon={<Clock className="w-3.5 h-3.5" />}
            label="DSO"
            value={`${dsoAvg} j`}
            sub="Délai paiement"
          />
        </div>
      </div>
    </div>
  );
}

function MiniCard({
  icon, label, value, sub, valueIsText = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  valueIsText?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: "#1A1F2E", color: "#FFFFFF" }}
    >
      <div
        className="flex items-center gap-1.5 mb-2"
        style={{ color: "#9CA3AF" }}
      >
        {icon}
        <p className="text-xs">{label}</p>
      </div>
      <p
        className={valueIsText ? "text-sm font-medium leading-tight" : "text-2xl font-medium"}
        style={{ color: "#FFFFFF" }}
      >
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
        {sub}
      </p>
    </div>
  );
}
