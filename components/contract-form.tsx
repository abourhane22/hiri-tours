"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Plus, Trash2, Info } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { REMUNERATION_MODES, CONTRACT_STATUS_LABEL } from "@/lib/purchasing";
import type { AchatActionState } from "@/app/admin/fournisseurs/actions";
import type { CancellationStep, ContractStatus, PaymentStep, RemunerationMode } from "@/lib/types";

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";
const smallField = `${fieldCls} h-9 text-[13px]`;

export type ContractFormDefaults = {
  reference: string;
  label: string;
  validFrom: string;
  validTo: string;
  currency: string;
  remunerationMode: RemunerationMode;
  commissionRatePct: string;
  markupRatePct: string;
  cancellationPolicy: CancellationStep[];
  paymentSchedule: PaymentStep[];
  releaseDaysDefault: string;
  status: ContractStatus;
  documentUrl: string;
  notes: string;
};

type Action = (prev: AchatActionState, fd: FormData) => Promise<AchatActionState>;

export function ContractForm({
  mode,
  action,
  defaults,
  cancelHref,
}: {
  mode: "create" | "edit";
  action: Action;
  defaults: ContractFormDefaults;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState<AchatActionState, FormData>(action, { ok: true });
  const [remuneration, setRemuneration] = useState<RemunerationMode>(defaults.remunerationMode);
  const [cancellation, setCancellation] = useState<CancellationStep[]>(defaults.cancellationPolicy ?? []);
  const [schedule, setSchedule] = useState<PaymentStep[]>(defaults.paymentSchedule ?? []);

  const remunerationMeta = REMUNERATION_MODES.find((m) => m.value === remuneration);
  const scheduleTotal = schedule.reduce((s, p) => s + (Number(p.pct) || 0), 0);

  return (
    <form action={formAction} className="space-y-4">
      {state.ok === false && <AlertBanner tone="error" message={state.error} />}
      {state.ok && state.savedAt && <AlertBanner tone="success" message="Contrat enregistré." />}

      <input type="hidden" name="cancellation_policy" value={JSON.stringify(cancellation)} />
      <input type="hidden" name="payment_schedule" value={JSON.stringify(schedule)} />

      {/* Section 1 — Le contrat */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={1} title="Contrat" />
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="label" className={labelCls}>
              Libellé <span className="text-red-600">*</span>
            </label>
            <input id="label" name="label" required defaultValue={defaults.label} className={fieldCls} placeholder="Tarifs été 2026" />
          </div>
          <div>
            <label htmlFor="reference" className={labelCls}>Référence fournisseur</label>
            <input id="reference" name="reference" defaultValue={defaults.reference} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="valid_from" className={labelCls}>
              Valide du <span className="text-red-600">*</span>
            </label>
            <input id="valid_from" name="valid_from" type="date" required defaultValue={defaults.validFrom} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="valid_to" className={labelCls}>
              au <span className="text-red-600">*</span>
            </label>
            <input id="valid_to" name="valid_to" type="date" required defaultValue={defaults.validTo} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="status" className={labelCls}>
              Statut <span className="text-red-600">*</span>
            </label>
            <select id="status" name="status" required defaultValue={defaults.status} className={fieldCls}>
              {(Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[]).map((s) => (
                <option key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-[#968F84]">Seuls les contrats « Actif » sont retenus par la résolution tarifaire.</p>
          </div>
          <div>
            <label htmlFor="currency" className={labelCls}>Devise</label>
            <input id="currency" name="currency" defaultValue={defaults.currency} className={fieldCls} placeholder="MAD" />
          </div>
        </div>
      </section>

      {/* Section 2 — Rémunération */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={2} title="Rémunération de l'agence" />
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="remuneration_mode" className={labelCls}>
              Mode <span className="text-red-600">*</span>
            </label>
            <select
              id="remuneration_mode"
              name="remuneration_mode"
              required
              value={remuneration}
              onChange={(e) => setRemuneration(e.target.value as RemunerationMode)}
              className={fieldCls}
            >
              {REMUNERATION_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {remunerationMeta && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[#58524A]">
                <Info className="size-3.5 shrink-0 mt-px text-[#968F84]" />
                {remunerationMeta.hint}
              </p>
            )}
          </div>

          {remuneration === "commission" && (
            <div>
              <label htmlFor="commission_rate" className={labelCls}>
                Taux de commission (%) <span className="text-red-600">*</span>
              </label>
              <input id="commission_rate" name="commission_rate" type="number" step="0.01" min="0" max="100" required defaultValue={defaults.commissionRatePct} className={fieldCls} />
            </div>
          )}
          {remuneration === "markup" && (
            <div>
              <label htmlFor="markup_rate" className={labelCls}>
                Taux de marge (%) <span className="text-red-600">*</span>
              </label>
              <input id="markup_rate" name="markup_rate" type="number" step="0.01" min="0" required defaultValue={defaults.markupRatePct} className={fieldCls} />
            </div>
          )}

          <div>
            <label htmlFor="release_days_default" className={labelCls}>Préavis de release par défaut (jours)</label>
            <input id="release_days_default" name="release_days_default" type="number" min="0" step="1" defaultValue={defaults.releaseDaysDefault} className={fieldCls} />
            <p className="mt-1.5 text-[11px] text-[#968F84]">Proposé aux allotements de ce contrat (lot C2b).</p>
          </div>
          <div>
            <label htmlFor="document_url" className={labelCls}>Contrat signé (URL)</label>
            <input id="document_url" name="document_url" defaultValue={defaults.documentUrl} className={fieldCls} placeholder="https://…" />
          </div>
        </div>
      </section>

      {/* Section 3 — Barème d'annulation */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={3} title="Conditions d'annulation" />
        <p className="text-[12px] text-[#6B6862] mt-2">
          Pénalité due au fournisseur selon le délai avant le départ. Du plus lointain au plus proche.
        </p>
        <div className="mt-3 space-y-2">
          {cancellation.length === 0 && (
            <p className="text-[12px] text-[#968F84] italic">Aucune condition — annulation sans frais.</p>
          )}
          {cancellation.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-[#6B6862]">À plus de</span>
              <input
                type="number" min="0" step="1" value={s.days_before}
                onChange={(e) => setCancellation((cs) => cs.map((c, j) => (j === i ? { ...c, days_before: Number(e.target.value) } : c)))}
                className={`${smallField} w-20`}
              />
              <span className="text-[#6B6862]">jours du départ · pénalité</span>
              <input
                type="number" min="0" max="100" step="1" value={s.penalty_pct}
                onChange={(e) => setCancellation((cs) => cs.map((c, j) => (j === i ? { ...c, penalty_pct: Number(e.target.value) } : c)))}
                className={`${smallField} w-20`}
              />
              <span className="text-[#6B6862]">%</span>
              <button
                type="button" onClick={() => setCancellation((cs) => cs.filter((_, j) => j !== i))}
                aria-label="Retirer ce palier"
                className="inline-flex items-center justify-center size-8 rounded-md border border-[#E5E0D7] bg-white text-[#6B6862] hover:text-[#791F1F] hover:bg-[#FCEBEB] hover:border-[#F7C1C1] transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setCancellation((cs) => [...cs, { days_before: 30, penalty_pct: 0 }])}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E0DACF] bg-white px-2.5 text-[12px] font-medium text-[#1A1F2E] hover:bg-[#FBF9F5] transition-colors"
          >
            <Plus className="size-3.5" /> Ajouter un palier
          </button>
        </div>
      </section>

      {/* Section 4 — Échéancier */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={4} title="Échéancier de paiement" />
        <div className="mt-3 space-y-2">
          {schedule.length === 0 && (
            <p className="text-[12px] text-[#968F84] italic">Aucune échéance — paiement selon les conditions du fournisseur.</p>
          )}
          {schedule.map((p, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_100px_1fr_auto] gap-2 items-center">
              <input
                value={p.label} placeholder="Acompte"
                onChange={(e) => setSchedule((ps) => ps.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                className={smallField}
              />
              <div className="relative">
                <input
                  type="number" min="0" max="100" step="1" value={p.pct}
                  onChange={(e) => setSchedule((ps) => ps.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)))}
                  className={`${smallField} pr-7`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#968F84] pointer-events-none">%</span>
              </div>
              <input
                value={p.due} placeholder="à la confirmation"
                onChange={(e) => setSchedule((ps) => ps.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))}
                className={smallField}
              />
              <button
                type="button" onClick={() => setSchedule((ps) => ps.filter((_, j) => j !== i))}
                aria-label="Retirer cette échéance"
                className="inline-flex items-center justify-center size-8 rounded-md border border-[#E5E0D7] bg-white text-[#6B6862] hover:text-[#791F1F] hover:bg-[#FCEBEB] hover:border-[#F7C1C1] transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setSchedule((ps) => [...ps, { label: "", pct: 0, due: "" }])}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E0DACF] bg-white px-2.5 text-[12px] font-medium text-[#1A1F2E] hover:bg-[#FBF9F5] transition-colors"
            >
              <Plus className="size-3.5" /> Ajouter une échéance
            </button>
            {schedule.length > 0 && (
              <span className="text-[11px]" style={{ color: Math.abs(scheduleTotal - 100) < 0.01 ? "#0F6E56" : "#B25F0B" }}>
                Total : {scheduleTotal} %{Math.abs(scheduleTotal - 100) < 0.01 ? "" : " — ne totalise pas 100 %"}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[#F1EDE5]">
          <label htmlFor="notes" className={labelCls}>Notes internes</label>
          <textarea
            id="notes" name="notes" rows={3} defaultValue={defaults.notes}
            className="w-full rounded-lg border border-[#E0DACF] bg-white px-3 py-2 text-sm text-[#1A1F2E] focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors"
          />
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
          type="submit" disabled={isPending} aria-busy={isPending}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2A3142] disabled:opacity-60"
        >
          <Check className="size-4" />
          {isPending ? "Enregistrement…" : mode === "create" ? "Créer le contrat" : "Enregistrer"}
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
