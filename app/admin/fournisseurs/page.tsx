import Link from "next/link";
import { Plus, Search, X, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort, foldAccents } from "@/lib/utils";
import { SUPPLIER_TYPE_LABEL, PAYMENT_TERMS_LABEL, CONTRACT_STATUS_STYLE, CONTRACT_STATUS_LABEL } from "@/lib/purchasing";
import { KpiCard } from "@/components/kpi-card";
import type { ContractStatus, Supplier, SupplierType } from "@/lib/types";

type ContractRow = { id: string; supplier_id: string; status: ContractStatus; valid_to: string; label: string };

export default async function FournisseursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; inactifs?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const typeFilter = params.type ?? "";
  const showInactive = params.inactifs === "1";
  const hasFilter = Boolean(q || typeFilter || showInactive);
  const now = new Date();

  const supabase = await createClient();
  const [{ data: supplierRows, error }, { data: contractRows }] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("supplier_contracts").select("id, supplier_id, status, valid_to, label"),
  ]);
  if (error) console.error("[fournisseurs] chargement :", error);

  const suppliers = (supplierRows ?? []) as unknown as Supplier[];
  const contracts = (contractRows ?? []) as unknown as ContractRow[];

  const bySupplier = new Map<string, ContractRow[]>();
  for (const c of contracts) {
    const list = bySupplier.get(c.supplier_id) ?? [];
    list.push(c);
    bySupplier.set(c.supplier_id, list);
  }

  // Synthèse
  const active = suppliers.filter((s) => s.is_active);
  const activeContracts = contracts.filter((c) => c.status === "active");
  const in60Days = new Date(now.getTime() + 60 * 86400000).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);
  const expiringSoon = activeContracts.filter((c) => c.valid_to >= todayStr && c.valid_to <= in60Days);

  // Filtres
  const qFold = foldAccents(q);
  const filtered = suppliers.filter((s) => {
    if (!showInactive && !s.is_active) return false;
    if (typeFilter && s.supplier_type !== typeFilter) return false;
    if (!q) return true;
    return (
      foldAccents(s.name).includes(qFold) ||
      foldAccents(s.legal_name ?? "").includes(qFold) ||
      foldAccents(s.city ?? "").includes(qFold) ||
      (s.ice ?? "").includes(q)
    );
  });

  const href = (o: Partial<{ q: string; type: string; inactifs: string }>) => {
    const m = { q, type: typeFilter, inactifs: showInactive ? "1" : "", ...o };
    const sp = new URLSearchParams();
    if (m.q) sp.set("q", m.q);
    if (m.type) sp.set("type", m.type);
    if (m.inactifs) sp.set("inactifs", m.inactifs);
    const s = sp.toString();
    return s ? `/admin/fournisseurs?${s}` : "/admin/fournisseurs";
  };

  const chip = (isActive: boolean) =>
    `inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition-colors ${
      isActive ? "bg-[#1A1F2E] text-white border-[#1A1F2E]" : "bg-white text-[#58524A] border-[#E0DACF] hover:bg-[#FBF9F5]"
    }`;
  const th = "px-3 py-2.5 text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A]";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Achats · Fournisseurs</p>
          <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Fournisseurs</h1>
          <p className="text-[12px] text-[#6B6862] mt-1">
            Hôteliers, transporteurs, compagnies et prestataires · contrats et conditions commerciales · au{" "}
            {now.toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Link
          href="/admin/fournisseurs/new"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-4 text-sm font-medium text-white hover:bg-[#2A3142] transition-colors"
        >
          <Plus className="size-4" /> Nouveau fournisseur
        </Link>
      </div>

      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <KpiCard label="Fournisseurs actifs" value={String(active.length)} sub={`${suppliers.length} fiche${suppliers.length > 1 ? "s" : ""} au total`} />
        <KpiCard label="Contrats actifs" value={String(activeContracts.length)} accent="ocean" sub={`${contracts.length} contrat${contracts.length > 1 ? "s" : ""} enregistré${contracts.length > 1 ? "s" : ""}`} />
        <KpiCard
          label="Expirent sous 60 j"
          value={String(expiringSoon.length)}
          accent={expiringSoon.length > 0 ? "amber" : undefined}
          sub={expiringSoon.length > 0 ? "à renégocier" : "aucune échéance proche"}
        />
        <KpiCard label="Sans contrat actif" value={String(active.filter((s) => !(bySupplier.get(s.id) ?? []).some((c) => c.status === "active")).length)} sub="fournisseurs actifs non couverts" />
      </div>

      <div className="bg-white border border-[#E5E0D7] rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <Link href={href({ type: "" })} className={chip(typeFilter === "")}>Tous les types</Link>
        {(Object.keys(SUPPLIER_TYPE_LABEL) as SupplierType[]).map((t) => (
          <Link key={t} href={href({ type: t })} className={chip(typeFilter === t)}>{SUPPLIER_TYPE_LABEL[t]}</Link>
        ))}
        <span className="mx-1 h-5 w-px bg-[#E5E0D7]" aria-hidden />
        <Link href={href({ inactifs: showInactive ? "" : "1" })} className={chip(showInactive)}>
          Inclure les inactifs
        </Link>

        <form action="/admin/fournisseurs" method="get" className="ml-auto flex items-center gap-2">
          {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
          {showInactive && <input type="hidden" name="inactifs" value="1" />}
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#968F84] pointer-events-none" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Nom, raison sociale, ville, ICE…"
              className="h-9 w-64 rounded-lg border border-[#E0DACF] bg-white pl-9 pr-3 text-[13px] text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10"
            />
          </div>
          {hasFilter && (
            <Link href="/admin/fournisseurs" className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium text-[#6B6862] hover:text-[#1A1F2E] hover:underline">
              <X className="size-3.5" /> Réinitialiser
            </Link>
          )}
        </form>
      </div>

      <div className="bg-white border border-[#E5E0D7] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="size-8 mx-auto text-[#C9C4BA] mb-3" />
            <p className="text-[14px] text-[#1A1F2E]">
              {hasFilter ? "Aucun fournisseur ne correspond à ces critères." : "Aucun fournisseur enregistré."}
            </p>
            <p className="text-[12px] text-[#968F84] mt-1">
              {hasFilter ? (
                <Link href="/admin/fournisseurs" className="text-terracotta-600 hover:underline">Réinitialiser les filtres</Link>
              ) : (
                "Commencez par créer un hôtelier, un transporteur ou un prestataire."
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
                <tr>
                  <th className={`${th} text-left`}>Fournisseur</th>
                  <th className={`${th} text-left`}>Type</th>
                  <th className={`${th} text-left`}>Ville</th>
                  <th className={`${th} text-left`}>Paiement</th>
                  <th className={`${th} text-left`}>Contrats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {filtered.map((s) => {
                  const list = bySupplier.get(s.id) ?? [];
                  const activeOne = list.find((c) => c.status === "active");
                  return (
                    <tr key={s.id} className={`hover:bg-[#FBF9F5] ${s.is_active ? "" : "opacity-60"}`}>
                      <td className="px-3 py-2.5">
                        <Link href={`/admin/fournisseurs/${s.id}`} className="font-medium text-[#1A1F2E] hover:text-[#C84B31]">
                          {s.name}
                        </Link>
                        {s.legal_name && <span className="block text-[11px] text-[#968F84]">{s.legal_name}</span>}
                        {!s.is_active && <span className="block text-[11px] text-[#B25F0B]">Inactif</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[#6B6862]">{SUPPLIER_TYPE_LABEL[s.supplier_type] ?? s.supplier_type}</td>
                      <td className="px-3 py-2.5 text-[#6B6862]">{[s.city, s.country].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-3 py-2.5 text-[#6B6862]">{PAYMENT_TERMS_LABEL[s.payment_terms] ?? s.payment_terms}</td>
                      <td className="px-3 py-2.5">
                        {list.length === 0 ? (
                          <span className="text-[#968F84]">—</span>
                        ) : activeOne ? (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                backgroundColor: CONTRACT_STATUS_STYLE.active.bg,
                                color: CONTRACT_STATUS_STYLE.active.color,
                              }}
                            >
                              {CONTRACT_STATUS_LABEL.active}
                            </span>
                            <span className="text-[11px] text-[#6B6862]">jusqu&apos;au {formatDateShort(activeOne.valid_to)}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#6B6862]">{list.length} contrat{list.length > 1 ? "s" : ""}, aucun actif</span>
                        )}
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
