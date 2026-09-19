"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { loadMonthAvailability, type MonthAvailability } from "@/app/admin/reservations/new/data-actions";
import { findSeasonForDate } from "@/lib/pricing";

export type CalendarSeason = { name: string; starts_on: string; ends_on: string; price_multiplier: number | string };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DOW = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

export type DayStock = { quota: number; sold: number; released: boolean };
export type DayInfo = {
  /** Jour couvert par un allotement actif mais fermé (hors weekdays). */
  noDeparture: boolean;
  stock: DayStock | null;
  seasonMultiplier: number;
  seasonName: string | null;
};

/** État d'un jour d'après le cache du mois — partagé avec le formulaire (ligne « places restantes »). */
export function dayInfo(date: string, month: MonthAvailability | undefined, seasons: CalendarSeason[]): DayInfo {
  const season = findSeasonForDate(date, seasons);
  const dow = new Date(date + "T00:00:00").getDay();
  let noDeparture = false;
  if (month) {
    const covering = month.allotments.filter((a) => a.starts_on <= date && a.ends_on >= date);
    if (covering.length > 0 && covering.every((a) => a.weekdays && a.weekdays.length > 0 && !a.weekdays.includes(dow))) {
      noDeparture = true;
    }
  }
  return {
    noDeparture,
    stock: month?.days[date] ?? null,
    seasonMultiplier: season ? Number(season.price_multiplier) : 1,
    seasonName: season?.name ?? null,
  };
}

export function stockTone(stock: DayStock): "ok" | "low" | "full" | "released" {
  if (stock.released) return "released";
  const remaining = stock.quota - stock.sold;
  if (remaining <= 0) return "full";
  return remaining / Math.max(1, stock.quota) > 0.3 ? "ok" : "low";
}
const TONE_COLOR: Record<ReturnType<typeof stockTone>, string> = { ok: "#0F8A5F", low: "#D98324", full: "#B42318", released: "#968F84" };

/**
 * Calendrier de départ : mois navigable, un SEUL chargement serveur par mois
 * affiché (cache), jours passés désactivés, jours fermés « pas de départ »,
 * pastille de stock depuis allotment_days, fond teinté en saison > 1.
 */
export function AvailabilityCalendar({
  productId,
  seasons,
  value,
  onChange,
  onMonthData,
}: {
  productId: string;
  seasons: CalendarSeason[];
  value: string;
  onChange: (date: string) => void;
  /** Remonte le cache au parent pour la ligne « places restantes ». */
  onMonthData?: (key: string, data: MonthAvailability) => void;
}) {
  const today = new Date();
  const todayStr = ymd(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const initial = value && value >= todayStr ? new Date(value + "T00:00:00") : today;
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth() + 1);
  const [cache, setCache] = useState<Record<string, MonthAvailability>>({});
  const [loading, setLoading] = useState(false);

  const key = `${productId}:${year}-${pad(month)}`;
  const data = cache[key];

  useEffect(() => {
    if (!productId || cache[key]) return;
    let cancelled = false;
    setLoading(true);
    loadMonthAvailability(productId, year, month)
      .then((d) => {
        if (cancelled) return;
        setCache((c) => ({ ...c, [key]: d }));
        onMonthData?.(key, d);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, year, month]);

  // Produit changé → le cache ne vaut plus (clé préfixée, mais on libère la mémoire).
  useEffect(() => {
    setCache({});
  }, [productId]);

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const offset = (first.getDay() + 6) % 7; // lundi en premier
    const daysInMonth = new Date(year, month, 0).getDate();
    const out: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= daysInMonth; d++) out.push(ymd(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  function shift(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }
  const canGoBack = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1);

  return (
    <div className="rounded-xl border border-[#E5E0D7] bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={!canGoBack}
          className="inline-flex size-8 items-center justify-center rounded-md text-[#6B6862] hover:bg-[#FBF9F5] disabled:opacity-30"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="font-display text-[15px] text-[#1A1F2E] flex items-center gap-2">
          {MONTHS[month - 1]} {year}
          {loading && <Loader2 className="size-3.5 animate-spin text-[#968F84]" />}
        </div>
        <button type="button" onClick={() => shift(1)} className="inline-flex size-8 items-center justify-center rounded-md text-[#6B6862] hover:bg-[#FBF9F5]" aria-label="Mois suivant">
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW.map((d) => (
          <div key={d} className="text-[10px] uppercase tracking-wide text-[#968F84] py-1">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const past = date < todayStr;
          const info = dayInfo(date, data, seasons);
          const selected = date === value;
          const disabled = past || info.noDeparture;
          const tone = info.stock ? stockTone(info.stock) : null;
          const inSeason = info.seasonMultiplier > 1;
          const title = [
            info.seasonName ? `${info.seasonName} ×${info.seasonMultiplier}` : null,
            info.noDeparture ? "Pas de départ ce jour" : null,
            info.stock ? (info.stock.released ? "Stock libéré" : `${Math.max(0, info.stock.quota - info.stock.sold)} / ${info.stock.quota} places`) : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => onChange(date)}
              title={title || undefined}
              aria-pressed={selected}
              className={`relative h-10 rounded-lg text-[13px] tabular-nums transition-colors ${
                selected
                  ? "bg-[#1A1F2E] text-white"
                  : disabled
                    ? "text-[#C9C4BA] cursor-not-allowed"
                    : "text-[#1A1F2E] hover:bg-[#F1EFE8]"
              } ${info.noDeparture && !past ? "bg-[repeating-linear-gradient(135deg,transparent,transparent_3px,#F1EFE8_3px,#F1EFE8_4px)]" : ""}`}
              style={!selected && !disabled && inSeason ? { backgroundColor: "#FBEBE6" } : undefined}
            >
              {Number(date.slice(8, 10))}
              {tone && !past && (
                <span
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full"
                  style={{ backgroundColor: selected ? "#fff" : TONE_COLOR[tone] }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-[#6B6862]">
        <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ backgroundColor: TONE_COLOR.ok }} /> places</span>
        <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ backgroundColor: TONE_COLOR.low }} /> ≤ 30 % restant</span>
        <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ backgroundColor: TONE_COLOR.full }} /> complet</span>
        <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ backgroundColor: "#FBEBE6" }} /> saison ×&gt;1</span>
        <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,transparent,transparent_2px,#D8D2C6_2px,#D8D2C6_3px)]" /> pas de départ</span>
      </div>
    </div>
  );
}
