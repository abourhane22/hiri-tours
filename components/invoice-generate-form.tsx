"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FileText, AlertTriangle, Check } from "lucide-react";
import { generateInvoice, type InvoiceActionState } from "@/app/admin/factures/actions";

const labelCls = "block text-[11px] font-medium text-[#58524A] mb-1";
const fieldCls =
  "h-9 w-full rounded-lg border border-[#E0DACF] bg-white px-2.5 text-[13px] text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

/**
 * Émission d'une facture depuis la fiche réservation. Après succès la page
 * est revalidée côté serveur et la carte affiche la facture émise (plus de
 * régénération possible).
 */
export function InvoiceGenerateForm({
  reservationId,
  defaultTvaRate,
  missingLegal,
  rectification,
}: {
  reservationId: string;
  defaultTvaRate: number;
  missingLegal: string[];
  /** Facture précédente annulée par avoir : la nouvelle est une rectificative. */
  rectification?: {
    cancelledInvoiceNumber: string;
    creditNoteNumber: string;
    /** Avoir encore ouvert, imputable sur la rectificative (sinon null). */
    openRemaining: number | null;
  } | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<InvoiceActionState, FormData>(
    generateInvoice.bind(null, reservationId),
    { ok: true },
  );

  return (
    <div className="space-y-3">
      {missingLegal.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12px]"
          style={{ backgroundColor: "#FFF4E0", border: "1px solid #EF9F27", color: "#7A4B00" }}
        >
          <AlertTriangle className="size-3.5 shrink-0 mt-px" />
          <p>
            Mentions légales incomplètes : <span className="font-medium">{missingLegal.join(", ")}</span>. La facture
            sera émise sans.{" "}
            <Link href="/admin/parametres/societe" className="underline hover:no-underline">
              Compléter l&apos;identité légale
            </Link>
          </p>
        </div>
      )}

      {state.ok === false && (
        <p className="text-[12px] text-[#791F1F] bg-[#FCEBEB] border border-[#F7C1C1] rounded-lg px-3 py-2">{state.error}</p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[12.5px] font-medium text-white hover:bg-[#2A3142] transition-colors"
        >
          <FileText className="size-4" /> Générer la facture
        </button>
      ) : (
        <form action={formAction} className="rounded-lg p-3 space-y-2.5" style={{ border: "1px dashed #C9C4BA" }}>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label htmlFor="tva_rate" className={labelCls}>
                TVA (%)
              </label>
              <input
                id="tva_rate"
                name="tva_rate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                defaultValue={(defaultTvaRate * 100).toFixed(1).replace(/\.0$/, "")}
                className={fieldCls}
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="invoice_notes" className={labelCls}>
                Note sur la facture
              </label>
              <input id="invoice_notes" name="notes" type="text" placeholder="Optionnel" className={fieldCls} />
            </div>
          </div>
          {rectification && (
            <div className="rounded-lg px-3 py-2.5 text-[12px] space-y-1.5" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}>
              <p className="text-[#58524A]">
                Facture rectificative : elle rectifie la facture <span className="font-mono">{rectification.cancelledInvoiceNumber}</span>{" "}
                annulée par l&apos;avoir <span className="font-mono">{rectification.creditNoteNumber}</span>.
              </p>
              {rectification.openRemaining !== null && (
                <label className="flex items-start gap-2 text-[#1A1F2E]">
                  <input type="checkbox" name="impute_credit_note" defaultChecked className="mt-0.5 size-4 rounded border-sand-300" />
                  <span>
                    Imputer l&apos;avoir <span className="font-mono">{rectification.creditNoteNumber}</span> (
                    {rectification.openRemaining.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD) sur
                    cette facture rectificative
                    <span className="block text-[11px] text-[#968F84]">
                      Sans encaissement : les règlements du dossier couvrent la nouvelle facture. L&apos;avoir est soldé et
                      n&apos;apparaît plus comme crédit du client. Décochez si le client a été remboursé ou garde son crédit.
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}
          <p className="text-[11px] text-[#968F84] leading-snug">
            Le numéro est attribué à l&apos;émission (séquence continue par année). Le document est figé : les
            modifications ultérieures du dossier ou de la société ne l&apos;affecteront pas.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[12px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-60 transition-colors"
            >
              <Check className="size-3.5" />
              {isPending ? "Émission…" : "Confirmer l'émission"}
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
