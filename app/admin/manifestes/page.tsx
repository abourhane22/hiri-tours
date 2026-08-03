import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChevronRight, Users, Eye, Printer, Check, AlertTriangle } from "lucide-react";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstName(full?: string | null): string {
  return full ? full.trim().split(/\s+/)[0] : "";
}

function joinFr(arr: string[]): string {
  if (arr.length <= 1) return arr[0] ?? "";
  return `${arr.slice(0, -1).join(", ")} et ${arr[arr.length - 1]}`;
}

type Manifest = {
  date: string;
  circuitId: string;
  circuitTitle: string;
  departureTime: string | null;
  reservations: any[];
  totalPax: number;
};

function crewInfo(rs: any[]) {
  const allGuide = rs.every((r) => r.guide_id);
  const allDriver = rs.every((r) => r.driver_id);
  const allVehicle = rs.every((r) => r.vehicle_id);
  const fully = allGuide && allDriver && allVehicle;
  const missing: string[] = [];
  if (!allGuide) missing.push("guide");
  if (!allDriver) missing.push("chauffeur");
  if (!allVehicle) missing.push("véhicule");
  const first = rs[0] || {};
  const v = first.vehicles;
  const vehicleLabel = v
    ? [[v.make, v.model].filter(Boolean).join(" "), v.registration].filter(Boolean).join(" · ")
    : "";
  const crew = [firstName(first.guide?.full_name), firstName(first.driver?.full_name)]
    .filter(Boolean)
    .join(", ");
  const display = [crew, vehicleLabel].filter(Boolean).join(" · ") || "Équipage affecté";
  return { fully, missing, display };
}

export default async function ManifestesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = params.year ? parseInt(params.year, 10) : currentYear;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: yearsData } = await supabase
    .from("reservations")
    .select("departure_date")
    .in("status", ["confirmed", "paid", "completed"])
    .order("departure_date", { ascending: false });

  const yearsSet = new Set<number>();
  (yearsData || []).forEach((r) => yearsSet.add(new Date(r.departure_date).getFullYear()));
  if (!yearsSet.has(currentYear)) yearsSet.add(currentYear);
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  const { data: departures } = await supabase
    .from("reservations")
    .select(`id, departure_date, adults, children, reference, status, guide_id, driver_id, vehicle_id,
             circuit:circuits(id, title, category_fields),
             vehicles(registration, make, model),
             guide:staff_members!reservations_guide_id_fkey(full_name),
             driver:staff_members!reservations_driver_id_fkey(full_name)`)
    .in("status", ["confirmed", "paid", "completed"])
    .gte("departure_date", `${selectedYear}-01-01`)
    .lte("departure_date", `${selectedYear}-12-31`)
    .order("departure_date", { ascending: true });

  type MonthGroup = { month: number; manifests: Map<string, Manifest>; totalManifests: number; totalPax: number };
  const monthMap: Record<number, MonthGroup> = {};
  for (const r of departures || []) {
    const circuit = (r as any).circuit;
    if (!circuit) continue;
    const month = new Date(r.departure_date).getMonth();
    const key = `${r.departure_date}__${circuit.id}`;
    if (!monthMap[month]) monthMap[month] = { month, manifests: new Map(), totalManifests: 0, totalPax: 0 };
    if (!monthMap[month].manifests.has(key)) {
      monthMap[month].manifests.set(key, {
        date: r.departure_date,
        circuitId: circuit.id,
        circuitTitle: circuit.title,
        departureTime: circuit.category_fields?.departure_time ?? null,
        reservations: [],
        totalPax: 0,
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

  // Synthèse année
  const allManifests = months.flatMap((mg) => Array.from(mg.manifests.values()));
  const totalManifests = allManifests.length;
  const totalPax = allManifests.reduce((s, m) => s + m.totalPax, 0);

  const now = new Date();
  const todayStr = ymd(now);
  const in7Str = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  const weekUnassigned = allManifests.filter(
    (m) => m.date >= todayStr && m.date <= in7Str && !crewInfo(m.reservations).fully,
  ).length;

  const iconBtn =
    "size-[30px] shrink-0 rounded-lg border border-[#E0DACF] bg-white flex items-center justify-center text-[#6B6862] hover:text-[#1A1F2E] hover:border-[#1A1F2E] transition-colors";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">
            Opérations · Manifestes
          </p>
          <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">
            Manifestes passagers
          </h1>
        </div>
        <div className="flex gap-1.5">
          {years.map((y) => (
            <Link
              key={y}
              href={`?year=${y}`}
              className="px-2.5 h-[30px] flex items-center rounded-full text-[12px] font-medium transition"
              style={
                selectedYear === y
                  ? { backgroundColor: "#1A1F2E", color: "#fff" }
                  : { backgroundColor: "#F1EFE8", color: "#5F5E5A" }
              }
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      {/* Synthèse */}
      <p className="text-[12px] text-[#6B6862] mb-5">
        Année {selectedYear} · {totalManifests} manifeste{totalManifests > 1 ? "s" : ""} ·{" "}
        {totalPax} passager{totalPax > 1 ? "s" : ""}
        {weekUnassigned > 0 && (
          <span style={{ color: "#B25F0B" }}>
            {" "}
            · {weekUnassigned} départ{weekUnassigned > 1 ? "s" : ""} sans équipage cette
            semaine
          </span>
        )}
      </p>

      {months.length === 0 ? (
        <div className="bg-white border border-[#E5E0D7] rounded-xl p-8 text-center text-[#6B6862]">
          Aucun départ sur cette période.
        </div>
      ) : (
        months.map((mg) => {
          const manifests = Array.from(mg.manifests.values()).sort((a, b) => a.date.localeCompare(b.date));
          const isOpen = isCurrentYear && mg.month === currentMonth;
          return (
            <details
              key={mg.month}
              open={isOpen}
              className="bg-white border border-[#E5E0D7] rounded-xl mb-2.5 overflow-hidden group [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="px-4 py-3 cursor-pointer flex items-center justify-between gap-3 hover:bg-[#FDFBF7] list-none">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ChevronRight className="size-4 text-[#968F84] transition-transform group-open:rotate-90 shrink-0" />
                  <h3 className="font-display text-base text-[#1A1F2E] m-0">
                    {MONTHS[mg.month]} {selectedYear}
                  </h3>
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#F1EFE8", color: "#5F5E5A" }}
                  >
                    {mg.totalManifests} manifeste{mg.totalManifests > 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-[12px] text-[#6B6862] shrink-0">
                  {mg.totalPax} passager{mg.totalPax > 1 ? "s" : ""}
                </span>
              </summary>

              <div>
                {manifests.map((m) => {
                  const d = new Date(m.date);
                  const isToday = m.date === todayStr;
                  const isSoon = m.date >= todayStr && m.date <= in7Str;
                  const crew = crewInfo(m.reservations);
                  const viewHref = `/admin/manifestes/${m.date}/${m.circuitId}`;
                  return (
                    <div
                      key={`${m.date}_${m.circuitId}`}
                      className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-[#F1EDE5] hover:bg-[#FDFBF7]"
                    >
                      {/* Badge date */}
                      <div
                        className="size-[42px] shrink-0 rounded-lg bg-[#FAF5F0] border border-[#EBE6DC] flex flex-col items-center justify-center leading-none"
                      >
                        <span
                          className="text-[9px] tracking-wide uppercase"
                          style={{ color: isSoon ? "#C84B31" : "#968F84" }}
                        >
                          {MONTHS[d.getMonth()].slice(0, 3)}
                        </span>
                        <span className="text-[15px] font-medium text-[#1A1F2E]">
                          {d.getDate()}
                        </span>
                      </div>

                      {/* Bloc principal */}
                      <div className="flex-1 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[13.5px] text-[#1A1F2E] truncate">
                            {m.circuitTitle}
                          </span>
                          {isToday && (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                              style={{ backgroundColor: "#FAECE7", color: "#712B13" }}
                            >
                              aujourd'hui
                            </span>
                          )}
                        </div>
                        <div className="text-[11.5px] text-[#968F84] truncate">
                          {m.departureTime && <>{m.departureTime} · </>}
                          {m.reservations.length} réservation
                          {m.reservations.length > 1 ? "s" : ""} ·{" "}
                          {crew.fully ? (
                            <span style={{ color: "#58524A" }}>{crew.display}</span>
                          ) : (
                            <span className="font-medium" style={{ color: "#B25F0B" }}>
                              {joinFr(crew.missing)} à affecter
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Chips + actions */}
                      <div className="flex items-center gap-2 ml-auto">
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "#E1F5EE", color: "#085041" }}
                        >
                          <Users className="size-3" />
                          {m.totalPax} pax
                        </span>
                        {crew.fully ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#E1F5EE", color: "#085041" }}
                          >
                            <Check className="size-3" />
                            Équipage
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#FAEEDA", color: "#633806" }}
                          >
                            <AlertTriangle className="size-3" />
                            À affecter
                          </span>
                        )}
                        <Link href={viewHref} className={iconBtn} aria-label="Voir le manifeste">
                          <Eye className="size-4" />
                        </Link>
                        <Link
                          href={`${viewHref}?print=1`}
                          className={iconBtn}
                          aria-label="Imprimer le manifeste"
                        >
                          <Printer className="size-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}
