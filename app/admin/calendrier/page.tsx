import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarDayCell, type DayItem } from "@/components/calendar-day-cell";
import { CalendarCircuitSelect } from "@/components/calendar-circuit-select";

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: Date[] = [];
  for (let i = startOffset; i > 0; i--) days.push(new Date(year, month, 1 - i));
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= lastDay; d++) days.push(new Date(year, month, d));
  while (days.length < 42) {
    const last = days[days.length - 1];
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return days;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string; circuit?: string }>;
}) {
  const { y, m, circuit } = await searchParams;
  const today = new Date();
  const year = y ? parseInt(y, 10) : today.getFullYear();
  const month = m !== undefined ? parseInt(m, 10) : today.getMonth();

  const supabase = await createClient();
  const { data: circuits } = await supabase
    .from("circuits")
    .select("id, title")
    .eq("is_active", true)
    .order("title");

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month + 2, 0);

  let query = supabase
    .from("reservations")
    .select("id, reference, departure_date, adults, children, status, circuits(title), customers(full_name)")
    .gte("departure_date", dateKey(startDate))
    .lte("departure_date", dateKey(endDate))
    .order("departure_date", { ascending: true });
  if (circuit) query = query.eq("circuit_id", circuit);

  const { data: reservations } = await query;

  const byDate: Record<string, DayItem[]> = {};
  (reservations || []).forEach((r: any) => {
    (byDate[r.departure_date] ||= []).push({
      id: r.id,
      status: r.status,
      title: r.circuits?.title ?? "—",
      pax: (r.adults || 0) + (r.children || 0),
      reference: r.reference,
      client: r.customers?.full_name ?? "—",
    });
  });

  // Synthèse du mois affiché (après filtre circuit).
  const monthRes = (reservations || []).filter((r: any) => {
    const d = new Date(r.departure_date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const activeRes = monthRes.filter((r: any) => r.status !== "cancelled");
  const departsCount = activeRes.length;
  const paxCount = activeRes.reduce((s: number, r: any) => s + (r.adults || 0) + (r.children || 0), 0);
  const cancelCount = monthRes.filter((r: any) => r.status === "cancelled").length;

  const days = getCalendarDays(year, month);
  const prevMonth = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextMonth = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };
  const circuitQS = circuit ? `&circuit=${circuit}` : "";
  const todayKey = dateKey(today);

  const navBtn =
    "size-[30px] shrink-0 rounded-lg border border-[#E0DACF] bg-white flex items-center justify-center text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-5">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">
          Opérations · Calendrier
        </p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">
          Calendrier des départs
        </h1>
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/admin/calendrier?y=${prevMonth.y}&m=${prevMonth.m}${circuitQS}`} className={navBtn}>
            <ChevronLeft className="size-4" />
          </Link>
          <h2 className="font-display text-xl text-[#1A1F2E] min-w-[160px] text-center">
            {MONTHS_FR[month]} {year}
          </h2>
          <Link href={`/admin/calendrier?y=${nextMonth.y}&m=${nextMonth.m}${circuitQS}`} className={navBtn}>
            <ChevronRight className="size-4" />
          </Link>
          <Link
            href={`/admin/calendrier${circuit ? `?circuit=${circuit}` : ""}`}
            className="h-[30px] px-3 rounded-lg border border-[#E0DACF] bg-white flex items-center text-[12px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors"
          >
            Aujourd&apos;hui
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {[year - 1, year, year + 1].map((yr) => (
              <Link
                key={yr}
                href={`/admin/calendrier?y=${yr}&m=${month}${circuitQS}`}
                className="px-2.5 h-[30px] flex items-center rounded-full text-[12px] font-medium transition"
                style={
                  year === yr
                    ? { backgroundColor: "#1A1F2E", color: "#fff" }
                    : { backgroundColor: "#F1EFE8", color: "#5F5E5A" }
                }
              >
                {yr}
              </Link>
            ))}
          </div>
          <CalendarCircuitSelect
            circuits={(circuits as any) || []}
            current={circuit || ""}
            year={year}
            month={month}
          />
        </div>
      </div>

      {/* Synthèse */}
      <p className="text-[12px] text-[#6B6862] mt-3 mb-4">
        {departsCount} départ{departsCount > 1 ? "s" : ""} · {paxCount} passager
        {paxCount > 1 ? "s" : ""} ce mois
        {cancelCount > 0 && (
          <span style={{ color: "#B4AC9E" }}>
            {" "}
            · {cancelCount} annulation{cancelCount > 1 ? "s" : ""}
          </span>
        )}
      </p>

      {/* En-têtes jours */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DAYS_FR.map((d) => (
          <div
            key={d}
            className="text-[10px] tracking-wider uppercase text-[#968F84] text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const key = dateKey(d);
          return (
            <CalendarDayCell
              key={i}
              day={d.getDate()}
              isCurrentMonth={d.getMonth() === month}
              isToday={key === todayKey}
              isWeekend={d.getDay() === 0 || d.getDay() === 6}
              items={byDate[key] || []}
            />
          );
        })}
      </div>

      {/* Légende */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#6B6862]">
        <LegendSquare color="#0F6E56" label="Payée" />
        <LegendSquare color="#0C6B8A" label="Confirmée" />
        <LegendSquare color="#D98324" label="Demande" />
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ backgroundColor: "#C9C4BA" }} />
          <s>Annulée</s>
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span
            className="inline-block text-[10px] text-white rounded-full px-1.5"
            style={{ backgroundColor: "#C84B31" }}
          >
            {today.getDate()}
          </span>
          Aujourd&apos;hui
        </span>
      </div>
    </div>
  );
}

function LegendSquare({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
