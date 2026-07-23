"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { AttijariLogo } from "@/components/payer/attijari-logo";
import { initiateAttijariPayment } from "@/app/payer/actions";

/**
 * Moyen de paiement "Attijari Payment — carte marocaine" (ACTIF).
 * Lance la création de l'ordre puis la redirection vers la gateway simulée.
 */
export function AttijariMethodButton({
  reservationId,
  hasLogo,
}: {
  reservationId: string;
  hasLogo: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      // En cas de succès, l'action redirige (ne renvoie rien).
      const result = await initiateAttijariPayment(reservationId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="group w-full flex items-center gap-4 rounded-xl border-2 border-[#F0C89A] bg-white px-4 py-4 text-left transition-colors hover:border-[#E67817] hover:bg-[#FFF9F2] disabled:opacity-60 disabled:pointer-events-none"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FFF4E0] shrink-0">
          {isPending ? (
            <Loader2 className="size-5 animate-spin text-[#8A5A00]" />
          ) : (
            <span className="text-lg">💳</span>
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <AttijariLogo hasLogo={hasLogo} className="h-6" />
          </span>
          <span className="block text-xs text-sand-600 mt-0.5">
            Carte marocaine · 3D Secure
          </span>
        </span>
        <ChevronRight className="size-5 text-sand-400 group-hover:text-[#E67817] shrink-0" />
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
