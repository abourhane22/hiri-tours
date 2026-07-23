import Link from "next/link";
import {
  TrendingUp, TrendingDown, Bus, AlertCircle, AlertTriangle, ChevronRight,
  Trophy, UserPlus, X as XIcon, Clock, Target, BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const MONTH_LABELS_FR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

// Cible de taux d'annulation — à remplacer par la cible de company_settings quand elle existera.
const ANNULATION_TARGET_PCT = 10;

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
  const lastYearMonthCount = lastYearMonthRes.length;
  const reservationsDelta = currentMonthCount - lastYearMonthCount;
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

  // NOUVEAU — repère de rythme : où l'on devrait être si le CA arrivait
  // linéairement sur l'année (jour de l'année / 365).
  const dayOfYear = Math.floor((now.getTime() - yearStart.getTime()) / 86400000) + 1;
  const rhythmPct = (dayOfYear / 365) * 100;
  const markerPct = Math.min(100, rhythmPct);
  const realizedPctExact = annualTarget > 0 ? (ytdRevenue / annualTarget) * 100 : 0;
  const paceGapPts = Math.round(realizedPctExact - rhythmPct);
  const paceDateLabel = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

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

  // Points de la trajectoire (nouvelles coordonnées, mois avec données uniquement)
  const trajectoryPoints = trend
    .map((t, i) => ({
      x: 79 + i * 56,
      y: 220 - (t.current / trendMax) * 190,
      isCurrent: t.isCurrent,
      hasData: t.current > 0,
    }))
    .filter((p) => p.hasData);

  // Index du mois courant pour le surlignage en arrière-plan
  const currentMonthIndex = trend.findIndex((t) => t.isCurrent);

  // Label compact du max (33k au lieu de 33 000)
  const maxLabel =
    trendMax >= 1000 ? `${Math.round(trendMax / 1000)}k` : String(Math.round(trendMax));

  // Chemin lissé pour la trajectoire (cubic bezier avec contrôles horizontaux)
  const trajectoryPath = (() => {
    const pts = trajectoryPoints;
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dx = (p2.x - p1.x) * 0.3;
      d += ` C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
    }
    return d;
  })();

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

  // Nombre de catégories d'actions "rouges" (créances anciennes, véhicules) — pour l'accueil.
  const redActionCategories = [oldInvoicesCount > 0, vehicleAlertCount > 0].filter(Boolean).length;

  // Actions à mener (liens conservés)
  const actionItems = [
    pendingPaymentsCount > 0 && {
      count: pendingPaymentsCount,
      label: pendingPaymentsCount > 1 ? "paiements en attente" : "paiement en attente",
      href: "/admin/reservations?status=pending",
      red: false,
    },
    vehicleAlertCount > 0 && {
      count: vehicleAlertCount,
      label:
        vehicleAlertCount > 1
          ? "véhicules avec documents à renouveler"
          : "véhicule avec document à renouveler",
      href: "/admin/logistique/vehicules",
      red: false,
    },
    oldInvoicesCount > 0 && {
      count: oldInvoicesCount,
      label: `${oldInvoicesCount > 1 ? "factures" : "facture"} > 90 j (créance ancienne)`,
      href: "/admin/factures?status=issued",
      red: true,
    },
  ].filter(Boolean) as { count: number; label: string; href: string; red: boolean }[];

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
  const cancelRateNum = total12m > 0 ? (cancelled12m / total12m) * 100 : 0;
  const cancelRate = cancelRateNum.toFixed(1);

  // Labels
  const currentMonthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const currentMonthName = now.toLocaleDateString("fr-FR", { month: "long" });
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

  const cardLabel = "flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[#968F84] font-medium";

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      {/* 1. LIGNE D'ACCUEIL */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#6B6862] capitalize">{todayLabel}</p>
          {/* Prénom figé par la maquette — à brancher sur le profil connecté plus tard. */}
          <h1 className="font-display text-2xl text-[#1A1F2E] mt-0.5">Bonjour Abdellah</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#6B6862]">
          <span
            className="inline-block rounded-full shrink-0"
            style={{
              width: 7,
              height: 7,
              backgroundColor: redActionCategories === 0 ? "#0F6E56" : "#EF9F27",
            }}
          />
          {todayDepartures.length} départ{todayDepartures.length > 1 ? "s" : ""} aujourd'hui ·{" "}
          {redActionCategories} action{redActionCategories > 1 ? "s" : ""} urgente
          {redActionCategories > 1 ? "s" : ""}
        </div>
      </div>

      {/* 2. HERO KPIs */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
      >
        {/* CA */}
        <div
          className="bg-white border border-[#E5E0D7] p-4"
          style={{ borderLeft: "3px solid #C84B31", borderRadius: "0 12px 12px 0" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={cardLabel}>Chiffre d'affaires</span>
            {yoyVariation !== null && (
              <DeltaPill up={yoyVariation >= 0}>
                {yoyVariation >= 0 ? "+" : "−"}
                {Math.abs(yoyVariation)} %
              </DeltaPill>
            )}
          </div>
          <div className="font-display text-2xl text-[#1A1F2E] mt-2 tabular-nums">
            {formatMad(currentMonthRevenue)}{" "}
            <span className="text-sm font-sans text-[#968F84]">MAD</span>
          </div>
          <p className="text-[11px] text-[#968F84] mt-1 capitalize">
            {currentMonthLabel} · N-1 {formatMad(lastYearMonthRevenue)} MAD
          </p>
        </div>

        {/* Réservations */}
        <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <span className={cardLabel}>Réservations</span>
            {lastYearMonthCount > 0 && (
              <DeltaPill up={reservationsDelta >= 0}>
                {reservationsDelta >= 0 ? "+" : "−"}
                {Math.abs(reservationsDelta)}
              </DeltaPill>
            )}
          </div>
          <div className="font-display text-2xl text-[#1A1F2E] mt-2 tabular-nums">
            {currentMonthCount}
          </div>
          <p className="text-[11px] text-[#968F84] mt-1">{currentMonthPax} passagers</p>
        </div>

        {/* Encours */}
        <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <span className={cardLabel}>Encours clients</span>
            {oldInvoicesCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: "#FCEBEB", color: "#791F1F" }}
              >
                <AlertTriangle className="size-3" />
                {oldInvoicesCount} &gt; 90 j
              </span>
            )}
          </div>
          <div className="font-display text-2xl text-[#1A1F2E] mt-2 tabular-nums">
            {formatMad(encoursTotal)}{" "}
            <span className="text-sm font-sans text-[#968F84]">MAD</span>
          </div>
          <p className="text-[11px] text-[#968F84] mt-1">
            {encoursCount} {encoursCount > 1 ? "factures" : "facture"} · DSO {dsoAvg} j
          </p>
        </div>
      </div>

      {/* 3. OBJECTIF ANNUEL */}
      <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <span className={cardLabel}>
            <Target className="size-3.5" /> Objectif annuel {now.getFullYear()}
          </span>
          <div className="text-right">
            <div className="font-display text-lg text-[#1A1F2E] tabular-nums leading-none">
              {formatMad(ytdRevenue)} / {formatMad(annualTarget)} MAD
            </div>
            <div
              className="text-[11px] mt-1"
              style={{ color: paceGapPts >= 0 ? "#0F6E56" : "#A32D2D" }}
            >
              {ytdProgress} % ·{" "}
              {paceGapPts >= 0
                ? `+${paceGapPts} pts au-dessus`
                : `−${Math.abs(paceGapPts)} pts sous`}{" "}
              le rythme
            </div>
          </div>
        </div>

        <div className="relative mt-3 mb-1.5">
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: "#EEE9E0" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${ytdProgress}%`, backgroundColor: "#C84B31" }}
            />
          </div>
          {/* Repère de rythme nominal */}
          <div
            className="absolute"
            style={{
              left: `${markerPct}%`,
              top: -2,
              bottom: -2,
              width: 2,
              backgroundColor: "#1A1F2E",
              transform: "translateX(-1px)",
            }}
            aria-hidden
          />
        </div>
        <p className="text-[11px] text-[#968F84]">
          Le repère noir = rythme nominal au {paceDateLabel}
        </p>
      </div>

      {/* 4. AUJOURD'HUI */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}
      >
        {/* Départs du jour */}
        <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <span className={`${cardLabel} mb-3`}>
            <Bus className="size-3.5" /> Départs du jour · {todayDepartures.length}
          </span>
          {todayDepartures.length === 0 ? (
            <p className="text-sm text-[#968F84] py-1">Aucun départ aujourd'hui.</p>
          ) : (
            <div className="space-y-2">
              {todayDepartures.map((d) => (
                <Link
                  key={d.id}
                  href={`/admin/reservations/${d.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:brightness-[0.98]"
                  style={{
                    backgroundColor: "#FBF9F5",
                    border: `1px solid ${d.isAssigned ? "#EEE9E0" : "#FAC775"}`,
                  }}
                >
                  <span className="text-sm text-[#1A1F2E] min-w-0">
                    <span className="font-medium">{d.title}</span>
                    <span className="text-[#968F84]"> · {d.pax} pax</span>
                  </span>
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={
                      d.isAssigned
                        ? { backgroundColor: "#E1F5EE", color: "#085041" }
                        : { backgroundColor: "#FAEEDA", color: "#633806" }
                    }
                  >
                    {d.isAssigned ? "Affecté" : "À affecter"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Actions à mener */}
        <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <span className={`${cardLabel} mb-3`}>
            <AlertCircle className="size-3.5" /> Actions à mener · {totalActions}
          </span>
          {totalActions === 0 ? (
            <p className="text-sm text-[#968F84] py-1">Rien d'urgent. Bonne journée.</p>
          ) : (
            <div className="space-y-2">
              {actionItems.map((a, i) => (
                <Link
                  key={i}
                  href={a.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:brightness-[0.98]"
                  style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}
                >
                  <span
                    className="inline-flex items-center justify-center rounded-full text-[11px] font-medium px-2 py-0.5 shrink-0"
                    style={
                      a.red
                        ? { backgroundColor: "#FCEBEB", color: "#791F1F" }
                        : { backgroundColor: "#FAEEDA", color: "#633806" }
                    }
                  >
                    {a.count}
                  </span>
                  <span
                    className="text-sm flex-1 min-w-0"
                    style={{ color: a.red ? "#791F1F" : "#5F5E5A" }}
                  >
                    {a.label}
                  </span>
                  <ChevronRight className="size-4 text-[#968F84] shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. TENDANCE */}
      <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <span className={cardLabel}>
            <BarChart3 className="size-3.5" />
            {trendView === "12m" ? "Tendance · 12 derniers mois" : `Tendance · année ${trendView}`}
          </span>
          <div className="flex gap-1.5 text-xs">
            <PeriodPill href="/admin" active={trendView === "12m"}>
              12 mois
            </PeriodPill>
            {yearsAvailable.map((y) => (
              <PeriodPill key={y} href={`/admin?trendView=${y}`} active={trendView === String(y)}>
                {y}
              </PeriodPill>
            ))}
          </div>
        </div>

        <svg
          viewBox="0 0 760 270"
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label="Tendance mensuelle comparée année actuelle et précédente"
        >
          {currentMonthIndex >= 0 && (
            <rect
              x={40 + currentMonthIndex * 56 - 4}
              y="22"
              width="64"
              height="200"
              fill="#FAECE7"
              opacity="0.5"
              rx="6"
            />
          )}

          <line x1="40" y1="78" x2="720" y2="78" stroke="#F5F5F4" strokeWidth="1" />
          <line x1="40" y1="125" x2="720" y2="125" stroke="#F5F5F4" strokeWidth="1" />
          <line x1="40" y1="173" x2="720" y2="173" stroke="#F5F5F4" strokeWidth="1" />
          <line x1="40" y1="222" x2="720" y2="222" stroke="#E7E5E4" strokeWidth="1" />

          {trend.map((t, i) => {
            const xPrev = 48 + i * 56;
            const xCur = 70 + i * 56;
            const hPrev = (t.previous / trendMax) * 190;
            const hCur = (t.current / trendMax) * 190;
            const yPrev = 220 - hPrev;
            const yCur = 220 - hCur;
            const labelX = 68 + i * 56;
            return (
              <g key={i}>
                {t.previous > 0 && (
                  <rect x={xPrev} y={yPrev} width="18" height={hPrev} rx="3" fill="#E0DACF">
                    <title>{`${t.label} ${previousLegendLabel} : ${formatMad(t.previous)} MAD`}</title>
                  </rect>
                )}
                {t.current > 0 && (
                  <rect x={xCur} y={yCur} width="18" height={hCur} rx="3" fill="#C84B31">
                    <title>{`${t.label} ${currentLegendLabel} : ${formatMad(t.current)} MAD`}</title>
                  </rect>
                )}
                <text
                  x={labelX}
                  y="240"
                  fontSize="11"
                  fill={t.isCurrent ? "#712B13" : "#A8A29E"}
                  textAnchor="middle"
                  fontWeight={t.isCurrent ? 500 : 400}
                >
                  {t.label}
                </text>
              </g>
            );
          })}

          {trajectoryPoints.length > 1 && (
            <>
              <path
                d={trajectoryPath}
                fill="none"
                stroke="#1A1F2E"
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {trajectoryPoints.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={p.isCurrent ? 6 : 2.5}
                  fill="#1A1F2E"
                  stroke={p.isCurrent ? "white" : "none"}
                  strokeWidth={p.isCurrent ? 2.5 : 0}
                />
              ))}
            </>
          )}
        </svg>

        {/* Légende */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
          <p className="text-xs text-[#968F84]">Échelle max · {maxLabel} MAD</p>
          <div className="flex gap-4 text-xs text-[#6B6862]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#C84B31" }} />
              {currentLegendLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#E0DACF" }} />
              {previousLegendLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded-full" style={{ background: "#1A1F2E" }} />
              Trajectoire
            </span>
          </div>
        </div>
      </div>

      {/* 6. PILOTAGE */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
      >
        <PilotageCard
          icon={<Trophy className="size-3.5" />}
          label="Top circuit"
          valueIsText
          value={topCircuit?.title ?? "—"}
          sub={
            topCircuit
              ? `${topCircuit.count} réservation${topCircuit.count > 1 ? "s" : ""} en ${currentMonthName}`
              : "Aucune ce mois"
          }
          subColor="#8B92A5"
        />
        <PilotageCard
          icon={<UserPlus className="size-3.5" />}
          label="Nouveaux clients"
          value={newCustomersCount}
          sub="ce mois"
          subColor="#8B92A5"
        />
        <PilotageCard
          icon={<XIcon className="size-3.5" />}
          label="Taux d'annulation"
          value={`${cancelRate} %`}
          sub={
            cancelRateNum <= ANNULATION_TARGET_PCT
              ? `sous la cible ${ANNULATION_TARGET_PCT} %`
              : `au-dessus de la cible ${ANNULATION_TARGET_PCT} %`
          }
          subColor={cancelRateNum <= ANNULATION_TARGET_PCT ? "#9FE1CB" : "#F09595"}
        />
        <PilotageCard
          icon={<Clock className="size-3.5" />}
          label="DSO"
          value={`${dsoAvg} j`}
          sub={dsoAvg > 120 ? "à surveiller" : "délai moyen de paiement"}
          subColor={dsoAvg > 120 ? "#F09595" : "#8B92A5"}
        />
      </div>
    </div>
  );
}

function DeltaPill({ up, children }: { up: boolean; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
      style={up ? { backgroundColor: "#E1F5EE", color: "#085041" } : { backgroundColor: "#FCEBEB", color: "#791F1F" }}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {children}
    </span>
  );
}

function PeriodPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-2.5 py-1 rounded-full transition"
      style={
        active
          ? { backgroundColor: "#1A1F2E", color: "#FFFFFF" }
          : { backgroundColor: "#F1EFE8", color: "#5F5E5A" }
      }
    >
      {children}
    </Link>
  );
}

function PilotageCard({
  icon,
  label,
  value,
  sub,
  subColor,
  valueIsText = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  subColor: string;
  valueIsText?: boolean;
}) {
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: "#1A1F2E" }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: "#8B92A5" }}>
        {icon}
        <p className="text-[11px] uppercase tracking-wide">{label}</p>
      </div>
      <p
        className={
          valueIsText
            ? "text-sm font-medium leading-tight text-white"
            : "font-display text-[22px] leading-none text-white"
        }
      >
        {value}
      </p>
      <p className="text-[11px] mt-1.5" style={{ color: subColor }}>
        {sub}
      </p>
    </div>
  );
}
