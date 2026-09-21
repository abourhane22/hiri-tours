"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { refreshExpectedCost } from "@/app/admin/reservations/[id]/margin-actions";

export function RefreshCostButton({ reservationId, hasSnapshot }: { reservationId: string; hasSnapshot: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (hasSnapshot && !confirm("Recalculer le coût prévisionnel avec les tarifs d'achat actuels ?\n\nL'ancien coût est conservé dans l'historique du dossier.")) return;
    setError(null);
    startTransition(async () => {
      const res = await refreshExpectedCost(reservationId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E0D7] bg-white px-3 text-[12px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] disabled:opacity-60 transition-colors"
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        {hasSnapshot ? "Actualiser le coût prévisionnel" : "Calculer le coût prévisionnel"}
      </button>
      {error && <p className="text-[12px]" style={{ color: "#791F1F" }}>{error}</p>}
    </div>
  );
}
