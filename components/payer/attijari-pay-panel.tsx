"use client";

import { useState, useTransition } from "react";
import {
  Lock,
  CircleCheck,
  CreditCard,
  ShieldCheck,
  Smartphone,
  Clock,
  Loader2,
} from "lucide-react";
import { formatMAD } from "@/lib/utils";
import { initiateAttijariPayment, createStripeCheckout } from "@/app/payer/actions";
import { AttijariLogo } from "@/components/payer/attijari-logo";

type Method = "attijari" | "stripe";

/**
 * Sélecteur de moyen de paiement (Attijari carte marocaine · Stripe carte
 * internationale) + bouton principal. Le bouton lance la server action du
 * moyen sélectionné (les deux redirigent en cas de succès).
 */
export function AttijariPayPanel({
  reservationId,
  remaining,
  hasLogo,
}: {
  reservationId: string;
  remaining: number;
  hasLogo: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>("attijari");

  function pay() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      // En cas de succès, l'action redirige (ne renvoie rien).
      const result =
        method === "stripe"
          ? await createStripeCheckout(reservationId)
          : await initiateAttijariPayment(reservationId);
      if (result?.error) setError(result.error);
    });
  }

  const cardCls = (active: boolean) =>
    `text-left rounded-xl border-2 p-4 transition-colors disabled:opacity-70 disabled:pointer-events-none ${
      active
        ? "border-[#0F6E56] bg-[#F7FCFA] hover:bg-[#EFF9F5]"
        : "border-[#E5E0D7] bg-white hover:border-[#C9C0AE]"
    }`;

  return (
    <div className="space-y-4">
      {/* Sélecteur moyen de paiement */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Attijari — carte marocaine */}
        <button
          type="button"
          onClick={() => setMethod("attijari")}
          disabled={isPending}
          aria-pressed={method === "attijari"}
          className={cardCls(method === "attijari")}
        >
          <div className="flex items-center justify-between gap-2">
            <AttijariLogo hasLogo={hasLogo} className="h-7" />
            {method === "attijari" && <CircleCheck className="size-5 text-[#0F6E56] shrink-0" />}
          </div>
          <div className="text-xs text-[#6B6862] mt-2.5">
            Carte bancaire marocaine · CIH, Attijariwafa, BP…
          </div>
        </button>

        {/* Stripe — carte internationale */}
        <button
          type="button"
          onClick={() => setMethod("stripe")}
          disabled={isPending}
          aria-pressed={method === "stripe"}
          className={cardCls(method === "stripe")}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <CreditCard className="size-5 text-[#3C3489]" />
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: "#EEEDFE", color: "#3C3489" }}
              >
                Stripe
              </span>
            </span>
            {method === "stripe" && <CircleCheck className="size-5 text-[#0F6E56] shrink-0" />}
          </div>
          <div className="mt-2.5 text-sm font-semibold text-[#1A1F2E]">Carte internationale</div>
          <div className="text-xs text-[#6B6862] mt-0.5">Visa · Mastercard · Amex</div>
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Bouton principal */}
      <button
        type="button"
        onClick={pay}
        disabled={isPending}
        aria-busy={isPending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F6E56] py-3 text-white font-medium transition-colors hover:bg-[#085041] disabled:opacity-60 disabled:pointer-events-none"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Redirection…
          </>
        ) : (
          <>
            <Lock className="size-4" />
            Payer {formatMAD(remaining)}
          </>
        )}
      </button>

      {/* Rangée de confiance */}
      <div className="flex items-center justify-center gap-x-3 gap-y-1.5 flex-wrap text-[11px] text-[#968F84]">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="size-[13px]" />
          Connexion chiffrée SSL
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Smartphone className="size-[13px]" />
          Vérification 3D Secure
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-[13px]" />
          Confirmation immédiate
        </span>
      </div>
    </div>
  );
}
