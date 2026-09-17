"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2, Check, TrendingUp, TrendingDown } from "lucide-react";
import { formatMAD, formatDateShort } from "@/lib/utils";
import { indicativeMargin } from "@/lib/purchasing";
import { createPurchaseRate, deletePurchaseRate, type AchatActionState } from "@/app/admin/fournisseurs/actions";
import type { PurchaseRate } from "@/lib/types";

const labelCls = "block text-[11px] font-medium text-[#58524A] mb-1";
const fieldCls =
  "h-9 w-full rounded-lg border border-[#E0DACF] bg-white px-2.5 text-[13px] text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";
const th = "px-3 py-2 text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A]";

/** Produit du catalogue, avec son prix de vente courant pour la marge indicative. */
export type RateProduct = { id: string; title: string; base_price_mad: number; sale_unit: string };

export function PurchaseRatesEditor({
  supplierId,
  contractId,
  contractCurrency,
  rates,
  products,
}: {
  supplierId: string;
  contractId: string;
  contractCurrency: string;
  rates: PurchaseRate[];
  products: RateProduct[];
}) {
  const [open, setOpen] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [state, formAction, isSubmitting] = useActionState<AchatActionState, FormData>(
    createPurchaseRate.bind(null, supplierId, contractId),
    { ok: true },
  );

  const byId = new Map(products.map((p) => [p.id, p]));

  function onDelete(rate: PurchaseRate) {
    const label = byId.get(rate.product_id ?? "")?.title ?? "tarif générique";
    if (!confirm(`Supprimer le tarif d'achat « ${label} » du ${formatDateShort(rate.valid_from)} ?`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await deletePurchaseRate(supplierId, contractId, rate.id);
      if (!res.ok) setRowError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {state.ok === false && (
        <p className="text-[12px] text-[#791F1F] bg-[#FCEBEB] border border-[#F7C1C1] rounded-lg px-3 py-2">{state.error}</p>
      )}
      {rowError && (
        <p className="text-[12px] text-[#791F1F] bg-[#FCEBEB] border border-[#F7C1C1] rounded-lg px-3 py-2">{rowError}</p>
      )}

      {rates.length === 0 ? (
        <p className="text-[13px] text-[#968F84] italic">
          Aucun tarif d&apos;achat sur ce contrat. Un tarif sans produit s&apos;applique à tous les produits du contrat.
        </p>
      ) : (
        <div className="overflow-x-auto border border-[#E5E0D7] rounded-lg">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
              <tr>
                <th className={`${th} text-left`}>Produit</th>
                <th className={`${th} text-left`}>Période</th>
                <th className={`${th} text-left`}>Palier pax</th>
                <th className={`${th} text-right`}>Coût unitaire</th>
                <th className={`${th} text-right`}>Coût enfant</th>
                <th className={`${th} text-right`}>Marge indicative</th>
                <th className={`${th} text-center`}>Prio.</th>
                <th className={`${th}`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EDE5]">
              {rates.map((r) => {
                const p = r.product_id ? byId.get(r.product_id) : null;
                const margin = p ? indicativeMargin(Number(p.base_price_mad), Number(r.unit_cost_mad)) : null;
                const paxLabel =
                  r.min_pax === null && r.max_pax === null
                    ? "—"
                    : `${r.min_pax ?? 1} – ${r.max_pax ?? "∞"}`;
                return (
                  <tr key={r.id} className="hover:bg-[#FBF9F5]">
                    <td className="px-3 py-2.5 text-[#1A1F2E]">
                      {p ? p.title : <span className="text-[#6B6862] italic">Tous les produits du contrat</span>}
                      {Object.keys(r.conditions ?? {}).length > 0 && (
                        <span className="block text-[11px] text-[#968F84]">
                          {Object.entries(r.conditions).map(([k, v]) => `${k} = ${String(v)}`).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[#6B6862] tabular-nums whitespace-nowrap">
                      {formatDateShort(r.valid_from)} → {formatDateShort(r.valid_to)}
                    </td>
                    <td className="px-3 py-2.5 text-[#6B6862] tabular-nums">{paxLabel}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatMAD(r.unit_cost_mad)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#6B6862]">
                      {r.child_cost_mad === null ? "—" : formatMAD(r.child_cost_mad)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {margin === null ? (
                        <span className="text-[#968F84]">—</span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 font-medium"
                          style={{ color: margin.amount >= 0 ? "#0F6E56" : "#791F1F" }}
                        >
                          {margin.amount >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                          {formatMAD(margin.amount)}
                          {margin.pct !== null && (
                            <span className="text-[11px] font-normal text-[#968F84]">
                              {" "}({Math.round(margin.pct)} %)
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-[#6B6862]">{r.priority}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(r)}
                        disabled={isPending}
                        aria-label="Supprimer ce tarif"
                        className="inline-flex items-center justify-center size-7 rounded-md border border-[#E5E0D7] bg-white text-[#6B6862] hover:text-[#791F1F] hover:bg-[#FCEBEB] hover:border-[#F7C1C1] disabled:opacity-50 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-[#968F84]">
        Marge indicative = prix de vente catalogue − coût unitaire. La marge réelle par dossier arrive au lot C3.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[12.5px] font-medium text-white hover:bg-[#2A3142] transition-colors"
        >
          <Plus className="size-4" /> Ajouter un tarif
        </button>
      ) : (
        <form action={formAction} className="rounded-lg p-3 space-y-2.5" style={{ border: "1px dashed #C9C4BA" }}>
          <div className="grid sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-3">
              <label htmlFor="product_id" className={labelCls}>Produit</label>
              <select id="product_id" name="product_id" defaultValue="" className={fieldCls}>
                <option value="">Tous les produits du contrat (tarif générique)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rate_valid_from" className={labelCls}>Du <span className="text-red-600">*</span></label>
              <input id="rate_valid_from" name="valid_from" type="date" required className={fieldCls} />
            </div>
            <div>
              <label htmlFor="rate_valid_to" className={labelCls}>Au <span className="text-red-600">*</span></label>
              <input id="rate_valid_to" name="valid_to" type="date" required className={fieldCls} />
            </div>
            <div>
              <label htmlFor="rate_currency" className={labelCls}>Devise</label>
              <input id="rate_currency" name="currency" className={fieldCls} placeholder={contractCurrency} />
            </div>
            <div>
              <label htmlFor="unit_cost_mad" className={labelCls}>Coût unitaire <span className="text-red-600">*</span></label>
              <input id="unit_cost_mad" name="unit_cost_mad" type="number" step="0.01" min="0" required className={fieldCls} />
            </div>
            <div>
              <label htmlFor="child_cost_mad" className={labelCls}>Coût enfant</label>
              <input id="child_cost_mad" name="child_cost_mad" type="number" step="0.01" min="0" className={fieldCls} placeholder="= adulte" />
            </div>
            <div>
              <label htmlFor="priority" className={labelCls}>Priorité</label>
              <input id="priority" name="priority" type="number" step="1" defaultValue="0" className={fieldCls} />
            </div>
            <div>
              <label htmlFor="min_pax" className={labelCls}>Pax min.</label>
              <input id="min_pax" name="min_pax" type="number" min="1" step="1" className={fieldCls} placeholder="—" />
            </div>
            <div>
              <label htmlFor="max_pax" className={labelCls}>Pax max.</label>
              <input id="max_pax" name="max_pax" type="number" min="1" step="1" className={fieldCls} placeholder="—" />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="conditions" className={labelCls}>Conditions (une par ligne, <code>clé = valeur</code>)</label>
              <textarea
                id="conditions" name="conditions" rows={2}
                placeholder={"room_type = double\ntravel_class = economique"}
                className="w-full rounded-lg border border-[#E0DACF] bg-white px-2.5 py-2 text-[13px] text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors"
              />
            </div>
          </div>
          <p className="text-[11px] text-[#968F84] leading-snug">
            Les chevauchements sont autorisés : un tarif propre au produit l&apos;emporte sur un tarif générique, puis la
            priorité la plus haute, puis le palier de pax le plus étroit.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="submit" disabled={isSubmitting} aria-busy={isSubmitting}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[12px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-60 transition-colors"
            >
              <Check className="size-3.5" /> {isSubmitting ? "Enregistrement…" : "Ajouter le tarif"}
            </button>
            <button
              type="button" onClick={() => setOpen(false)} disabled={isSubmitting}
              className="h-8 px-2.5 text-[12px] text-[#6B6862] hover:text-[#1A1F2E] disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
