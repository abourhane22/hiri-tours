"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Info, Lock } from "lucide-react";
import { CustomerPicker } from "@/components/customer-picker";
import { formatMAD } from "@/lib/utils";
import { amountNumber, formatMoney, type DuffelOffer } from "@/lib/duffel";
import { fxConvert } from "@/lib/distribution";
import { createDossierFromOfferAction, type CreateDossierState } from "@/app/admin/billetterie/actions";
import type { Customer } from "@/lib/types";

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

/**
 * Offre → dossier. Le client est choisi avec le sélecteur existant
 * (anti-doublons inclus). Le taux de change est pré-rempli depuis les
 * paramètres quand il existe, sinon saisi — et dans les deux cas FIGÉ dans
 * le snapshot du dossier.
 */
export function CreateDossierPanel({
  offer,
  offerRequestId,
  fxRates,
  disabled,
  disabledReason,
}: {
  offer: DuffelOffer;
  offerRequestId: string | null;
  fxRates: Record<string, number>;
  disabled: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<CreateDossierState, FormData>(createDossierFromOfferAction, { ok: null });
  const [customer, setCustomer] = useState<Customer | null>(null);

  const defaultRate = fxRates[offer.total_currency];
  const [rate, setRate] = useState<string>(defaultRate ? String(defaultRate) : "");
  const rateNum = Number(String(rate).replace(",", "."));
  const rateValid = Number.isFinite(rateNum) && rateNum > 0;
  const fxSource = defaultRate && rateValid && Math.abs(rateNum - defaultRate) < 1e-9 ? "parametres" : "saisi";
  const amount = amountNumber(offer.total_amount);
  const amountMad = useMemo(() => (rateValid ? fxConvert(amount, rateNum) : null), [amount, rateNum, rateValid]);

  useEffect(() => {
    if (state.ok === true) router.push(`/admin/reservations/${state.reservationId}?created=1`);
  }, [state, router]);

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason}
        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[13px] font-medium text-white opacity-50 cursor-not-allowed"
      >
        <Lock className="size-4" /> Créer le dossier
      </button>
    );
  }

  return (
    <form action={formAction} className="rounded-lg p-3 space-y-3" style={{ border: "1px dashed #C9C4BA" }}>
      <input type="hidden" name="offer_id" value={offer.id} />
      <input type="hidden" name="offer_request_id" value={offerRequestId ?? ""} />
      <input type="hidden" name="customer_id" value={customer?.id ?? ""} />
      <input type="hidden" name="fx_source" value={fxSource} />

      <div>
        <span className={labelCls}>Client payeur <span className="text-red-600">*</span></span>
        <CustomerPicker selectedCustomer={customer} onSelect={setCustomer} />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label htmlFor="fx_rate" className={labelCls}>
            Taux MAD pour 1 {offer.total_currency} <span className="text-red-600">*</span>
          </label>
          <input
            id="fx_rate"
            name="fx_rate"
            type="number"
            step="0.0001"
            min="0.0001"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={`ex. 10.90`}
            className={fieldCls}
          />
          <p className="mt-1 text-[11px] text-[#968F84]">
            {defaultRate
              ? fxSource === "parametres"
                ? "Taux des paramètres — modifiable, il sera alors marqué « saisi »."
                : "Taux modifié : il sera enregistré comme « saisi à la création »."
              : `Aucun taux ${offer.total_currency} dans Paramètres › Société : saisissez-le (il sera marqué « saisi »).`}
          </p>
        </div>
        <div className="text-right pb-5">
          <div className="text-[10.5px] uppercase tracking-wide text-[#968F84]">Total dossier</div>
          <div className="font-display text-[20px] text-[#1A1F2E] tabular-nums">{amountMad !== null ? formatMAD(amountMad) : "—"}</div>
          <div className="text-[10.5px] text-[#968F84] tabular-nums">{formatMoney(offer.total_amount, offer.total_currency)}</div>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-[#968F84] leading-snug">
        <Info className="size-3.5 shrink-0 mt-px" />
        Crée un produit billetterie inactif (jamais en vitrine), un dossier au forfait pour {offer.passengers.length} passager
        {offer.passengers.length > 1 ? "s" : ""}, et les voyageurs à compléter. L&apos;ordre Duffel s&apos;émet ensuite depuis la fiche.
      </p>

      {state.ok === false && (
        <p className="text-[12px] text-[#791F1F] bg-[#FCEBEB] border border-[#F7C1C1] rounded-lg px-3 py-2">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending || !customer || !rateValid}
        aria-busy={isPending}
        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[13px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-50 disabled:pointer-events-none transition-colors"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        {isPending ? "Création du dossier…" : "Créer le dossier"}
      </button>
    </form>
  );
}
