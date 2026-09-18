"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteAllotment } from "@/app/admin/allotements/actions";

export function AllotmentDangerZone({ allotmentId, label, movementCount }: { allotmentId: string; label: string; movementCount: number }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const blocked = movementCount > 0;

  function onDelete() {
    if (blocked) return;
    if (!confirm(`Supprimer l'allotement « ${label} » et ses compteurs ?\n\nAucune vente n'y est rattachée, l'opération est sûre.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAllotment(allotmentId);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="bg-white border border-[#F7C1C1] rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Trash2 className="size-[13px] text-[#791F1F]" />
        <span className="text-[10.5px] tracking-[1.4px] uppercase text-[#791F1F] font-medium">Zone de danger</span>
      </div>
      {blocked ? (
        <p className="text-[13px] text-[#6B6862] leading-relaxed">
          Suppression impossible : <span className="font-medium text-[#1A1F2E]">{movementCount} mouvement{movementCount > 1 ? "s" : ""}</span> de stock
          sont rattachés à cet allotement. Décochez « Allotement actif » pour le retirer de la vente en conservant l&apos;historique.
        </p>
      ) : (
        <>
          <p className="text-[13px] text-[#6B6862] mb-3 leading-relaxed">
            Supprime l&apos;allotement et ses compteurs. Aucune vente n&apos;y est rattachée.
          </p>
          {error && <p className="text-[12px] text-[#791F1F] bg-[#FCEBEB] border border-[#F7C1C1] rounded-lg px-3 py-2 mb-3">{error}</p>}
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#A32D2D] px-3 text-[12.5px] font-medium text-white hover:bg-[#8B2525] disabled:opacity-60 transition-colors"
          >
            <Trash2 className="size-4" /> {isPending ? "Suppression…" : "Supprimer l'allotement"}
          </button>
        </>
      )}
    </div>
  );
}
