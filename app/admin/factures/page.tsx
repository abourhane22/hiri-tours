import Link from "next/link";
import "flag-icons/css/flag-icons.min.css";
import { ArrowDown, ArrowUp, Globe, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMAD, formatDateShort, foldAccents } from "@/lib/utils";
import { countryCode } from "@/lib/countries";
import { INVOICE_STATUS_LABEL } from "@/lib/invoices";
import { KpiCard } from "@/components/kpi-card";

type Row = {
  id: string;
  invoice_number: string;
  issued_at: string;
  status: "issued" | "paid" | "cancelled";
  customer_snapshot: { full_name?: string; country?: string | null } | null;
  total_ht_mad: number;
  tva_amount_mad: number;
  total_ttc_mad: number;
  reservation: { id: string; reference: string } | { id: string; reference: string }[] | null;
};

const STATUS_STYLE: Record<Row["status"], { bg: string; color: string }> = {
  issued: { bg: "#E6F1FB", color: "#0C447C" },
  paid: { bg: "#E1F5EE", color: "#085041" },
  cancelled: { bg: "#FCEBEB", color: "#791F1F" },
};

const resaOf = (r: Row["reservation"]) => (Array.isArray(r) ? r[0] : r) ?? null;

export default async function FacturesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; year?: string; q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status ?? "";
  const yearFilter = params.year ?? "all";
  const q = (params.q ?? "").trim();
  const sort: "asc" | "desc" = params.sort === "asc" ? "asc" : "desc";
  const hasFilter = Boolean(statusFilter || yearFilter !== "all" || q);
  const now = new Date();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, issued_at, status, customer_snapshot, total_ht_mad, tva_amount_mad, total_ttc_mad, reservation:reservations(id, reference)",
    )
    .order("issued_at", { ascending: sort === "asc" });
  if (error) console.error("[factures] chargement :", error);
  const all = (data ?? []) as unknown as Row[];

  const years = Array.from(new Set(all.map((i) => new Date(i.issued_at).getFullYear()))).sort((a, b) => b - a);
  const yearScoped = yearFilter === "all" ? all : all.filter((i) => String(new Date(i.issued_at).getFullYear()) === yearFilter);

  // Synthèse sur le périmètre année (hors statut / recherche)
  const active = yearScoped.filter((i) => i.status !== "cancelled");
  const cancelled = yearScoped.length - active.length;
  const totalTtc = active.reduce((s, i) => s + Number(i.total_ttc_mad), 0);
  const totalTva = active.reduce((s, i) => s + Number(i.tva_amount_mad), 0);
  const totalHt = active.reduce((s, i) => s + Number(i.total_ht_mad), 0);
  const yearLabel = yearFilter === "all" ? "toutes années" : `exercice ${yearFilter}`;

  // Filtres statut + recherche (numéro, client, référence dossier)
  const qFold = foldAccents(q);
  const filtered = yearScoped.filter((i) => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (!q) return true;
    const resa = resaOf(i.reservation);
    return (
      foldAccents(i.invoice_number).includes(qFold) ||
      foldAccents(i.customer_snapshot?.full_name ?? "").includes(qFold) ||
      foldAccents(resa?.reference ?? "").includes(qFold)
    );
  });
  const filteredTtc = filtered.filter((i) => i.status !== "cancelled").reduce((s, i) => s + Number(i.total_ttc_mad), 0);

  const href = (o: Partial<{ status: string; year: string; q: string; sort: string }>) => {
    const m = { status: statusFilter, year: yearFilter, q, sort, ...o };
    const sp = new URLSearchParams();
    if (m.status) sp.set("status", m.status);
    if (m.year && m.year !== "all") sp.set("year", m.year);
    if (m.q) sp.set("q", m.q);
    if (m.sort === "asc") sp.set("sort", "asc");
    const s = sp.toString();
    return s ? `/admin/factures?${s}` : "/admin/factures";
  };

  const chip = (isActive: boolean) =>
    `inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition-colors ${
      isActive ? "bg-[#1A1F2E] text-white border-[#1A1F2E]" : "bg-white text-[#58524A] border-[#E0DACF] hover:bg-[#FBF9F5]"
    }`;
  const th = "px-3 py-2.5 text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A]";
  const SortIcon = sort === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Finance · Facturation</p>
          <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Factures</h1>
          <p className="text-[12px] text-[#6B6862] mt-1">
            Registre des factures émises · numérotation continue par année · au {now.toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>

      {/* Synthèse */}
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <KpiCard label="Factures émises" value={String(active.length)} sub={`${yearLabel}${cancelled > 0 ? ` · ${cancelled} annulée${cancelled > 1 ? "s" : ""}` : ""}`} />
        <KpiCard label="Total facturé TTC" value={formatMAD(totalTtc)} accent="ocean" sub={`HT ${formatMAD(totalHt)}`} />
        <KpiCard label="TVA collectée" value={formatMAD(totalTva)} sub="sur les factures émises" />
        <KpiCard
          label="Dernière facture"
          value={all[0] ? (sort === "desc" ? all[0].invoice_number : all[all.length - 1].invoice_number) : "—"}
          sub={all.length > 0 ? `émise le ${formatDateShort(sort === "desc" ? all[0].issued_at : all[all.length - 1].issued_at)}` : "aucune facture émise"}
        />
      </div>

      {/* Filtres */}
      <div className="bg-white border border-[#E5E0D7] rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <Link href={href({ year: "all" })} className={chip(yearFilter === "all")}>
          Toutes années
        </Link>
        {years.map((y) => (
          <Link key={y} href={href({ year: String(y) })} className={chip(yearFilter === String(y))}>
            {y}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-[#E5E0D7]" aria-hidden />
        <Link href={href({ status: "" })} className={chip(statusFilter === "")}>
          Tous statuts
        </Link>
        <Link href={href({ status: "issued" })} className={chip(statusFilter === "issued")}>
          Émises
        </Link>
        <Link href={href({ status: "cancelled" })} className={chip(statusFilter === "cancelled")}>
          Annulées
        </Link>

        <form action="/admin/factures" method="get" className="ml-auto flex items-center gap-2">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          {yearFilter !== "all" && <input type="hidden" name="year" value={yearFilter} />}
          {sort === "asc" && <input type="hidden" name="sort" value="asc" />}
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#968F84] pointer-events-none" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Numéro, client, dossier…"
              className="h-9 w-64 rounded-lg border border-[#E0DACF] bg-white pl-9 pr-3 text-[13px] text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10"
            />
          </div>
          {hasFilter && (
            <Link href="/admin/factures" className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium text-[#6B6862] hover:text-[#1A1F2E] hover:underline">
              <X className="size-3.5" /> Réinitialiser
            </Link>
          )}
        </form>
      </div>

      {/* Registre */}
      <div className="bg-white border border-[#E5E0D7] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[14px] text-[#1A1F2E]">
              {hasFilter ? "Aucune facture ne correspond à ces critères." : "Aucune facture émise pour l'instant."}
            </p>
            <p className="text-[12px] text-[#968F84] mt-1">
              {hasFilter ? (
                <Link href="/admin/factures" className="text-terracotta-600 hover:underline">
                  Réinitialiser les filtres
                </Link>
              ) : (
                "Les factures s'émettent depuis la carte Facturation d'un dossier confirmé."
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
                <tr>
                  <th className={`${th} text-left`}>Numéro</th>
                  <th className={`${th} text-left`}>
                    <Link href={href({ sort: sort === "asc" ? "desc" : "asc" })} className="inline-flex items-center gap-1 hover:text-[#1A1F2E]" title="Inverser le tri">
                      Émise le <SortIcon className="size-3" />
                    </Link>
                  </th>
                  <th className={`${th} text-left`}>Client</th>
                  <th className={`${th} text-left`}>Dossier</th>
                  <th className={`${th} text-left`}>Statut</th>
                  <th className={`${th} text-right`}>HT</th>
                  <th className={`${th} text-right`}>TVA</th>
                  <th className={`${th} text-right`}>TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {filtered.map((inv) => {
                  const resa = resaOf(inv.reservation);
                  const country = inv.customer_snapshot?.country ?? null;
                  const code = countryCode(country);
                  const st = STATUS_STYLE[inv.status] ?? STATUS_STYLE.issued;
                  const muted = inv.status === "cancelled";
                  return (
                    <tr key={inv.id} className={`hover:bg-[#FBF9F5] ${muted ? "text-[#968F84]" : "text-[#1A1F2E]"}`}>
                      <td className="px-3 py-2.5 font-mono text-[12px]">
                        <Link href={`/admin/factures/${inv.id}`} className={`hover:text-[#C84B31] ${muted ? "line-through" : "font-medium"}`}>
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-[#6B6862]">{formatDateShort(inv.issued_at)}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          {code ? (
                            <span className={`fi fi-${code} shrink-0 rounded-[2px]`} style={{ width: 16, height: 12 }} title={country ?? undefined} />
                          ) : (
                            <Globe className="size-3.5 text-[#C9C4BA] shrink-0" />
                          )}
                          <span className="truncate">{inv.customer_snapshot?.full_name ?? "—"}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px]">
                        {resa ? (
                          <Link href={`/admin/reservations/${resa.id}`} className="text-[#6B6862] hover:text-[#C84B31]">
                            {resa.reference}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.color }}>
                          {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMAD(inv.total_ht_mad)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#6B6862]">{formatMAD(inv.tva_amount_mad)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatMAD(inv.total_ttc_mad)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
                <tr>
                  <td colSpan={7} className="px-3 py-2.5 text-right text-[12px] text-[#6B6862]">
                    {filtered.length} facture{filtered.length > 1 ? "s" : ""} · total TTC hors annulées
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[#1A1F2E]">{formatMAD(filteredTtc)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
