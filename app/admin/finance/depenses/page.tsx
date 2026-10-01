import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Download, Search, X, Info, FileCheck2, FileWarning, Pencil, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ExpenseTabs } from "@/components/report-tabs";
import { KpiCard, DeltaPill } from "@/components/kpi-card";
import { QueryErrorPanel } from "@/components/query-error";
import { AutoSubmitForm } from "@/components/finance/auto-submit-form";
import { formatMAD, formatDateShort } from "@/lib/utils";
import {
  ATTACHMENTS,
  ATTACHMENT_META,
  ATTACHMENT_STYLE,
  LIST_LEGEND,
  attachmentOf,
  filtersToSearch,
  hasActiveFilter,
  parseExpenseFilters,
} from "@/lib/expenses";
import { EXPENSE_PAGE_SIZE, listExpenses, vehicleLabel, type ExpenseRow } from "@/lib/expenses-query";

// Liste des dépenses — filtres TOUS dans l'URL (partageables, conservés au retour),
// requêtes et pagination côté serveur (lib/expenses-query.ts).
export default async function DepensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = parseExpenseFilters(sp);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [result, catRes, vehRes] = await Promise.all([
    listExpenses(supabase, f),
    supabase.from("cost_categories").select("id, name, type, sort_order").order("type").order("sort_order"),
    supabase.from("vehicles").select("id, registration, make, model").order("registration"),
  ]);
  if (result.error) {
    console.error("[dépenses] liste :", result.error);
    return <QueryErrorPanel title="Impossible de charger les dépenses" error={result.error} />;
  }
  const { rows, kpi, range, attachmentCounts, filteredCount, filteredTotal } = result;
  const categories = (catRes.data ?? []) as { id: string; name: string; type: string }[];
  const vehicles = (vehRes.data ?? []) as { id: string; registration: string; make: string | null; model: string | null }[];

  const here = `/admin/finance/depenses${filtersToSearch(f)}`;
  const href = (over: Parameters<typeof filtersToSearch>[1]) => `/admin/finance/depenses${filtersToSearch(f, { page: 1, ...over })}`;
  const pages = Math.max(1, Math.ceil(filteredCount / EXPENSE_PAGE_SIZE));
  const delta = kpi.previousTotal > 0 ? Math.round(((kpi.total - kpi.previousTotal) / kpi.previousTotal) * 1000) / 10 : null;
  const chip = (active: boolean) =>
    `inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
      active ? "border-[#1A1F2E] bg-[#1A1F2E] text-white" : "border-[#E0DACF] bg-white text-[#58524A] hover:border-[#C9C4BA]"
    }`;
  const field = "h-11 rounded-lg border border-[#E0DACF] bg-white px-3 text-[13.5px] text-[#1A1F2E] focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10";
  const th = "px-3 py-2.5 text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A] text-left";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Finance · coûts</p>
          <h1 className="font-display text-3xl tracking-[-0.02em] text-[#1A1F2E] mt-1">Dépenses</h1>
          <p className="text-[13px] text-[#6B6862] mt-1">
            Ce que l&apos;agence paie, et pour qui : dossiers, produits, flotte ou structure · {range.label}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/admin/finance/depenses/export${filtersToSearch(f, { page: 1 })}`} className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[#E0DACF] bg-white px-3.5 text-[13px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0]">
            <Download className="size-4" /> Exporter (CSV)
          </a>
          <Link href={`/admin/finance/depenses/new?back=${encodeURIComponent(here)}`} className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-4 text-[13px] font-medium text-white hover:bg-[#2A3142]">
            <Plus className="size-4" /> Nouvelle dépense
          </Link>
        </div>
      </div>

      <ExpenseTabs active="depenses" />

      {/* KPI de la période */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard
          label="Total de la période"
          value={formatMAD(kpi.total)}
          sub={`période précédente ${formatMAD(kpi.previousTotal)}`}
          delta={delta !== null ? <DeltaPill up={delta <= 0}>{delta > 0 ? "+" : ""}{delta.toLocaleString("fr-FR")} %</DeltaPill> : undefined}
        />
        <KpiCard label="Rattachées aux dossiers" value={formatMAD(kpi.dossier)} sub="entrent dans la marge réelle" />
        <KpiCard label="Flotte" value={formatMAD(kpi.fleet)} sub={`rattachées à un véhicule · produits ${formatMAD(kpi.produit)}`} />
        <KpiCard label="Non rattachées (frais généraux)" value={formatMAD(kpi.general)} sub="structure, hors marge des dossiers" />
      </div>

      {/* Filtres */}
      <AutoSubmitForm action="/admin/finance/depenses" className="rounded-xl border border-[#E5E0D7] bg-white p-3 mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_170px_170px_auto] items-center">
        {f.att && <input type="hidden" name="att" value={f.att} />}
        {f.reservation && <input type="hidden" name="reservation" value={f.reservation} />}
        {f.circuit && <input type="hidden" name="circuit" value={f.circuit} />}
        <label className="relative block">
          <span className="sr-only">Rechercher</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#968F84]" />
          <input name="q" defaultValue={f.q} placeholder="Libellé, dossier, client, véhicule, produit…" className={`${field} w-full pl-9`} />
        </label>
        <select name="cat" defaultValue={f.cat} aria-label="Catégorie" className={field}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="period" defaultValue={f.period} aria-label="Période" className={field}>
          <option value="month">Ce mois</option>
          <option value="prev">Mois dernier</option>
          <option value="quarter">Ce trimestre</option>
          <option value="custom">Dates personnalisées</option>
        </select>
        <select name="vehicle" defaultValue={f.vehicle} aria-label="Véhicule" className={field}>
          <option value="">Tous véhicules</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{vehicleLabel(v)}</option>)}
        </select>
        <label className="inline-flex h-11 items-center gap-2 px-1 text-[13px] text-[#1A1F2E] whitespace-nowrap">
          <input type="checkbox" name="sans_justif" value="1" defaultChecked={f.noReceipt} className="size-4" /> Sans justificatif
        </label>
        {f.period === "custom" && (
          <div className="md:col-span-5 flex flex-wrap items-center gap-2">
            <label className="text-[12.5px] text-[#58524A]">Du <input type="date" name="from" defaultValue={range.start} className={`${field} ml-1`} /></label>
            <label className="text-[12.5px] text-[#58524A]">au <input type="date" name="to" defaultValue={range.end} className={`${field} ml-1`} /></label>
          </div>
        )}
        <button type="submit" className="sr-only">Filtrer</button>
      </AutoSubmitForm>

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="mr-1 text-[12px] text-[#6B6862]">Rattachée à :</span>
        <Link href={href({ att: "" })} className={chip(!f.att)}>
          Tout <span className={!f.att ? "text-white/80" : "text-[#968F84]"}>{attachmentCounts.all}</span>
        </Link>
        {ATTACHMENTS.map((a) => (
          <Link key={a} href={href({ att: a })} className={chip(f.att === a)}>
            {ATTACHMENT_META[a].label} <span className={f.att === a ? "text-white/80" : "text-[#968F84]"}>{attachmentCounts[a]}</span>
          </Link>
        ))}
        {hasActiveFilter(f) && (
          <Link href="/admin/finance/depenses" className="ml-auto inline-flex h-11 items-center gap-1 px-2 text-[13px] font-medium text-[#C84B31] hover:underline">
            <X className="size-3.5" /> Effacer les filtres
          </Link>
        )}
      </div>

      <p className="mb-4 flex items-start gap-2 rounded-lg border border-[#EEE9E0] bg-[#FBF9F5] px-3 py-2 text-[12px] text-[#58524A]">
        <Info className="mt-px size-3.5 shrink-0 text-[#968F84]" /> {LIST_LEGEND}
      </p>

      {/* Tableau */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#E5E0D7] bg-white px-6 py-14 text-center">
          <p className="font-display text-xl tracking-[-0.02em] text-[#1A1F2E]">Aucune dépense</p>
          <p className="text-[13px] text-[#6B6862] mt-1">
            {hasActiveFilter(f) ? "Aucune dépense ne correspond à ces filtres." : `Aucune dépense saisie pour ${range.label}.`}
          </p>
          <Link href={`/admin/finance/depenses/new?back=${encodeURIComponent(here)}`} className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-4 text-[13px] font-medium text-white hover:bg-[#2A3142]">
            <Plus className="size-4" /> Nouvelle dépense
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E5E0D7] bg-white overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Libellé</th>
                <th className={th}>Rattachement</th>
                <th className={th}>Justificatif</th>
                <th className={`${th} text-right`}>Montant</th>
                <th className={th}><span className="sr-only">Modifier</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EDE5]">
              {rows.map((e) => (
                <ExpenseLine key={e.id} e={e} back={here} />
              ))}
            </tbody>
            <tfoot className="border-t border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
              <tr>
                <td colSpan={4} className="px-3 py-2.5 text-[12.5px] text-[#58524A]">
                  {filteredCount} dépense{filteredCount > 1 ? "s" : ""}
                  {pages > 1 && <> · page {f.page} / {pages} ({rows.length} affichées)</>}
                </td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums text-[#1A1F2E]">{formatMAD(filteredTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-3 flex items-center justify-end gap-2" aria-label="Pagination">
          {f.page > 1 && (
            <Link href={`/admin/finance/depenses${filtersToSearch(f, { page: f.page - 1 })}`} className="inline-flex h-11 items-center rounded-lg border border-[#E0DACF] bg-white px-3.5 text-[13px] hover:bg-[#FAF5F0]">
              Précédente
            </Link>
          )}
          {f.page < pages && (
            <Link href={`/admin/finance/depenses${filtersToSearch(f, { page: f.page + 1 })}`} className="inline-flex h-11 items-center rounded-lg border border-[#E0DACF] bg-white px-3.5 text-[13px] hover:bg-[#FAF5F0]">
              Suivante
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function ExpenseLine({ e, back }: { e: ExpenseRow; back: string }) {
  const att = attachmentOf(e);
  const st = ATTACHMENT_STYLE[att];
  const editHref = `/admin/finance/depenses/${e.id}?back=${encodeURIComponent(back)}`;
  const vehicle = e.vehicle ? vehicleLabel(e.vehicle) : null;
  return (
    <tr className="hover:bg-[#FBF9F5] align-top">
      <td className="px-3 py-2.5 tabular-nums text-[#6B6862] whitespace-nowrap">{formatDateShort(e.expense_date)}</td>
      <td className="px-3 py-2.5 min-w-[220px]">
        <Link href={editHref} className="font-medium text-[#1A1F2E] hover:text-[#C84B31]">{e.description || "Dépense"}</Link>
        <p className="text-[12px] text-[#6B6862]">
          {e.source === "distribution" && (
            <span className="mr-1.5 rounded px-1.5 py-px text-[10.5px] font-medium" style={{ backgroundColor: "#E3F0F4", color: "#0C6B8A" }}>
              Automatique
            </span>
          )}
          {e.category?.name ?? "—"}
        </p>
      </td>
      <td className="px-3 py-2.5">
        <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11.5px] font-medium" style={{ backgroundColor: st.bg, color: st.color }}>
          {ATTACHMENT_META[att].label}
        </span>
        <p className="mt-0.5 text-[12px] text-[#1A1F2E]">
          {att === "dossier" && e.reservation && (
            <Link href={`/admin/reservations/${e.reservation_id}`} className="font-mono text-[12px] hover:text-[#C84B31]">
              {e.reservation.reference}
            </Link>
          )}
          {att === "dossier" && e.reservation?.customer && <span className="text-[#6B6862]"> · {e.reservation.customer}</span>}
          {att === "produit" && <>{e.circuit?.title ?? "Produit"}{e.departure_date && <span className="text-[#6B6862]"> · départ {formatDateShort(e.departure_date)}</span>}</>}
          {att === "vehicule" && vehicle}
          {att === "general" && <span className="text-[#6B6862]">Agence</span>}
        </p>
        {att !== "vehicule" && vehicle && <p className="text-[11.5px] text-[#6B6862]">Véhicule : {vehicle}</p>}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {e.source === "distribution" ? (
          <span className="text-[12px] text-[#6B6862]">Ordre de la compagnie</span>
        ) : e.receipt_path ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-[#085041]">
            <FileCheck2 className="size-3.5" /> {/\.pdf$/i.test(e.receipt_path) ? "PDF joint" : "Photo jointe"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] text-[#B25F0B]">
            <FileWarning className="size-3.5" /> À joindre
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-[#1A1F2E] whitespace-nowrap">{formatMAD(e.amount_mad)}</td>
      <td className="px-1 py-1 text-right">
        <Link
          href={editHref}
          aria-label={e.source === "distribution" ? "Voir la dépense automatique" : "Modifier la dépense"}
          className="inline-flex size-11 items-center justify-center rounded-lg text-[#6B6862] hover:bg-[#F1EFE8] hover:text-[#1A1F2E]"
        >
          {e.source === "distribution" ? <Eye className="size-4" /> : <Pencil className="size-4" />}
        </Link>
      </td>
    </tr>
  );
}
