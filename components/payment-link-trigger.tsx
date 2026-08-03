"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { createPaymentLink } from "@/app/admin/reservations/[id]/payment-link-actions";

/**
 * Bouton d'en-tête à deux niveaux qui déclenche la génération du lien de
 * paiement en ligne (EDP partenaire · Attijari Payment). Si un lien actif
 * existe déjà, fait défiler jusqu'au panneau plutôt que d'en régénérer un.
 */
export function PaymentLinkTrigger({
  reservationId,
  hasActiveLink,
}: {
  reservationId: string;
  hasActiveLink: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);

  function handleClick() {
    if (isPending) return;
    if (hasActiveLink) {
      document
        .getElementById("payment-link-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createPaymentLink(reservationId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="w-full sm:w-auto">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="w-full sm:w-auto inline-flex items-center gap-2 rounded-lg bg-[#1A1F2E] text-white px-3.5 py-1.5 hover:bg-[#2A3142] transition-colors disabled:opacity-60 justify-start"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin shrink-0" />
        ) : (
          !logoFailed && (
            <span className="bg-white rounded-md px-1.5 py-0.5 inline-flex items-center shrink-0">
              <Image
                src="/attijari-logo.png"
                alt="Attijari Payment"
                width={627}
                height={318}
                className="h-[15px] w-auto"
                onError={() => setLogoFailed(true)}
              />
            </span>
          )
        )}
        <span className="text-left leading-tight">
          <span className="block text-[12.5px] font-medium">Lien de Paiement en Ligne</span>
          <span className="block text-[10px] font-normal opacity-70">
            via EDP Partenaire · Attijari Payment
          </span>
        </span>
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
