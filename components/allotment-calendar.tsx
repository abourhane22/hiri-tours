import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayState, DAY_STATE_STYLE, WEEKDAY_SHORT, WEEKDAYS_MONDAY_FIRST } from "@/lib/allotments";
import type { AllotmentDay } from "@/lib/types";

// Calendrier mensuel d'un allotement : une case par jour, quota / vendu /
// restant, code couleur par état. Composant serveur pur : les données sont
// déjà chargées, la navigation passe par l'URL (?m=YYYY-MM&day=YYYY-MM-DD).

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthKey(d);
}

export function monthBounds(key: string): { start: string; end: string } {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function AllotmentCalendar({
  month,
  days,
  periodStart,
  periodEnd,
  selectedDay,
  baseHref,
  today,
}: {
  month: string; // YYYY-MM
  days: AllotmentDay[];
  periodStart: string;
  periodEnd: string;
  selectedDay: string | null;
  baseHref: string;
  today: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7; // lundi en tête
  const byDay = new Map(days.map((d) => [d.day, d]));

  const cells: (string | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const canPrev = shiftMonth(month, -1) >= periodStart.slice(0, 7);
  const canNext = shiftMonth(month, 1) <= periodEnd.slice(0, 7);
  const link = (m: string, day?: string) => `${baseHref}?m=${m}${day ? `&day=${day}` : ""}`;

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <Link
          href={link(shiftMonth(month, -1))}
          aria-disabled={!canPrev}
          className={`inline-flex size-8 items-center justify-center rounded-md border border-[#E5E0D7] bg-white text-[#6B6862] hover:bg-[#FAF5F0] ${canPrev ? "" : "pointer-events-none opacity-40"}`}
        >
          <ChevronLeft className="size-4" />
        </Link>
        <span className="font-display text-[17px] text-[#1A1F2E] capitalize">
          {MONTHS_FR[m - 1]} {y}
        </span>
        <Link
          href={link(shiftMonth(month, 1))}
          aria-disabled={!canNext}
          className={`inline-flex size-8 items-center justify-center rounded-md border border-[#E5E0D7] bg-white text-[#6B6862] hover:bg-[#FAF5F0] ${canNext ? "" : "pointer-events-none opacity-40"}`}
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* En-têtes */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS_MONDAY_FIRST.map((d) => (
          <div key={d} className="text-center text-[10px] uppercase tracking-wide text-[#968F84] font-medium py-1">
            {WEEKDAY_SHORT[d]}
          </div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dayStr, i) => {
          if (!dayStr) return <div key={`b-${i}`} className="h-[68px]" />;
          const row = byDay.get(dayStr);
          const inPeriod = dayStr >= periodStart && dayStr <= periodEnd;
          const isPast = dayStr < today;
          const isToday = dayStr === today;
          const isSelected = dayStr === selectedDay;
          const num = Number(dayStr.slice(-2));

          if (!row) {
            // Hors période, ou jour de la semaine non ouvert : aucun compteur.
            return (
              <div
                key={dayStr}
                className={`h-[68px] rounded-lg border p-1.5 text-[11px] ${
                  inPeriod ? "border-dashed border-[#E0DACF] text-[#C9C4BA]" : "border-transparent text-[#DDD8CE]"
                }`}
                title={inPeriod ? "Jour non ouvert (jour de la semaine décoché)" : "Hors période"}
              >
                {num}
              </div>
            );
          }

          const st = dayState(row);
          const style = DAY_STATE_STYLE[st];
          const remaining = Math.max(0, row.quota - row.sold);
          return (
            <Link
              key={dayStr}
              href={link(month, dayStr)}
              className={`h-[68px] rounded-lg border p-1.5 flex flex-col justify-between transition-shadow hover:shadow-sm ${
                isSelected ? "ring-2 ring-[#1A1F2E] ring-offset-1" : ""
              } ${isPast ? "opacity-60" : ""}`}
              style={{
                backgroundColor: style.bg,
                borderColor: isToday ? "#1A1F2E" : "transparent",
                backgroundImage: st === "released"
                  ? "repeating-linear-gradient(135deg, transparent 0 6px, rgba(150,143,132,0.18) 6px 8px)"
                  : undefined,
              }}
              title={`${dayStr} · ${style.label} · ${row.sold}/${row.quota} vendu${row.sold > 1 ? "s" : ""}`}
            >
              <span className="text-[11px] font-medium tabular-nums" style={{ color: style.color }}>
                {num}
              </span>
              <span className="leading-tight">
                <span className="block text-[12px] font-medium tabular-nums" style={{ color: style.color }}>
                  {row.sold}/{row.quota}
                </span>
                <span className="block text-[10px] tabular-nums" style={{ color: style.color, opacity: 0.85 }}>
                  {st === "released" ? "libéré" : st === "full" ? "complet" : `${remaining} rest.`}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11px] text-[#6B6862]">
        {(["ok", "low", "full", "released"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ backgroundColor: DAY_STATE_STYLE[k].bg, border: `1px solid ${DAY_STATE_STYLE[k].color}33` }} />
            {DAY_STATE_STYLE[k].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-dashed border-[#C9C4BA]" /> Jour non ouvert
        </span>
      </div>
    </div>
  );
}
