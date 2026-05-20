import { PieChart, TrendingUp, Clock, Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TargetEditor } from "./target-editor";

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}
function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}
function formatMad(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount);
}

export default async function PilotagePage() {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  const [companyResult, reservationsResult] = await Promise.all([
    supabase.from("company_settings").select("annual_revenue_target_mad").limit(1).maybeSingle(),
    supabase
      .from("reservations")
      .select("total_amount_mad, status, departure_date")
      .gte("departure_date", yearStart.toISOString().slice(0, 10))
      .lte("departure_date", yearEnd.toISOString().slice(0, 10))
      .neq("status", "cancelled"),
  ]);

  const annualTarget = Number((companyResult.data as any)?.annual_revenue_target_mad ?? 600000);
  const reservations = (reservationsResult.data ?? []) as any[];
  const ytdRevenue = reservations.reduce((s, r) => s + Number(r.total_amount_mad), 0);
  const progressPct = annualTarget > 0 ? Math.round((ytdRevenue / annualTarget) * 100) : 0;

  // Rythme nominal (proratisation linéaire)
  const dayOfYear = Math.ceil((now.getTime() - yearStart.getTime()) / 86400000);
  const totalDaysInYear = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
  const proratedExpected = (annualTarget * dayOfYear) / totalDaysInYear;
  const proratedPct = Math.round((proratedExpected / annualTarget) * 100);
  const gap = ytdRevenue - proratedExpected;
  const gapPct = proratedExpected > 0 ? Math.round((gap / proratedExpected) * 100) : 0;

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div>
        <p className="text-sm text-stone-500">Finance · Pilotage</p>
        <h1 className="font-serif text-3xl text-navy-900 mt-1">Objectifs de pilotage</h1>
        <p className="text-sm text-stone-600 mt-2">
          Définissez les cibles de l'agence et suivez votre rythme par rapport à elles.
        </p>
      </div>

      <div>
        <p className="text-xs text-stone-400 uppercase tracking-wider mb-3">Chiffre d'affaires</p>

        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="font-medium">Objectif CA annuel · {year}</p>
              <p className="text-xs text-stone-500 mt-0.5">
                Cible totale à atteindre sur l'année calendaire.
              </p>
            </div>
            <TargetEditor currentTarget={annualTarget} />
          </div>

          <div className="flex items-baseline gap-2 mb-4">
            <p className="font-serif text-4xl text-navy-900">{formatMad(annualTarget)}</p>
            <p className="text-sm text-stone-500">MAD</p>
          </div>

          <div className="h-2 bg-stone-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, progressPct)}%`,
                backgroundColor: "#C84B31",
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-stone-500 mb-0.5">Réalisé YTD</p>
              <p className="font-medium">
                {formatMad(ytdRevenue)} MAD{" "}
                <span className="text-stone-500 font-normal">· {progressPct} %</span>
              </p>
            </div>
            <div>
              <p className="text-stone-500 mb-0.5">Rythme nominal</p>
              <p className="font-medium">
                {formatMad(Math.round(proratedExpected))} MAD{" "}
                <span className="text-stone-500 font-normal">· {proratedPct} %</span>
              </p>
            </div>
            <div>
              <p className="text-stone-500 mb-0.5">Écart au rythme</p>
              <p className={`font-medium ${gap < 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {gap >= 0 ? "+" : ""}
                {formatMad(Math.round(gap))} MAD{" "}
                <span className="font-normal">
                  · {gap >= 0 ? "+" : ""}
                  {gapPct} %
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs text-stone-400 uppercase tracking-wider mb-3">
          Rentabilité · à venir
        </p>
        <div className="grid grid-cols-2 gap-3">
          <PlaceholderCard
            Icon={PieChart}
            title="Marge brute cible"
            description="% du CA après coûts directs (carburant, droits d'entrée, salaires guides)."
          />
          <PlaceholderCard
            Icon={TrendingUp}
            title="Résultat net cible"
            description="Résultat après toutes charges, fixé en MAD ou en % du CA."
          />
        </div>
      </div>

      <div>
        <p className="text-xs text-stone-400 uppercase tracking-wider mb-3">Gestion · à venir</p>
        <div className="grid grid-cols-2 gap-3">
          <PlaceholderCard
            Icon={Clock}
            title="DSO cible"
            description="Délai moyen de paiement clients à ne pas dépasser, en jours."
          />
          <PlaceholderCard
            Icon={Ban}
            title="Taux d'annulation max"
            description="% maximum de réservations annulées sur 12 mois glissants."
          />
        </div>
      </div>
    </div>
  );
}

function PlaceholderCard({
  Icon,
  title,
  description,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: "#1A1F2E", color: "#FFFFFF" }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="text-xs" style={{ color: "#9CA3AF" }}>
        {description}
      </p>
    </div>
  );
}
