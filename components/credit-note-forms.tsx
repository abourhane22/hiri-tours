"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { FileMinus, Check, AlertTriangle, Undo2 } from "lucide-react";
import { formatMAD } from "@/lib/utils";
import { CREDIT_NOTE_REASONS, REFUND_METHODS } from "@/lib/credit-notes";
import {
  issueCreditNote,
  refundCreditNote,
  regularizeCancelledReservation,
  type CreditNoteActionState,
} from "@/app/admin/avoirs/actions";

const labelCls = "block text-[11px] font-medium text-[#58524A] mb-1";
const fieldCls =
  "h-9 w-full rounded-lg border border-[#E0DACF] bg-white px-2.5 text-[13px] text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";
const primaryBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[12px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-60 transition-colors";

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] text-[#791F1F] bg-[#FCEBEB] border border-[#F7C1C1] rounded-lg px-3 py-2">{children}</p>
  );
}

/** Émission d'un avoir depuis la page facture. */
export function IssueCreditNoteForm({
  invoiceId,
  maxAmount,
  totalTtc,
  alreadyCredited,
}: {
  invoiceId: string;
  maxAmount: number;
  totalTtc: number;
  alreadyCredited: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<CreditNoteActionState, FormData>(
    async (prev, fd) => {
      const res = await issueCreditNote(invoiceId, prev, fd);
      if (res.ok && res.creditNoteId) router.push(`/admin/avoirs/${res.creditNoteId}`);
      return res;
    },
    { ok: true },
  );

  if (maxAmount <= 0.01) {
    return (
      <p className="text-[12px] text-[#6B6862]">
        Le total de cette facture est intégralement couvert par des avoirs ({formatMAD(alreadyCredited)}).
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {state.ok === false && <ErrorLine>{state.error}</ErrorLine>}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
          <FileMinus className="size-3.5" /> Émettre un avoir
        </button>
      ) : (
        <form action={formAction} className="rounded-lg p-3 space-y-2.5" style={{ border: "1px dashed #C9C4BA" }}>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="cn_amount" className={labelCls}>
                Montant de l&apos;avoir (MAD) <span className="text-red-600">*</span>
              </label>
              <input
                id="cn_amount"
                name="amount_mad"
                type="number"
                step="0.01"
                min="0.01"
                max={maxAmount}
                required
                defaultValue={maxAmount.toFixed(2)}
                className={fieldCls}
              />
              <p className="mt-1 text-[11px] text-[#968F84]">
                Maximum {formatMAD(maxAmount)}
                {alreadyCredited > 0 && <> · {formatMAD(alreadyCredited)} déjà crédités sur {formatMAD(totalTtc)}</>}
              </p>
            </div>
            <div>
              <label htmlFor="cn_reason" className={labelCls}>
                Motif <span className="text-red-600">*</span>
              </label>
              <select id="cn_reason" name="reason" required defaultValue="" className={fieldCls}>
                <option value="" disabled>
                  — Choisir —
                </option>
                {CREDIT_NOTE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="cn_details" className={labelCls}>
              Précision (facultatif)
            </label>
            <input id="cn_details" name="reason_details" type="text" className={fieldCls} placeholder="Apparaîtra sur l'avoir" />
          </div>
          <p className="text-[11px] text-[#968F84] leading-snug">
            Le numéro est attribué à l&apos;émission (séquence continue par année). Si le cumul des avoirs atteint le total
            de la facture, celle-ci passe automatiquement en « Annulée par avoir ».
          </p>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={isPending} aria-busy={isPending} className={primaryBtn}>
              <Check className="size-3.5" />
              {isPending ? "Émission…" : "Émettre l'avoir"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
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

/** Remboursement déclaré depuis la page de l'avoir. */
export function RefundCreditNoteForm({ creditNoteId, remaining }: { creditNoteId: string; remaining: number }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<string>("cash");
  const [state, formAction, isPending] = useActionState<CreditNoteActionState, FormData>(
    refundCreditNote.bind(null, creditNoteId),
    { ok: true },
  );
  const needsRef = REFUND_METHODS.find((m) => m.value === method)?.needsRef ?? false;

  return (
    <div className="space-y-2.5">
      {state.ok === false && <ErrorLine>{state.error}</ErrorLine>}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
          <Undo2 className="size-3.5" /> Rembourser
        </button>
      ) : (
        <form action={formAction} className="rounded-lg p-3 space-y-2.5" style={{ border: "1px dashed #C9C4BA" }}>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="rf_amount" className={labelCls}>
                Montant (MAD) <span className="text-red-600">*</span>
              </label>
              <input
                id="rf_amount"
                name="amount_mad"
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                required
                defaultValue={remaining.toFixed(2)}
                className={fieldCls}
              />
              <p className="mt-1 text-[11px] text-[#968F84]">Solde disponible {formatMAD(remaining)}</p>
            </div>
            <div>
              <label htmlFor="rf_method" className={labelCls}>
                Mode <span className="text-red-600">*</span>
              </label>
              <select
                id="rf_method"
                name="method"
                required
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={fieldCls}
              >
                {REFUND_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="rf_reference" className={labelCls}>
              Référence {needsRef && <span className="text-red-600">*</span>}
            </label>
            <input
              id="rf_reference"
              name="reference"
              type="text"
              required={needsRef}
              className={fieldCls}
              placeholder={needsRef ? "N° de virement / référence du remboursement carte" : "Facultatif"}
            />
            {method === "card_manual" && (
              <p className="mt-1 text-[11px] text-[#B25F0B]">
                Le remboursement carte n&apos;est pas automatisé : effectuez-le dans l&apos;interface du prestataire, puis
                reportez sa référence ici.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="rf_notes" className={labelCls}>
              Note (facultatif)
            </label>
            <input id="rf_notes" name="notes" type="text" className={fieldCls} />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={isPending} aria-busy={isPending} className={primaryBtn}>
              <Check className="size-3.5" />
              {isPending ? "Enregistrement…" : "Enregistrer le remboursement"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
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

/** Dossier annulé encaissé et jamais facturé : facture de régularisation + avoir total. */
export function RegularizeCancelledForm({ reservationId, paid }: { reservationId: string; paid: number }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<CreditNoteActionState, FormData>(
    async (prev, fd) => {
      const res = await regularizeCancelledReservation(reservationId, prev, fd);
      if (res.ok && res.creditNoteId) router.push(`/admin/avoirs/${res.creditNoteId}`);
      return res;
    },
    { ok: true },
  );

  return (
    <div className="space-y-2.5">
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12px]"
        style={{ backgroundColor: "#FFF4E0", border: "1px solid #EF9F27", color: "#7A4B00" }}
      >
        <AlertTriangle className="size-3.5 shrink-0 mt-px" />
        <p>
          Ce dossier annulé porte <span className="font-medium">{formatMAD(paid)}</span> encaissés sans facture. La
          régularisation émet la facture correspondante puis un avoir du même montant, réutilisable ou remboursable.
        </p>
      </div>
      {state.ok === false && <ErrorLine>{state.error}</ErrorLine>}
      <form action={formAction} className="space-y-2.5">
        <input type="hidden" name="reason_details" value="Annulation du dossier — sommes encaissées à restituer ou à réutiliser." />
        <button type="submit" disabled={isPending} aria-busy={isPending} className={`${primaryBtn} w-full justify-center h-9`}>
          <FileMinus className="size-4" />
          {isPending ? "Régularisation…" : `Régulariser : facture + avoir de ${formatMAD(paid)}`}
        </button>
      </form>
    </div>
  );
}
