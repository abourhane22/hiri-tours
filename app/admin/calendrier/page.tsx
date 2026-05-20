import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMAD } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 border-amber-200 text-amber-900",
  confirmed: "bg-atlantic-50 border-atlantic-200 text-atlantic-900",
  paid: "bg-emerald-50 border-emerald-200 text-emerald-900",
  cancelled: "bg-red-50 border-red-200 text-red-900 line-through",
  completed: "bg-sand-100 border-sand-300 text-sand-800",
};

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

export default async function CalendrierPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string; circuit?: string }> }) {
  const { y, m, circuit } = await searchParams;
  const today = new Date();
  const year = y ? parseInt(y, 10) : today.getFullYear();
  const month = m !== undefined ? parseInt(m, 10) : today.getMonth();

  const supabase = await createClient();
  const { data: circuits } = await supabase.from("circuits").select("id, title").eq("is_active", true).order("title");

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month + 2, 0);
  const startStr = dateKey(startDate);
  const endStr = dateKey(endDate);

  let query = supabase.from("reservations")
    .select("id, reference, departure_date, adults, children, status, total_amount_mad, circuits(title), customers(full_name)")
    .gte("departure_date", startStr)
    .lte("departure_date", endStr)
    .order("departure_date", { ascending: true });
  if (circuit) query = query.eq("circuit_id", circuit);

  const { data: reservations } = await query;

  const byDate: Record<string, any[]> = {};
  (reservations || []).forEach((r: any) => {
    const key = r.departure_date;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  });

  const days = getCalendarDays(year, month);
  const prevMonth = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextMonth = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  const circuitQS = circuit ? `&circuit=${circuit}` : "";
  const todayKey = dateKey(today);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <p className="eyebrow mb-2">Module 1 — Vue calendaire</p>
        <h1 className="font-display text-3xl text-ink">Calendrier des départs</h1>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Link href={`/admin/calendrier?y=${prevMonth.y}&m=${prevMonth.m}${circuitQS}`}>
              <button className="size-9 rounded-md border border-sand-300 hover:bg-sand-100 flex items-center justify-center"><ChevronLeft className="size-4" /></button>
            </Link>
            <h2 className="font-display text-xl text-ink min-w-[200px] text-center">{MONTHS_FR[month]} {year}</h2>
            <Link href={`/admin/calendrier?y=${nextMonth.y}&m=${nextMonth.m}${circuitQS}`}>
              <button className="size-9 rounded-md border border-sand-300 hover:bg-sand-100 flex items-center justify-center"><ChevronRight className="size-4" /></button>
            </Link>
            <Link href={`/admin/calendrier${circuit ? `?circuit=${circuit}` : ""}`}>
              <button className="px-3 h-9 rounded-md border border-sand-300 hover:bg-sand-100 text-sm">Aujourd&apos;hui</button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-sand-700">Année :</span>
            <div className="inline-flex gap-0.5 bg-sand-100 p-0.5 rounded-md">
              {[year - 1, year, year + 1].map(yr => (
                <Link key={yr} href={`/admin/calendrier?y=${yr}&m=${month}${circuitQS}`}
                  className={`px-3 py-1 text-sm rounded transition ${year === yr ? "bg-white shadow-sm font-medium text-ink" : "text-sand-700 hover:text-ink"}`}>
                  {yr}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="y" value={year} />
          <input type="hidden" name="m" value={month} />
          <select name="circuit" defaultValue={circuit || ""} className="h-9 rounded-md border border-sand-300 bg-white px-3 text-sm">
            <option value="">Tous les circuits</option>
            {circuits?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button type="submit" className="h-9 px-3 rounded-md bg-navy-700 text-white text-sm hover:bg-navy-800">Filtrer</button>
        </form>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b border-sand-200 bg-sand-100">
          {DAYS_FR.map((d) => <div key={d} className="px-2 py-2 text-xs uppercase tracking-wide text-sand-700 font-medium text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = dateKey(d);
            const isCurrentMonth = d.getMonth() === month;
            const isToday = key === todayKey;
            const dayReservations = byDate[key] || [];
            return (
              <div key={i} className={`min-h-[100px] border-r border-b border-sand-200 p-1.5 ${!isCurrentMonth ? "bg-sand-50/50" : ""}`}>
                <div className={`text-xs font-medium mb-1 ${isToday ? "size-6 rounded-full bg-terracotta-600 text-white flex items-center justify-center" : !isCurrentMonth ? "text-sand-400" : "text-sand-700"}`}>
                  {d.getDate()}
                </div>
                <div className="space-y-1">
                  {dayReservations.slice(0, 3).map((r: any) => (
                    <Link key={r.id} href={`/admin/reservations/${r.id}`}
                      className={`block px-1.5 py-1 rounded text-[10px] leading-tight border ${STATUS_COLORS[r.status] ?? STATUS_COLORS.pending} hover:opacity-80 truncate`}
                      title={`${r.reference} — ${r.customers?.full_name} — ${r.circuits?.title} — ${r.adults + r.children} pax`}>
                      <div className="font-mono">{r.reference}</div>
                      <div className="truncate">{r.customers?.full_name ?? "—"}</div>
                    </Link>
                  ))}
                  {dayReservations.length > 3 && (
                    <div className="text-[10px] text-sand-600 px-1.5">+{dayReservations.length - 3} autre{dayReservations.length - 3 > 1 ? "s" : ""}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5"><span className="size-3 rounded bg-amber-50 border border-amber-200" /> En attente</div>
        <div className="flex items-center gap-1.5"><span className="size-3 rounded bg-atlantic-50 border border-atlantic-200" /> Confirmée</div>
        <div className="flex items-center gap-1.5"><span className="size-3 rounded bg-emerald-50 border border-emerald-200" /> Payée</div>
        <div className="flex items-center gap-1.5"><span className="size-3 rounded bg-sand-100 border border-sand-300" /> Terminée</div>
        <div className="flex items-center gap-1.5"><span className="size-3 rounded bg-red-50 border border-red-200" /> Annulée</div>
      </div>
    </div>
  );
}
