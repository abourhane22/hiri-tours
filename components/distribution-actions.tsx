"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, AlertTriangle, Ban, CircleCheck } from "lucide-react";
import { issueOrderAction, cancelOrderAction, type OrderActionResult, type CancelOrderResult } from "@/app/admin/billetterie/order-actions";

export function DistributionActions({
  bookingId,
  canIssue,
  canCancel,
  blockedReason,
  lastFailure,
}: {
  bookingId: string;
  canIssue: boolean;
  canCancel: boolean;
  blockedReason?: string | null;
  /** failure_message persistant de la dernière tentative — remplacé par le résultat courant, jamais cumulé. */
  lastFailure?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [issue, setIssue] = useState<OrderActionResult | null>(null);
  const [cancel, setCancel] = useState<CancelOrderResult | null>(null);

  function onIssue() {
    if (!confirm("Émettre l'ordre auprès de Duffel avec les voyageurs du dossier ?\n\nEnvironnement de test : aucun billet réel, aucun paiement.")) return;
    setIssue(null);
    startTransition(async () => {
      const res = await issueOrderAction(bookingId);
      setIssue(res);
      if (res.ok) router.refresh();
    });
  }

  function onCancel() {
    if (!confirm("Annuler l'ordre Duffel ? Un devis d'annulation est demandé puis confirmé immédiatement.")) return;
    setCancel(null);
    startTransition(async () => {
      const res = await cancelOrderAction(bookingId);
      setCancel(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-2.5">
      {blockedReason && (
        <p className="flex items-start gap-1.5 text-[12px] rounded-lg px-3 py-2" style={{ backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }}>
          <AlertTriangle className="size-3.5 shrink-0 mt-px" /> {blockedReason}
        </p>
      )}

      {lastFailure && !issue && !cancel && (
        <p className="flex items-start gap-1.5 text-[12px] rounded-lg px-3 py-2" style={{ backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }}>
          <AlertTriangle className="size-3.5 shrink-0 mt-px" />
          <span><span className="font-medium">Dernière tentative refusée :</span> {lastFailure}</span>
        </p>
      )}

      {issue && !issue.ok && (
        <div className="text-[12px] rounded-lg px-3 py-2" style={{ backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }}>
          <p className="flex items-start gap-1.5"><AlertTriangle className="size-3.5 shrink-0 mt-px" /> {issue.error}</p>
          {issue.missing && issue.missing.length > 0 && (
            <ul className="mt-1.5 ml-5 list-disc space-y-0.5">
              {issue.missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
        </div>
      )}
      {issue?.ok && (
        <p className="flex items-start gap-1.5 text-[12px] rounded-lg px-3 py-2" style={{ backgroundColor: "#E1F5EE", border: "1px solid #A9DFCC", color: "#085041" }}>
          <CircleCheck className="size-3.5 shrink-0 mt-px" />
          Ordre émis · référence {issue.bookingReference ?? "—"} · {issue.documents} e-ticket{issue.documents > 1 ? "s" : ""}.
        </p>
      )}
      {cancel && !cancel.ok && (
        <p className="flex items-start gap-1.5 text-[12px] rounded-lg px-3 py-2" style={{ backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }}>
          <AlertTriangle className="size-3.5 shrink-0 mt-px" /> {cancel.error}
        </p>
      )}
      {cancel?.ok && (
        <p className="flex items-start gap-1.5 text-[12px] rounded-lg px-3 py-2" style={{ backgroundColor: "#E1F5EE", border: "1px solid #A9DFCC", color: "#085041" }}>
          <CircleCheck className="size-3.5 shrink-0 mt-px" />
          Ordre annulé{cancel.refundAmount ? ` · remboursement ${cancel.refundAmount} ${cancel.refundCurrency ?? ""} (${cancel.refundTo ?? "—"})` : ""}.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {canIssue && (
          <button
            type="button"
            onClick={onIssue}
            disabled={isPending}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[12.5px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-60 transition-colors"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {isPending ? "Émission…" : "Émettre l'ordre"}
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#F7C1C1] bg-white px-3 text-[12.5px] font-medium text-[#791F1F] hover:bg-[#FCEBEB] disabled:opacity-60 transition-colors"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
            Annuler l&apos;ordre
          </button>
        )}
      </div>
    </div>
  );
}
