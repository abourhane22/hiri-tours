import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ChevronRight, FileText, Users } from "lucide-react";
import { formatDateShort } from "@/lib/utils";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

interface PageProps { searchParams: Promise<{ year?: string }> }

export default async function ManifestesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = params.year ? parseInt(params.year, 10) : currentYear;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: yearsData } = await supabase
    .from("reservations")
    .select("departure_date")
    .in("status", ["confirmed", "paid", "completed"])
    .order("departure_date", { ascending: false });

  const yearsSet = new Set<number>();
  (yearsData || []).forEach(r => yearsSet.add(new Date(r.departure_date).getFullYear()));
  if (!yearsSet.has(currentYear)) yearsSet.add(currentYear);
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${selectedYear}-12-31`;
  const { data: departures } = await supabase
    .from("reservations")
    .select(`id, departure_date, adults, children, reference, status,
             customer:customers(full_name),
             circuit:circuits(id, title)`)
    .in("status", ["confirmed", "paid", "completed"])
    .gte("departure_date", yearStart)
    .lte("departure_date", yearEnd)
    .order("departure_date", { ascending: true });

  type Manifest = { date: string; circuitId: string; circuitTitle: string; reservations: any[]; totalPax: number };
  type MonthGroup = { month: number; manifests: Map<string, Manifest>; totalManifests: number; totalPax: number };

  const monthMap: Record<number, MonthGroup> = {};
  for (const r of departures || []) {
    const d = new Date(r.departure_date);
    const month = d.getMonth();
    const circuit = r.circuit as any;
    if (!circuit) continue;
    const key = `${r.departure_date}__${circuit.id}`;
    if (!monthMap[month]) monthMap[month] = { month, manifests: new Map(), totalManifests: 0, totalPax: 0 };
    if (!monthMap[month].manifests.has(key)) {
      monthMap[month].manifests.set(key, {
        date: r.departure_date, circuitId: circuit.id, circuitTitle: circuit.title,
        reservations: [], totalPax: 0,
      });
      monthMap[month].totalManifests += 1;
    }
    const m = monthMap[month].manifests.get(key)!;
    m.reservations.push(r);
    m.totalPax += r.adults + r.children;
    monthMap[month].totalPax += r.adults + r.children;
  }

  const months = Object.values(monthMap).sort((a, b) => a.month - b.month);
  const currentMonth = new Date().getMonth();
  const isCurrentYear = selectedYear === currentYear;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <p className="eyebrow mb-2">Opérations</p>
        <h1 className="font-display text-3xl text-ink">Manifestes passagers</h1>
        <p className="text-sm text-sand-700 mt-1">Départs groupés par année et par mois.</p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-sand-700">Année :</span>
        <div className="inline-flex gap-0.5 bg-sand-100 p-0.5 rounded-md">
          {years.map(y => (
            <Link key={y} href={`?year=${y}`}
              className={`px-3 py-1 text-sm rounded transition ${selectedYear === y ? "bg-white shadow-sm font-medium text-ink" : "text-sand-700 hover:text-ink"}`}>
              {y}
            </Link>
          ))}
        </div>
      </div>

      {months.length === 0 ? (
        <Card><div className="p-8 text-center text-sand-700">Aucun départ programmé pour {selectedYear}.</div></Card>
      ) : (
        months.map(mg => {
          const manifests = Array.from(mg.manifests.values()).sort((a, b) => a.date.localeCompare(b.date));
          const isOpen = isCurrentYear && mg.month === currentMonth;
          return (
            <details key={mg.month} open={isOpen}
              className="bg-white border border-sand-200 rounded-lg mb-3 overflow-hidden group [&_summary::-webkit-details-marker]:hidden">
              <summary className="px-4 py-3 bg-sand-50 cursor-pointer flex items-center justify-between hover:bg-sand-100 list-none">
                <div className="flex items-center gap-3 flex-wrap">
                  <ChevronRight className="size-4 text-sand-600 transition-transform group-open:rotate-90" />
                  <h3 className="font-display text-lg text-ink m-0">{MONTHS[mg.month]} {selectedYear}</h3>
                  <span className="text-xs text-sand-700 bg-white px-2 py-0.5 rounded-full border border-sand-200">
                    {mg.totalManifests} manifeste{mg.totalManifests > 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-sand-600">{mg.totalPax} passager{mg.totalPax > 1 ? "s" : ""}</span>
                </div>
              </summary>
              <div className="divide-y divide-sand-100">
                {manifests.map(m => (
                  <Link key={`${m.date}_${m.circuitId}`}
                    href={`/admin/manifestes/${m.date}/${m.circuitId}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-sand-50/50">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-md bg-atlantic-50 text-atlantic-700 flex flex-col items-center justify-center leading-none flex-shrink-0">
                        <span className="text-[10px] uppercase">{MONTHS[new Date(m.date).getMonth()].slice(0, 3)}</span>
                        <span className="text-sm font-medium">{new Date(m.date).getDate()}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-ink">{m.circuitTitle}</div>
                        <div className="text-xs text-sand-700">{formatDateShort(m.date)} · {m.reservations.length} réservation{m.reservations.length > 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-ink flex items-center gap-1"><Users className="size-3.5" />{m.totalPax}</div>
                      <FileText className="size-4 text-sand-500" />
                    </div>
                  </Link>
                ))}
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}
