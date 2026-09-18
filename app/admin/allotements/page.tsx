import Link from "next/link";
import { Plus, CalendarRange, Building2, Home } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort } from "@/lib/utils";
import { formatWeekdays, ON_EXHAUSTED_LABEL } from "@/lib/allotments";
import { KpiCard } from "@/components/kpi-card";
import type { Allotment } from "@/lib/types";

type Row = Allotment & {
  circuits: { title: string } | { title: string }[] | null;
  supplier_contracts:
    | { label: string; suppliers: { name: string } | { name: string }[] | null }
    | { label: string; suppliers: { name: string } | { name: string }[] | null }[]
    | null;
};
type DayAgg = { allotment_id: string; quota: number; sold: number; released: boolean; day: string };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : v ?? null);

export default async function AllotementsPage({ searchParams }: { searchParams: Promise<{ inactifs?: string }> }) {
  const { inactifs } = await searchParams;
  const showInactive = inactifs === "1";
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const supabase = await createClient();
  const [{ data: rows, error }, { data: dayRows }] = await Promise.all([
    supabase
      .from("allotments")
      .select("*, circuits(title), supplier_contracts(label, suppliers(name))")
      .order("starts_on", { ascending: false }),
    supabase.from("allotment_days").select("allotment_id, quota, sold, released, day").gte("day", today),
  ]);
  if (error) console.error("[allotements] chargement :", error);

  const all = (rows ?? []) as unknown as Row[];
  const days = (dayRows ?? []) as DayAgg[];

  // Agrégats FUTURS par allotement (jours à venir non libérés).
  const agg = new Map<string, { quota: number; sold: number; days: number; full: number; released: number }>();
  for (const d of days) {
    const a = agg.get(d.allotment_id) ?? { quota: 0, sold: 0, days: 0, full: 0, released: 0 };
    if (d.released) a.released += 1;
    else {
      a.quota += d.quota;
      a.sold += d.sold;
      a.days += 1;
      if (d.sold >= d.quota) a.full += 1;
    }
    agg.set(d.allotment_id, a);
  }

  const active = all.filter((a) => a.is_active);
  const totals = Array.from(agg.values()).reduce(
    (s, a) => ({ quota: s.quota + a.quota, sold: s.sold + a.sold, full: s.full + a.full, days: s.days + a.days }),
    { quota: 0, sold: 0, full: 0, days: 0 },
  );
  const list = showInactive ? all : active;

  const th = "px-3 py-2.5 text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A]";
  const chip = (isActive: boolean) =>
    `inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition-colors ${
      isActive ? "bg-[#1A1F2E] text-white border-[#1A1F2E]" : "bg-white text-[#58524A] border-[#E0DACF] hover:bg-[#FBF9F5]"
    }`;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Ressources · Allotements</p>
          <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Allotements</h1>
          <p className="text-[12px] text-[#6B6862] mt-1">
            Capacité par jour et par produit — capacité propre ou contrat fournisseur · au {now.toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Link
          href="/admin/allotements/new"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-4 text-sm font-medium text-white hover:bg-[#2A3142] transition-colors"
        >
          <Plus className="size-4" /> Nouvel allotement
        </Link>
      </div>

      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <KpiCard label="Allotements actifs" value={String(active.length)} sub={`${all.length} au total`} />
        <KpiCard label="Jours pilotés à venir" value={String(totals.days)} sub="compteurs ouverts, non libérés" />
        <KpiCard
          label="Places restantes"
          value={String(Math.max(0, totals.quota - totals.sold))}
          accent="ocean"
          sub={`${totals.sold} vendues sur ${totals.quota}`}
        />
        <KpiCard label="Départs complets" value={String(totals.full)} accent={totals.full > 0 ? "amber" : undefined} sub="jours à venir au quota" />
      </div>

      <div className="bg-white border border-[#E5E0D7] rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin/allotements" className={chip(!showInactive)}>Actifs</Link>
        <Link href="/admin/allotements?inactifs=1" className={chip(showInactive)}>Inclure les désactivés</Link>
      </div>

      <div className="bg-white border border-[#E5E0D7] rounded-xl overflow-hidden">
        {list.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarRange className="size-8 mx-auto text-[#C9C4BA] mb-3" />
            <p className="text-[14px] text-[#1A1F2E]">Aucun allotement{showInactive ? "" : " actif"}.</p>
            <p className="text-[12px] text-[#968F84] mt-1 max-w-md mx-auto">
              Sans allotement, un produit se vend sans contrôle du cumul des réservations par départ. Créez-en un —
              capacité propre pour vos excursions maison, contrat pour les places négociées.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
                <tr>
                  <th className={`${th} text-left`}>Produit</th>
                  <th className={`${th} text-left`}>Allotement</th>
                  <th className={`${th} text-left`}>Origine</th>
                  <th className={`${th} text-left`}>Période</th>
                  <th className={`${th} text-right`}>Quota / j</th>
                  <th className={`${th} text-right`}>Restant à venir</th>
                  <th className={`${th} text-left`}>Release</th>
                  <th className={`${th} text-left`}>Épuisement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {list.map((a) => {
                  const product = one(a.circuits);
                  const contract = one(a.supplier_contracts);
                  const supplier = contract ? one(contract.suppliers) : null;
                  const g = agg.get(a.id);
                  const remaining = g ? Math.max(0, g.quota - g.sold) : null;
                  return (
                    <tr key={a.id} className={`hover:bg-[#FBF9F5] ${a.is_active ? "" : "opacity-60"}`}>
                      <td className="px-3 py-2.5 text-[#1A1F2E] font-medium">{product?.title ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/admin/allotements/${a.id}`} className="text-[#1A1F2E] hover:text-[#C84B31]">
                          {a.label}
                        </Link>
                        {!a.is_active && <span className="block text-[11px] text-[#B25F0B]">Désactivé</span>}
                        <span className="block text-[11px] text-[#968F84]">{formatWeekdays(a.weekdays)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[#6B6862]">
                        {a.contract_id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="size-3.5 text-[#968F84]" />
                            {supplier?.name ?? "Fournisseur"} · {contract?.label ?? "contrat"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <Home className="size-3.5 text-[#968F84]" /> Capacité propre
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[#6B6862] tabular-nums whitespace-nowrap">
                        {formatDateShort(a.starts_on)} → {formatDateShort(a.ends_on)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a.quota_per_day}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {remaining === null ? (
                          <span className="text-[#968F84]">—</span>
                        ) : (
                          <span className="font-medium" style={{ color: remaining === 0 ? "#791F1F" : "#0F6E56" }}>
                            {remaining}
                            <span className="text-[11px] font-normal text-[#968F84]"> / {g!.quota}</span>
                            {g!.full > 0 && <span className="block text-[11px] font-normal text-[#B25F0B]">{g!.full} jour{g!.full > 1 ? "s" : ""} complet{g!.full > 1 ? "s" : ""}</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[#6B6862]">{a.release_days > 0 ? `J−${a.release_days}` : "—"}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={a.on_exhausted === "block" ? { backgroundColor: "#FCEBEB", color: "#791F1F" } : { backgroundColor: "#FAEEDA", color: "#633806" }}
                        >
                          {ON_EXHAUSTED_LABEL[a.on_exhausted]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
