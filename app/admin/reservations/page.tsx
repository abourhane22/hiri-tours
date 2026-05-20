import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, ChevronRight } from "lucide-react";
import { formatMAD, formatDateShort } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  pending:   { label: "En attente", classes: "bg-purple-50 text-purple-800 border border-purple-200" },
  confirmed: { label: "Confirmée",  classes: "bg-emerald-50 text-emerald-800 border border-emerald-200" },
  paid:      { label: "Payée",      classes: "bg-emerald-100 text-emerald-900 border border-emerald-300" },
  completed: { label: "Terminée",   classes: "bg-atlantic-50 text-atlantic-800 border border-atlantic-200" },
  cancelled: { label: "Annulée",    classes: "bg-red-50 text-red-800 border border-red-200" },
};
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

interface PageProps {
  searchParams: Promise<{ period?: string; status?: string; q?: string; from?: string; to?: string }>;
}

export default async function ReservationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = params.period || "all";
  const status = params.status || "";
  const q = params.q || "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const now = new Date();
  let dateFrom: string | null = null;
  let dateTo: string | null = null;

  if (period === "this_week") {
    const day = now.getDay() || 7;
    const monday = new Date(now); monday.setDate(now.getDate() - day + 1);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    dateFrom = monday.toISOString().split("T")[0];
    dateTo = sunday.toISOString().split("T")[0];
  } else if (period === "this_month") {
    dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    dateTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${lastDay}`;
  } else if (period === "this_year") {
    dateFrom = `${now.getFullYear()}-01-01`;
    dateTo = `${now.getFullYear()}-12-31`;
  } else if (period === "custom") {
    dateFrom = params.from || null;
    dateTo = params.to || null;
  }

  let query = supabase
    .from("reservations")
    .select(`id, reference, departure_date, adults, children, total_amount_mad, status,
             customer:customers(id, full_name, country),
             circuit:circuits(id, title)`)
    .order("departure_date", { ascending: false })
    .limit(500);

  if (dateFrom) query = query.gte("departure_date", dateFrom);
  if (dateTo)   query = query.lte("departure_date", dateTo);
  if (status)   query = query.eq("status", status);
  if (q)        query = query.ilike("reference", `%${q}%`);

  const { data: reservations } = await query;
  const items = reservations || [];

  type Group = { key: string; year: number; month: number; items: typeof items; total: number; adults: number; children: number };
  const groupsMap: Record<string, Group> = {};
  for (const r of items) {
    const d = new Date(r.departure_date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!groupsMap[key]) groupsMap[key] = { key, year: d.getFullYear(), month: d.getMonth(), items: [], total: 0, adults: 0, children: 0 };
    groupsMap[key].items.push(r);
    groupsMap[key].total += Number(r.total_amount_mad);
    groupsMap[key].adults += r.adults;
    groupsMap[key].children += r.children;
  }
  const groups = Object.values(groupsMap).sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  const currentKey = `${now.getFullYear()}-${now.getMonth()}`;

  const buildLink = (overrides: Record<string, string>) => {
    const sp = new URLSearchParams();
    const merged = { period, status, q, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all") sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `?${s}` : "/admin/reservations";
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">Ventes</p>
          <h1 className="font-display text-3xl text-ink">Réservations</h1>
          <p className="text-sm text-sand-700 mt-1">{items.length} réservation{items.length > 1 ? "s" : ""}</p>
        </div>
        <Link href="/admin/reservations/new"><Button><Plus className="size-4" />Nouvelle réservation</Button></Link>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg p-3 mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-0.5 bg-sand-100 p-0.5 rounded-md shrink-0">
          {[
            { v: "all",        l: "Tous" },
            { v: "this_week",  l: "Cette semaine" },
            { v: "this_month", l: "Ce mois" },
            { v: "this_year",  l: "Cette année" },
          ].map(p => (
            <Link key={p.v} href={buildLink({ period: p.v })}
              className={`px-3 py-1 text-sm rounded transition ${period === p.v ? "bg-white shadow-sm font-medium text-ink" : "text-sand-700 hover:text-ink"}`}>
              {p.l}
            </Link>
          ))}
        </div>

        <form action="/admin/reservations" method="get" className="flex flex-wrap items-center gap-2 flex-1">
          {period !== "all" && <input type="hidden" name="period" value={period} />}
          <select name="status" defaultValue={status}
            className="text-sm rounded border border-sand-300 px-3 py-1.5 bg-white h-9">
            <option value="">Tous statuts</option>
            <option value="pending">En attente</option>
            <option value="confirmed">Confirmée</option>
            <option value="paid">Payée</option>
            <option value="completed">Terminée</option>
            <option value="cancelled">Annulée</option>
          </select>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-500 pointer-events-none" />
            <input name="q" defaultValue={q} placeholder="Référence, client…"
              className="w-full h-9 pl-8 pr-3 text-sm rounded border border-sand-300" />
          </div>
          <button type="submit" className="h-9 px-3 text-sm rounded border border-sand-300 bg-white hover:bg-sand-50">
            Filtrer
          </button>
        </form>
      </div>

      {groups.length === 0 ? (
        <Card><div className="p-8 text-center text-sand-700">Aucune réservation trouvée avec ces filtres.</div></Card>
      ) : (
        groups.map(g => (
          <details key={g.key} open={g.key === currentKey || groups.length <= 2}
            className="bg-white border border-sand-200 rounded-lg mb-3 overflow-hidden group [&_summary::-webkit-details-marker]:hidden">
            <summary className="px-4 py-3 bg-sand-50 cursor-pointer flex items-center justify-between hover:bg-sand-100 list-none">
              <div className="flex items-center gap-3 flex-wrap">
                <ChevronRight className="size-4 text-sand-600 transition-transform group-open:rotate-90" />
                <h3 className="font-display text-lg text-ink m-0">{MONTHS[g.month]} {g.year}</h3>
                <span className="text-xs text-sand-700 bg-white px-2 py-0.5 rounded-full border border-sand-200">
                  {g.items.length} réservation{g.items.length > 1 ? "s" : ""}
                </span>
                <span className="text-xs text-sand-600">{g.adults} adulte{g.adults > 1 ? "s" : ""} · {g.children} enfant{g.children > 1 ? "s" : ""}</span>
              </div>
              <div className="text-sm font-medium text-ink">{formatMAD(g.total)}</div>
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sand-50/50 border-y border-sand-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Référence</th>
                    <th className="text-left px-3 py-2 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Date</th>
                    <th className="text-left px-3 py-2 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Client</th>
                    <th className="text-left px-3 py-2 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Circuit</th>
                    <th className="text-center px-3 py-2 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Pax</th>
                    <th className="text-center px-3 py-2 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Statut</th>
                    <th className="text-right px-4 py-2 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map(r => {
                    const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                    const customer = r.customer as any;
                    const circuit = r.circuit as any;
                    return (
                      <tr key={r.id} className="border-t border-sand-100 hover:bg-sand-50/50">
                        <td className="px-4 py-3">
                          <Link href={`/admin/reservations/${r.id}`} className="font-mono text-xs text-sand-700 hover:text-terracotta-700">{r.reference}</Link>
                        </td>
                        <td className="px-3 py-3 text-sand-800 whitespace-nowrap">{formatDateShort(r.departure_date)}</td>
                        <td className="px-3 py-3">
                          <Link href={`/admin/reservations/${r.id}`} className="text-ink hover:text-terracotta-700">{customer?.full_name || "—"}</Link>
                        </td>
                        <td className="px-3 py-3 text-sand-700 text-xs">{circuit?.title || "—"}</td>
                        <td className="px-3 py-3 text-center text-sand-800 whitespace-nowrap">{r.adults}/{r.children}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.classes}`}>{cfg.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">{formatMAD(r.total_amount_mad)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        ))
      )}
    </div>
  );
}
