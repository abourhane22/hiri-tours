"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Lock,
  Loader2,
  ShieldCheck,
  Smartphone,
  AlertCircle,
  CreditCard,
  User,
  Calendar,
  HelpCircle,
  FlaskConical,
  Landmark,
} from "lucide-react";
import { formatMAD } from "@/lib/utils";
import { ATTIJARI_TEST_CARDS } from "@/lib/attijari";
import { confirmAttijariPayment } from "@/app/payer/actions";

type Props = {
  orderId: string;
  reservationId: string;
  amountMad: number;
  maskedPhone: string;
};

// Champ de formulaire : bordure + focus ring orange Attijari.
const inputCls =
  "h-11 w-full rounded-lg border border-sand-300 bg-white text-sm text-[#1A1F2E] placeholder:text-sand-400 transition-colors focus:border-[#E8641B] focus:outline-none focus:ring-2 focus:ring-[#E8641B]/10";
const labelCls = "block text-sm font-medium text-[#1A1F2E] mb-1.5";
const iconCls =
  "size-4 text-sand-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none";

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isExpiryValid(value: string): boolean {
  const m = value.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  // Dernier jour du mois d'expiration, doit être dans le futur.
  const expiry = new Date(year, month, 0, 23, 59, 59);
  return expiry.getTime() >= Date.now();
}

export function AttijariCheckout({
  orderId,
  reservationId,
  amountMad,
  maskedPhone,
}: Props) {
  const [step, setStep] = useState<"card" | "otp">("card");
  const [isPending, startTransition] = useTransition();

  const [cardNumber, setCardNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [otp, setOtp] = useState("");

  const [cardError, setCardError] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);

  const cardDigits = useMemo(() => cardNumber.replace(/\D/g, ""), [cardNumber]);

  function handleCardSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCardError(null);
    if (cardDigits.length !== 16) {
      setCardError("Le numéro de carte doit comporter 16 chiffres.");
      return;
    }
    if (holder.trim().length < 2) {
      setCardError("Veuillez saisir le nom du titulaire.");
      return;
    }
    if (!isExpiryValid(expiry)) {
      setCardError("Date d'expiration invalide ou dépassée.");
      return;
    }
    if (!/^\d{3}$/.test(cvv)) {
      setCardError("Le CVV doit comporter 3 chiffres.");
      return;
    }
    setStep("otp");
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    setBankError(null);
    startTransition(async () => {
      // En cas de succès l'action redirige vers /merci (pas de retour).
      const result = await confirmAttijariPayment(orderId, cardDigits, otp);
      if (result?.error) setBankError(result.error);
    });
  }

  return (
    <div className="space-y-5">
      {/* Montant */}
      <div className="rounded-xl border border-[#E5E0D7] bg-[#FAF5F0] px-5 py-4 flex items-center justify-between gap-4">
        <span className="text-sm text-[#6B6862]">Montant à payer</span>
        <span className="font-display text-[26px] text-[#1A1F2E] tabular-nums leading-none">
          {formatMAD(amountMad)}
        </span>
      </div>

      {step === "card" ? (
        <form onSubmit={handleCardSubmit} className="space-y-4">
          {/* Numéro de carte */}
          <div>
            <label htmlFor="cc-number" className={labelCls}>
              Numéro de carte
            </label>
            <div className="relative">
              <CreditCard className={iconCls} />
              <input
                id="cc-number"
                inputMode="numeric"
                autoComplete="cc-number"
                maxLength={19}
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                className={`${inputCls} pl-10 pr-16 tracking-widest`}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-sand-200 bg-[#FAF5F0] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#6B6862]">
                VISA
              </span>
            </div>
          </div>

          {/* Titulaire */}
          <div>
            <label htmlFor="cc-name" className={labelCls}>
              Titulaire de la carte
            </label>
            <div className="relative">
              <User className={iconCls} />
              <input
                id="cc-name"
                autoComplete="cc-name"
                value={holder}
                onChange={(e) => setHolder(e.target.value.toUpperCase())}
                placeholder="NOM PRÉNOM"
                className={`${inputCls} pl-10`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Expiration */}
            <div>
              <label htmlFor="cc-exp" className={labelCls}>
                Expiration
              </label>
              <div className="relative">
                <Calendar className={iconCls} />
                <input
                  id="cc-exp"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  maxLength={5}
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/AA"
                  className={`${inputCls} pl-10`}
                />
              </div>
            </div>

            {/* CVV */}
            <div>
              <label
                htmlFor="cc-csc"
                className={`${labelCls} flex items-center gap-1`}
              >
                CVV
                <HelpCircle className="size-3.5 text-sand-400" />
              </label>
              <div className="relative">
                <Lock className={iconCls} />
                <input
                  id="cc-csc"
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={3}
                  value={cvv}
                  onChange={(e) =>
                    setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))
                  }
                  placeholder="123"
                  className={`${inputCls} pl-10`}
                />
              </div>
            </div>
          </div>

          {cardError && <p className="text-sm text-red-600">{cardError}</p>}

          <button
            type="submit"
            className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8641B] text-white font-medium transition-colors hover:bg-[#C84B31]"
          >
            <Lock className="size-4" />
            Payer {formatMAD(amountMad)}
          </button>

          {/* Cartes de test */}
          <div className="rounded-lg border border-dashed border-[#E5E0D7] bg-[#FBF9F5] px-4 py-3 text-xs space-y-2">
            <p className="flex items-center gap-1.5 font-medium text-[#6B6862]">
              <FlaskConical className="size-3.5" />
              Cartes de test
            </p>
            <div className="flex items-center justify-between font-mono text-[#1A1F2E]">
              <span>{ATTIJARI_TEST_CARDS.approved}</span>
              <span className="text-[#0F6E56]">paiement accepté</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[#1A1F2E]">
              <span>{ATTIJARI_TEST_CARDS.declined}</span>
              <span className="text-[#A32D2D]">refusé (fonds insuffisants)</span>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-atlantic-50 border border-atlantic-200 px-4 py-3">
            <ShieldCheck className="size-5 text-atlantic-700 shrink-0 mt-0.5" />
            <div className="text-sm text-atlantic-900">
              <p className="font-medium">Vérification 3D Secure</p>
              <p className="text-atlantic-800 flex items-center gap-1.5 mt-1">
                <Smartphone className="size-3.5" />
                Un code de vérification a été envoyé par SMS au {maskedPhone}
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="otp-code" className={labelCls}>
              Code de vérification
            </label>
            <input
              id="otp-code"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="______"
              className="h-12 w-full rounded-lg border border-sand-300 bg-white px-3 text-center text-lg tracking-[0.5em] font-mono text-[#1A1F2E] placeholder:text-sand-300 transition-colors focus:border-[#E8641B] focus:outline-none focus:ring-2 focus:ring-[#E8641B]/10"
            />
            <p className="text-xs text-sand-600 mt-1.5">Code de test : 123456</p>
          </div>

          {bankError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                {bankError}
              </p>
              <Link
                href={`/payer/${reservationId}`}
                className="text-sm text-red-800 underline underline-offset-2 mt-2 inline-block"
              >
                Recommencer le paiement
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8641B] text-white font-medium transition-colors hover:bg-[#C84B31] disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Vérification…
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" />
                Valider
              </>
            )}
          </button>

          {!isPending && (
            <button
              type="button"
              onClick={() => {
                setStep("card");
                setBankError(null);
              }}
              className="w-full text-center text-sm text-sand-600 hover:text-[#1A1F2E]"
            >
              Retour
            </button>
          )}
        </form>
      )}

      {/* Pied de carte — gages de confiance */}
      <div className="flex items-center justify-center gap-x-3 gap-y-1.5 flex-wrap border-t border-[#E5E0D7] pt-4 text-[11px] text-[#968F84]">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="size-[13px]" />
          Chiffré SSL
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Smartphone className="size-[13px]" />
          3D Secure
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Landmark className="size-[13px]" />
          Attijari Payment · démo
        </span>
      </div>
    </div>
  );
}
