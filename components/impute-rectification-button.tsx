"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Loader2 } from "lucide-react";
import { imputeRectificationAction } from "@/app/admin/avoirs/actions";

/** Page avoir : imputer l'avoir ouvert sur la facture rectificative du dossier (sans paiement). */
export function ImputeRectificationButton({
  creditNoteId,
  creditNoteNumber,
  invoiceNumber,
  remaining,
}: {
  creditNoteId: string;
  creditNoteNumber: string;
  invoiceNumber: string;
  remaining: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (
      !confirm(
        `Imputer l'avoir ${creditNoteNumber} (${remaining}) sur la facture rectificative ${invoiceNumber} ?\n\n` +
          "Aucun encaissement n'est créé : les règlements du dossier couvrent la nouvelle facture. L'avoir sera soldé " +
          "et ne sera plus un crédit du client. À ne pas faire si le client a été remboursé ou garde son crédit.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await imputeRectificationAction(creditNoteId);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}>
      <p className="text-[12px] text-[#58524A]">
        Le dossier porte la facture rectificative <span className="font-mono">{invoiceNumber}</span>, émise après cet avoir.
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[12px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-60 transition-colors"
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <FileCheck2 className="size-3.5" />}
        Imputer sur la facture rectificative {invoiceNumber}
      </button>
      {error && <p className="text-[12px] text-[#791F1F]">{error}</p>}
    </div>
  );
}
