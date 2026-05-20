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
  const trendFetchStart = addMonths(now, -36);
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

  // Trend selon vue : 12 mois glissants OU année calendaire
  const trend: { label: string; revenue: number; isCurrent: boolean }[] = [];
  if (trendView === "12m") {
    for (let i = 11; i >= 0; i--) {
      const d = addMonths(now, -i);
      const ms = startOfMonth(d);
      const me = endOfMonth(d);
      const rev = allReservations
        .filter((r) => r.status !== "cancelled" && inDateRange(r.departure_date, ms, me))
        .reduce((s, r) => s + Number(r.total_amount_mad), 0);
      trend.push({ label: MONTH_LABELS_FR[d.getMonth()], revenue: rev, isCurrent: i === 0 });
    }
  } else {
    const year = parseInt(trendView);
    for (let m = 0; m < 12; m++) {
      const d = new Date(year, m, 1);
      const ms = startOfMonth(d);
      const me = endOfMonth(d);
      const rev = allReservations
        .filter((r) => r.status !== "cancelled" && inDateRange(r.departure_date, ms, me))
        .reduce((s, r) => s + Number(r.total_amount_mad), 0);
      trend.push({
        label: MONTH_LABELS_FR[m],
        revenue: rev,
        isCurrent: year === now.getFullYear() && m === now.getMonth(),
      });
    }
  }
  const trendMax = Math.max(...trend.map((t) => t.revenue), 1);

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
            className="h-full bg-terracotta-500 rounded-full"
            style={{ width: `${ytdProgress}%` }}
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
          <div className="flex items-end gap-2 h-32 mb-2">
            {trend.map((t, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end relative group">
                <span className="opacity-0 group-hover:opacity-100 absolute -top-6 text-xs whitespace-nowrap bg-navy-900 text-white px-2 py-0.5 rounded transition">
                  {formatMad(t.revenue)} MAD
                </span>
                <div
                  className={`w-full rounded-t-md ${
                    t.isCurrent ? "bg-terracotta-500" : "bg-stone-200"
                  }`}
                  style={{ height: `${Math.max((t.revenue / trendMax) * 100, 2)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-stone-400 mt-1">
            {trend.map((t, i) => (
              <span key={i} className="flex-1 text-center">
                {t.label}
              </span>
            ))}
          </div>
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
    <div className="bg-stone-50 border border-stone-100 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-stone-500 mb-1">
        {icon}
        <p className="text-xs">{label}</p>
      </div>
      <p className={valueIsText ? "text-sm font-medium leading-tight" : "text-xl font-medium"}>
        {value}
      </p>
      <p className="text-xs text-stone-500 mt-0.5">{sub}</p>
    </div>
  );
}
