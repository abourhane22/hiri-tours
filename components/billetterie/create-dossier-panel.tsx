"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useActionFeedback, useToast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";
import { Check, Loader2, Info, Lock } from "lucide-react";
import { CustomerPicker } from "@/components/customer-picker";
import { formatMAD } from "@/lib/utils";
import { amountNumber, formatMoney, type DuffelOffer } from "@/lib/duffel-types";
import { computeServiceFee, fxConvert, type TicketingFeeDefaults } from "@/lib/distribution";
import { createDossierFromOfferAction, type CreateDossierState } from "@/app/admin/billetterie/actions";
import type { Customer } from "@/lib/types";

const FORM_ID = "create-dossier-form";
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
  feeDefaults,
  disabled,
  disabledReason,
  footer,
}: {
  offer: DuffelOffer;
  offerRequestId: string | null;
  fxRates: Record<string, number>;
  feeDefaults: TicketingFeeDefaults;
  disabled: boolean;
  disabledReason?: string;
  /** Pied collant du panneau « Détail de l'offre » : le récapitulatif et le bouton y sont rendus. */
  footer?: HTMLElement | null;
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

  // Frais de service : pré-remplis depuis les paramètres, modifiables pour ce dossier.
  const pax = offer.passengers.length;
  const [feePerPax, setFeePerPax] = useState<string>(feeDefaults.perPaxMad > 0 ? String(feeDefaults.perPaxMad) : "0");
  const [feePct, setFeePct] = useState<string>(feeDefaults.pct !== null ? String(feeDefaults.pct) : "");
  const perPaxNum = Number(String(feePerPax).replace(",", "."));
  const pctRaw = String(feePct).trim();
  const pctNum = pctRaw === "" ? null : Number(pctRaw.replace(",", "."));
  const feeValid = Number.isFinite(perPaxNum) && perPaxNum >= 0 && (pctNum === null || (Number.isFinite(pctNum) && pctNum >= 0 && pctNum <= 100));
  const serviceFee = amountMad !== null && feeValid ? computeServiceFee({ perPaxMad: perPaxNum, pax, pct: pctNum, baseMad: amountMad }) : null;
  const salePrice = amountMad !== null && serviceFee !== null ? Math.round((amountMad + serviceFee) * 100) / 100 : null;

  const toast = useToast();
  useActionFeedback(state, null);
  useEffect(() => {
    if (state.ok !== true) return;
    toast.success(`Dossier ${state.reference} créé`);
    router.push(`/admin/reservations/${state.reservationId}?created=1`);
  }, [state, router, toast]);

  if (disabled) {
    const locked = (
      <button
        type="button"
        disabled
        title={disabledReason}
        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[13px] font-medium text-white opacity-50 cursor-not-allowed"
      >
        <Lock className="size-4" /> Créer le dossier
      </button>
    );
    return footer ? createPortal(locked, footer) : locked;
  }

  const form = (
    <form id={FORM_ID} action={formAction} className="rounded-lg p-3 space-y-3" style={{ border: "1px dashed #C9C4BA" }}>
      <input type="hidden" name="offer_id" value={offer.id} />
      <input type="hidden" name="offer_request_id" value={offerRequestId ?? ""} />
      <input type="hidden" name="customer_id" value={customer?.id ?? ""} />
      <input type="hidden" name="fx_source" value={fxSource} />

      <div>
        <span className={labelCls}>Client payeur <span className="text-red-600">*</span></span>
        <CustomerPicker selectedCustomer={customer} onSelect={setCustomer} />
        <label className="mt-2 flex items-start gap-2 text-[12px] text-[#1A1F2E]">
          <input type="checkbox" name="payer_travels" defaultChecked className="mt-0.5 size-4" />
          <span>
            Le client payeur fait partie des passagers
            <span className="block text-[11px] text-[#968F84]">
              Le premier adulte est pré-rempli depuis sa fiche (nom, et selon le vol : date de naissance, sexe, nationalité, passeport). Décochée : rien n&apos;est pré-rempli.
            </span>
          </span>
        </label>
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
          <div className="text-[10.5px] uppercase tracking-wide text-[#968F84]">Tarif compagnie</div>
          <div className="font-display text-[18px] text-[#1A1F2E] tabular-nums">{amountMad !== null ? formatMAD(amountMad) : "—"}</div>
          <div className="text-[10.5px] text-[#968F84] tabular-nums">{formatMoney(offer.total_amount, offer.total_currency)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="service_fee_per_pax" className={labelCls}>Frais de service / passager (MAD)</label>
          <input
            id="service_fee_per_pax"
            name="service_fee_per_pax"
            type="number"
            step="0.01"
            min="0"
            value={feePerPax}
            onChange={(e) => setFeePerPax(e.target.value)}
            className={fieldCls}
          />
        </div>
        <div>
          <label htmlFor="service_fee_pct" className={labelCls}>+ % du tarif (optionnel)</label>
          <input
            id="service_fee_pct"
            name="service_fee_pct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={feePct}
            onChange={(e) => setFeePct(e.target.value)}
            placeholder="—"
            className={fieldCls}
          />
        </div>
        <p className="col-span-2 -mt-1.5 text-[11px] text-[#968F84]">
          {feeDefaults.perPaxMad > 0 || feeDefaults.pct !== null
            ? "Pré-remplis depuis Paramètres › Société › Billetterie — modifiables pour ce dossier."
            : "Aucun frais par défaut dans Paramètres › Société › Billetterie."}
        </p>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-[#968F84] leading-snug">
        <Info className="size-3.5 shrink-0 mt-px" />
        Crée un produit billetterie inactif (jamais en vitrine), un dossier au forfait pour {offer.passengers.length} passager
        {offer.passengers.length > 1 ? "s" : ""}, et les voyageurs à compléter. Le billet s&apos;émet ensuite depuis la fiche du dossier.
      </p>

    </form>
  );

  // Pied collant du panneau (récapitulatif + bouton toujours visibles) ; repli dans le flux sans pied.
  const footerContent = (
    <div className="space-y-2.5">
        {/* Récapitulatif : tarif compagnie + frais = prix de vente */}
        <div className="rounded-lg px-3 py-2.5 space-y-1 tabular-nums" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}>
          <div className="flex justify-between text-[12.5px] text-[#58524A]">
            <span>Tarif compagnie</span>
            <span>{amountMad !== null ? formatMAD(amountMad) : "—"}</span>
          </div>
          <div className="flex justify-between text-[12.5px] text-[#58524A]">
            <span>
              + Frais de service agence
              <span className="text-[11px] text-[#968F84]">
                {" "}({feeValid ? `${perPaxNum} MAD × ${pax} pax${pctNum ? ` + ${pctNum} %` : ""}` : "saisie invalide"})
              </span>
            </span>
            <span>{serviceFee !== null ? formatMAD(serviceFee) : "—"}</span>
          </div>
          <div className="flex justify-between items-baseline pt-1 border-t border-[#EEE9E0]">
            <span className="text-[12.5px] font-medium text-[#1A1F2E]">= Prix de vente</span>
            <span className="font-display text-[20px] text-[#1A1F2E]">{salePrice !== null ? formatMAD(salePrice) : "—"}</span>
          </div>
        </div>

        {state.ok === false && (
          <p className="text-[12px] text-[#791F1F] bg-[#FCEBEB] border border-[#F7C1C1] rounded-lg px-3 py-2">{state.error}</p>
        )}

        <button
          type="submit"
          form={FORM_ID}
          disabled={isPending || !customer || !rateValid || !feeValid}
          aria-busy={isPending}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[13px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {isPending ? "Création du dossier…" : "Créer le dossier"}
        </button>
    </div>
  );
  return (
    <>
      {form}
      {footer ? createPortal(footerContent, footer) : footerContent}
    </>
  );
}
