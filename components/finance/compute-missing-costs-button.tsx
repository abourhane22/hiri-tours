"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Loader2, CircleCheck, Info } from "lucide-react";
import { computeMissingCosts, type ComputeMissingResult } from "@/app/admin/finance/rentabilite/actions";

export function ComputeMissingCostsButton({ start, end, missingCount }: { start?: string; end?: string; missingCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ComputeMissingResult | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const res = await computeMissingCosts({ start, end });
      setResult(res);
      if (res.ok && res.computed > 0) router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={isPending || missingCount === 0}
        title={missingCount === 0 ? "Tous les dossiers de la période ont un coût figé" : undefined}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E0DACF] bg-white px-3 text-[12.5px] font-medium text-[#1A1F2E] hover:bg-[#FBF9F5] disabled:opacity-50 transition-colors"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
        Calculer les coûts manquants{missingCount > 0 ? ` (${missingCount})` : ""}
      </button>
      {result && result.ok && (
        <div className="text-[12px] rounded-lg px-3 py-2" style={{ backgroundColor: result.computed > 0 ? "#E1F5EE" : "#FAEEDA", color: result.computed > 0 ? "#085041" : "#633806" }}>
          <p className="flex items-center gap-1.5 font-medium">
            {result.computed > 0 ? <CircleCheck className="size-3.5" /> : <Info className="size-3.5" />}
            {result.computed} calculé{result.computed > 1 ? "s" : ""} sur {result.candidates} dossier{result.candidates > 1 ? "s" : ""} sans coût
            {result.candidates - result.computed > 0 && <> · {result.candidates - result.computed} toujours non renseigné{result.candidates - result.computed > 1 ? "s" : ""}</>}
          </p>
          {result.missing.length > 0 && (
            <ul className="mt-1 ml-5 list-disc space-y-0.5">
              {result.missing.map((m) => (
                <li key={m.reason}>
                  {m.count} × {m.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {result && !result.ok && <p className="text-[12px]" style={{ color: "#791F1F" }}>{result.error}</p>}
    </div>
  );
}
