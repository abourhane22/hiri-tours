import Link from "next/link";
import "flag-icons/css/flag-icons.min.css";
import { Globe, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMAD, formatDateShort, foldAccents } from "@/lib/utils";
import { countryCode } from "@/lib/countries";
import {
  CREDIT_NOTE_REASON_LABEL,
  CREDIT_NOTE_STATUS_LABEL,
  CREDIT_NOTE_STATUS_STYLE,
} from "@/lib/credit-notes";
import { KpiCard } from "@/components/kpi-card";
import { DocumentTabs } from "@/components/document-tabs";
import type { CreditNote, CreditNoteStatus } from "@/lib/types";

type Row = Pick<
  CreditNote,
  "id" | "credit_note_number" | "created_at" | "amount_mad" | "remaining_mad" | "status" | "reason" | "snapshot"
> & {
  invoice: { id: string; invoice_number: string } | { id: string; invoice_number: string }[] | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function AvoirsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; year?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const statusFilter = params.status ?? "";
  const yearFilter = params.year ?? "all";
  const hasFilter = Boolean(q || statusFilter || yearFilter !== "all");
  const now = new Date();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credit_notes")
    .select(
      "id, credit_note_number, created_at, amount_mad, remaining_mad, status, reason, snapshot, invoice:invoices(id, invoice_number)",
    )
    .order("created_at", { ascending: false });
  if (error) console.error("[avoirs] chargement :", error);
  const all = (data ?? []) as unknown as Row[];

  const years = Array.from(new Set(all.map((c) => new Date(c.created_at).getFullYear()))).sort((a, b) => b - a);
  const yearScoped = yearFilter === "all" ? all : all.filter((c) => String(new Date(c.created_at).getFullYear()) === yearFilter);

  const totalIssued = yearScoped.reduce((s, c) => s + Number(c.amount_mad), 0);
  const totalRemaining = yearScoped.reduce((s, c) => s + Number(c.remaining_mad), 0);
  const openCount = yearScoped.filter((c) => Number(c.remaining_mad) > 0).length;
  const yearLabel = yearFilter === "all" ? "toutes années" : `exercice ${yearFilter}`;

  const qFold = foldAccents(q);
  const filtered = yearScoped.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (!q) return true;
    const inv = one(c.invoice);
    return (
      foldAccents(c.credit_note_number).includes(qFold) ||
      foldAccents(c.snapshot?.customer?.full_name ?? "").includes(qFold) ||
      foldAccents(inv?.invoice_number ?? "").includes(qFold) ||
      foldAccents(c.snapshot?.reservation_reference ?? "").includes(qFold)
    );
  });

  const href = (o: Partial<{ status: string; year: string; q: string }>) => {
    const m = { status: statusFilter, year: yearFilter, q, ...o };
    const sp = new URLSearchParams();
    if (m.status) sp.set("status", m.status);
    if (m.year && m.year !== "all") sp.set("year", m.year);
    if (m.q) sp.set("q", m.q);
    const s = sp.toString();
    return s ? `/admin/avoirs?${s}` : "/admin/avoirs";
  };

  const chip = (isActive: boolean) =>
    `inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition-colors ${
      isActive ? "bg-[#1A1F2E] text-white border-[#1A1F2E]" : "bg-white text-[#58524A] border-[#E0DACF] hover:bg-[#FBF9F5]"
    }`;
  const th = "px-3 py-2.5 text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A]";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Finance · Facturation</p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Avoirs</h1>
        <p className="text-[12px] text-[#6B6862] mt-1">
          Crédits émis sur factures · réutilisables sur un dossier du même client ou remboursables · au{" "}
          {now.toLocaleDateString("fr-FR")}
        </p>
      </div>

      <DocumentTabs active="avoirs" />

      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <KpiCard label="Avoirs émis" value={String(yearScoped.length)} sub={yearLabel} />
        <KpiCard label="Montant total émis" value={formatMAD(totalIssued)} sub="crédits accordés aux clients" />
        <KpiCard
          label="Solde à restituer"
          value={formatMAD(totalRemaining)}
          accent="amber"
          sub={`${openCount} avoir${openCount > 1 ? "s" : ""} avec solde · dette envers les clients`}
        />
        <KpiCard label="Soldés" value={String(yearScoped.length - openCount)} sub="utilisés ou remboursés" />
      </div>

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
        {(["issued", "consumed", "refunded"] as CreditNoteStatus[]).map((s) => (
          <Link key={s} href={href({ status: s })} className={chip(statusFilter === s)}>
            {CREDIT_NOTE_STATUS_LABEL[s]}
          </Link>
        ))}

        <form action="/admin/avoirs" method="get" className="ml-auto flex items-center gap-2">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          {yearFilter !== "all" && <input type="hidden" name="year" value={yearFilter} />}
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#968F84] pointer-events-none" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Avoir, facture, client, dossier…"
              className="h-9 w-64 rounded-lg border border-[#E0DACF] bg-white pl-9 pr-3 text-[13px] text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10"
            />
          </div>
          {hasFilter && (
            <Link href="/admin/avoirs" className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium text-[#6B6862] hover:text-[#1A1F2E] hover:underline">
              <X className="size-3.5" /> Réinitialiser
            </Link>
          )}
        </form>
      </div>

      <div className="bg-white border border-[#E5E0D7] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[14px] text-[#1A1F2E]">
              {hasFilter ? "Aucun avoir ne correspond à ces critères." : "Aucun avoir émis pour l'instant."}
            </p>
            <p className="text-[12px] text-[#968F84] mt-1">
              {hasFilter ? (
                <Link href="/admin/avoirs" className="text-terracotta-600 hover:underline">
                  Réinitialiser les filtres
                </Link>
              ) : (
                "Les avoirs s'émettent depuis une facture."
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
                <tr>
                  <th className={`${th} text-left`}>Numéro</th>
                  <th className={`${th} text-left`}>Émis le</th>
                  <th className={`${th} text-left`}>Facture d&apos;origine</th>
                  <th className={`${th} text-left`}>Client</th>
                  <th className={`${th} text-left`}>Motif</th>
                  <th className={`${th} text-left`}>Statut</th>
                  <th className={`${th} text-right`}>Montant</th>
                  <th className={`${th} text-right`}>Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {filtered.map((c) => {
                  const inv = one(c.invoice);
                  const country = c.snapshot?.customer?.country ?? null;
                  const code = countryCode(country);
                  const st = CREDIT_NOTE_STATUS_STYLE[c.status] ?? CREDIT_NOTE_STATUS_STYLE.issued;
                  const remaining = Number(c.remaining_mad);
                  return (
                    <tr key={c.id} className="hover:bg-[#FBF9F5] text-[#1A1F2E]">
                      <td className="px-3 py-2.5 font-mono text-[12px]">
                        <Link href={`/admin/avoirs/${c.id}`} className="font-medium hover:text-[#C84B31]">
                          {c.credit_note_number}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-[#6B6862]">{formatDateShort(c.created_at)}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px]">
                        {inv ? (
                          <Link href={`/admin/factures/${inv.id}`} className="text-[#6B6862] hover:text-[#C84B31]">
                            {inv.invoice_number}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          {code ? (
                            <span className={`fi fi-${code} shrink-0 rounded-[2px]`} style={{ width: 16, height: 12 }} title={country ?? undefined} />
                          ) : (
                            <Globe className="size-3.5 text-[#C9C4BA] shrink-0" />
                          )}
                          <span className="truncate">{c.snapshot?.customer?.full_name ?? "—"}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[#6B6862]">{CREDIT_NOTE_REASON_LABEL[c.reason] ?? c.reason}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.color }}>
                          {CREDIT_NOTE_STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMAD(c.amount_mad)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium" style={{ color: remaining > 0 ? "#B25F0B" : "#968F84" }}>
                        {formatMAD(remaining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
                <tr>
                  <td colSpan={6} className="px-3 py-2.5 text-right text-[12px] text-[#6B6862]">
                    {filtered.length} avoir{filtered.length > 1 ? "s" : ""}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                    {formatMAD(filtered.reduce((s, c) => s + Number(c.amount_mad), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium" style={{ color: "#B25F0B" }}>
                    {formatMAD(filtered.reduce((s, c) => s + Number(c.remaining_mad), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
