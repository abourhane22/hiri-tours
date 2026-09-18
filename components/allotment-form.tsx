"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Info, Lock } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import {
  COMMITMENT_LABEL,
  COMMITMENT_HINT,
  ON_EXHAUSTED_LABEL,
  ON_EXHAUSTED_HINT,
  WEEKDAY_SHORT,
  WEEKDAYS_MONDAY_FIRST,
} from "@/lib/allotments";
import type { AllotmentActionState } from "@/app/admin/allotements/actions";
import type { AllotmentCommitment, AllotmentOnExhausted } from "@/lib/types";

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors disabled:bg-[#FBF9F5] disabled:text-[#968F84]";
const hintCls = "mt-1.5 flex items-start gap-1.5 text-[11px] text-[#968F84]";

export type ProductOption = { id: string; title: string; max_participants: number };
export type ContractOption = { id: string; label: string; supplierName: string; releaseDaysDefault: number };

export type AllotmentFormDefaults = {
  productId: string;
  origin: "own" | "contract";
  contractId: string;
  label: string;
  startsOn: string;
  endsOn: string;
  quotaPerDay: string;
  weekdays: number[] | null;
  releaseDays: string;
  commitment: AllotmentCommitment;
  onExhausted: AllotmentOnExhausted;
  isActive: boolean;
  notes: string;
};

type Action = (prev: AllotmentActionState, fd: FormData) => Promise<AllotmentActionState>;

export function AllotmentForm({
  mode,
  action,
  defaults,
  products,
  contracts,
  cancelHref,
  /** Édition : le produit est verrouillé, on affiche son titre. */
  productTitle,
}: {
  mode: "create" | "edit";
  action: Action;
  defaults: AllotmentFormDefaults;
  products: ProductOption[];
  contracts: ContractOption[];
  cancelHref: string;
  productTitle?: string;
}) {
  const [state, formAction, isPending] = useActionState<AllotmentActionState, FormData>(action, { ok: true });

  const [productId, setProductId] = useState(defaults.productId);
  const [origin, setOrigin] = useState<"own" | "contract">(defaults.origin);
  const [contractId, setContractId] = useState(defaults.contractId);
  const [commitment, setCommitment] = useState<AllotmentCommitment>(defaults.commitment);
  const [onExhausted, setOnExhausted] = useState<AllotmentOnExhausted>(defaults.onExhausted);
  const [releaseDays, setReleaseDays] = useState(defaults.releaseDays);
  const [quota, setQuota] = useState(defaults.quotaPerDay);
  const [checked, setChecked] = useState<Set<number>>(
    new Set(defaults.weekdays && defaults.weekdays.length > 0 ? defaults.weekdays : [0, 1, 2, 3, 4, 5, 6]),
  );

  const product = products.find((p) => p.id === productId);
  const capacity = product?.max_participants ?? null;
  const quotaNum = Number(quota) || 0;
  const quotaAboveCapacity = capacity !== null && capacity > 0 && quotaNum > capacity;

  function pickContract(id: string) {
    setContractId(id);
    const c = contracts.find((x) => x.id === id);
    // Le préavis du contrat est proposé, jamais imposé.
    if (c && (!releaseDays || releaseDays === "0")) setReleaseDays(String(c.releaseDaysDefault));
  }

  function toggleDay(d: number) {
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.ok === false && <AlertBanner tone="error" message={state.error} />}
      {state.ok && state.savedAt && <AlertBanner tone="success" message="Allotement enregistré — compteurs resynchronisés." />}

      {/* Section 1 — Produit et origine */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={1} title="Produit et origine de la capacité" />
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="sm:col-span-2">
            <label htmlFor="product_id" className={labelCls}>
              Produit <span className="text-red-600">*</span>
            </label>
            {mode === "create" ? (
              <>
                <select
                  id="product_id"
                  name="product_id"
                  required
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className={fieldCls}
                >
                  <option value="" disabled>— Choisir un produit —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} · cap. {p.max_participants} pax / dossier
                    </option>
                  ))}
                </select>
                <p className={hintCls}>
                  <Info className="size-3.5 shrink-0 mt-px" />
                  Un allotement est lié à son produit ; il ne pourra plus être changé ensuite.
                </p>
              </>
            ) : (
              <>
                <div className={`${fieldCls} flex items-center gap-2`} aria-readonly>
                  <Lock className="size-3.5 text-[#968F84] shrink-0" />
                  <span className="truncate">{productTitle ?? "Produit"}</span>
                </div>
                <p className={hintCls}>
                  <Info className="size-3.5 shrink-0 mt-px" />
                  Le produit d&apos;un allotement ne se modifie pas : les compteurs matérialisés le portent.
                  Pour changer de produit, supprimez cet allotement et recréez-en un.
                </p>
              </>
            )}
          </div>

          <div className="sm:col-span-2">
            <span className={labelCls}>Origine de la capacité <span className="text-red-600">*</span></span>
            <div className="grid sm:grid-cols-2 gap-2">
              <label
                className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
                  origin === "own" ? "border-[#1A1F2E] bg-[#FBF9F5]" : "border-[#E0DACF] hover:bg-[#FBF9F5]"
                }`}
              >
                <input type="radio" name="origin" value="own" checked={origin === "own"} onChange={() => setOrigin("own")} className="mt-1" />
                <span>
                  <span className="block text-[13px] font-medium text-[#1A1F2E]">Capacité propre</span>
                  <span className="block text-[11px] text-[#6B6862] mt-0.5">
                    L&apos;agence est son propre fournisseur : excursions maison, véhicules de la flotte. Engagement garanti.
                  </span>
                </span>
              </label>
              <label
                className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
                  origin === "contract" ? "border-[#1A1F2E] bg-[#FBF9F5]" : "border-[#E0DACF] hover:bg-[#FBF9F5]"
                }`}
              >
                <input type="radio" name="origin" value="contract" checked={origin === "contract"} onChange={() => setOrigin("contract")} className="mt-1" />
                <span>
                  <span className="block text-[13px] font-medium text-[#1A1F2E]">Contrat fournisseur</span>
                  <span className="block text-[11px] text-[#6B6862] mt-0.5">
                    Places négociées avec un hôtelier, un transporteur ou une compagnie.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {origin === "contract" && (
            <div className="sm:col-span-2">
              <label htmlFor="contract_id" className={labelCls}>
                Contrat <span className="text-red-600">*</span>
              </label>
              <select id="contract_id" name="contract_id" required value={contractId} onChange={(e) => pickContract(e.target.value)} className={fieldCls}>
                <option value="" disabled>— Choisir un contrat actif —</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.supplierName} — {c.label}
                  </option>
                ))}
              </select>
              {contracts.length === 0 && (
                <p className={hintCls}>
                  <Info className="size-3.5 shrink-0 mt-px" />
                  Aucun contrat actif. Créez-le d&apos;abord dans Fournisseurs &amp; contrats.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section 2 — Période et quota */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={2} title="Période et quota" />
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div className="sm:col-span-3">
            <label htmlFor="label" className={labelCls}>
              Libellé <span className="text-red-600">*</span>
            </label>
            <input id="label" name="label" required defaultValue={defaults.label} className={fieldCls} placeholder="Été 2026 — 12 places / jour" />
          </div>
          <div>
            <label htmlFor="starts_on" className={labelCls}>
              Du <span className="text-red-600">*</span>
            </label>
            <input id="starts_on" name="starts_on" type="date" required defaultValue={defaults.startsOn} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="ends_on" className={labelCls}>
              Au <span className="text-red-600">*</span>
            </label>
            <input id="ends_on" name="ends_on" type="date" required defaultValue={defaults.endsOn} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="quota_per_day" className={labelCls}>
              Places par jour <span className="text-red-600">*</span>
            </label>
            <input
              id="quota_per_day"
              name="quota_per_day"
              type="number"
              min="1"
              step="1"
              required
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              className={fieldCls}
            />
            {quotaAboveCapacity && (
              <p className="mt-1.5 text-[11px]" style={{ color: "#B25F0B" }}>
                Supérieur à la capacité par dossier du produit ({capacity} pax) — possible si plusieurs dossiers partent le même jour.
              </p>
            )}
          </div>

          <div className="sm:col-span-3">
            <span className={labelCls}>Jours de départ</span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS_MONDAY_FIRST.map((d) => {
                const on = checked.has(d);
                return (
                  <label
                    key={d}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] cursor-pointer select-none transition-colors ${
                      on ? "border-[#1A1F2E] bg-[#1A1F2E] text-white" : "border-[#E0DACF] bg-white text-[#58524A] hover:bg-[#FBF9F5]"
                    }`}
                  >
                    <input type="checkbox" name={`wd_${d}`} checked={on} onChange={() => toggleDay(d)} className="sr-only" />
                    {WEEKDAY_SHORT[d]}
                  </label>
                );
              })}
            </div>
            <p className={hintCls}>
              <Info className="size-3.5 shrink-0 mt-px" />
              Un jour décoché n&apos;a pas de compteur : aucun départ n&apos;y est piloté. Tous cochés = tous les jours.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3 — Règles */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={3} title="Règles de vente" />
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div>
            <label htmlFor="on_exhausted" className={labelCls}>
              À épuisement du quota <span className="text-red-600">*</span>
            </label>
            <select id="on_exhausted" name="on_exhausted" value={onExhausted} onChange={(e) => setOnExhausted(e.target.value as AllotmentOnExhausted)} className={fieldCls}>
              {(Object.keys(ON_EXHAUSTED_LABEL) as AllotmentOnExhausted[]).map((k) => (
                <option key={k} value={k}>{ON_EXHAUSTED_LABEL[k]}</option>
              ))}
            </select>
            <p className={hintCls}>
              <Info className="size-3.5 shrink-0 mt-px" />
              {ON_EXHAUSTED_HINT[onExhausted]}
            </p>
          </div>

          <div>
            <label htmlFor="commitment" className={labelCls}>Engagement</label>
            {origin === "own" ? (
              <>
                <input type="hidden" name="commitment" value="guaranteed" />
                <div className={`${fieldCls} flex items-center gap-2`}>
                  <Lock className="size-3.5 text-[#968F84]" /> Garanti
                </div>
                <p className={hintCls}>
                  <Info className="size-3.5 shrink-0 mt-px" />
                  Une capacité propre est nécessairement garantie.
                </p>
              </>
            ) : (
              <>
                <select id="commitment" name="commitment" value={commitment} onChange={(e) => setCommitment(e.target.value as AllotmentCommitment)} className={fieldCls}>
                  {(Object.keys(COMMITMENT_LABEL) as AllotmentCommitment[]).map((k) => (
                    <option key={k} value={k}>{COMMITMENT_LABEL[k]}</option>
                  ))}
                </select>
                <p className={hintCls}>
                  <Info className="size-3.5 shrink-0 mt-px" />
                  {COMMITMENT_HINT[commitment]}
                </p>
              </>
            )}
          </div>

          <div>
            <label htmlFor="release_days" className={labelCls}>Release (jours avant)</label>
            <input id="release_days" name="release_days" type="number" min="0" step="1" value={releaseDays} onChange={(e) => setReleaseDays(e.target.value)} className={fieldCls} />
            <p className={hintCls}>
              <Info className="size-3.5 shrink-0 mt-px" />
              À J−n, les places invendues sont rendues et le jour n&apos;est plus vendable. 0 = pas de release.
            </p>
          </div>

          <div className="sm:col-span-3 flex items-center gap-2">
            <input id="is_active" name="is_active" type="checkbox" defaultChecked={defaults.isActive} className="size-4 rounded border-[#E0DACF]" />
            <label htmlFor="is_active" className="text-[13px] text-[#1A1F2E]">Allotement actif</label>
            <span className="text-[11px] text-[#968F84]">— désactivé, il garde ses compteurs et son historique mais ne pilote plus la vente.</span>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="notes" className={labelCls}>Notes internes</label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={defaults.notes}
              className="w-full rounded-lg border border-[#E0DACF] bg-white px-3 py-2 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[#E0DACF] bg-white px-4 text-sm font-medium text-[#1A1F2E] hover:bg-sand-50 transition-colors"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2A3142] disabled:opacity-60"
        >
          <Check className="size-4" />
          {isPending ? "Enregistrement…" : mode === "create" ? "Créer l'allotement" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-5 rounded-md bg-[#1A1F2E] text-white text-[11px] font-medium flex items-center justify-center">{n}</span>
      <h2 className="font-display text-base text-[#1A1F2E] m-0">{title}</h2>
    </div>
  );
}
