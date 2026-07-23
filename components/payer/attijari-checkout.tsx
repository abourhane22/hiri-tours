"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Lock, Loader2, ShieldCheck, Smartphone, AlertCircle } from "lucide-react";
import { formatMAD } from "@/lib/utils";
import { ATTIJARI_TEST_CARDS, ATTIJARI_MASKED_PHONE } from "@/lib/attijari";
import { confirmAttijariPayment } from "@/app/payer/actions";

type Props = {
  orderId: string;
  reservationId: string;
  amountMad: number;
};

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

export function AttijariCheckout({ orderId, reservationId, amountMad }: Props) {
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
      <div className="rounded-xl border border-sand-200 bg-sand-50 px-5 py-4 flex items-baseline justify-between">
        <span className="text-sm text-sand-700">Montant à payer</span>
        <span className="font-display text-2xl text-ink tabular-nums">
          {formatMAD(amountMad)}
        </span>
      </div>

      {step === "card" ? (
        <form onSubmit={handleCardSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Numéro de carte
            </label>
            <div className="relative">
              <input
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                className="h-11 w-full rounded-md border border-sand-300 bg-white pl-3 pr-10 text-sm tracking-widest text-ink placeholder:text-sand-400 focus:border-[#E67817] focus:outline-none focus:ring-2 focus:ring-[#E67817]/20"
              />
              <Lock className="size-4 text-sand-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Titulaire de la carte
            </label>
            <input
              autoComplete="cc-name"
              value={holder}
              onChange={(e) => setHolder(e.target.value.toUpperCase())}
              placeholder="NOM PRÉNOM"
              className="h-11 w-full rounded-md border border-sand-300 bg-white px-3 text-sm text-ink placeholder:text-sand-400 focus:border-[#E67817] focus:outline-none focus:ring-2 focus:ring-[#E67817]/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Expiration
              </label>
              <input
                inputMode="numeric"
                autoComplete="cc-exp"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/AA"
                className="h-11 w-full rounded-md border border-sand-300 bg-white px-3 text-sm text-ink placeholder:text-sand-400 focus:border-[#E67817] focus:outline-none focus:ring-2 focus:ring-[#E67817]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                CVV
              </label>
              <input
                inputMode="numeric"
                autoComplete="cc-csc"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="123"
                className="h-11 w-full rounded-md border border-sand-300 bg-white px-3 text-sm text-ink placeholder:text-sand-400 focus:border-[#E67817] focus:outline-none focus:ring-2 focus:ring-[#E67817]/20"
              />
            </div>
          </div>

          {cardError && <p className="text-sm text-red-600">{cardError}</p>}

          <button
            type="submit"
            className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#E67817] text-white font-medium hover:bg-[#CC6810] transition-colors"
          >
            <Lock className="size-4" />
            Payer {formatMAD(amountMad)}
          </button>

          {/* Cartes de test */}
          <div className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-4 py-3 text-xs text-sand-700 space-y-1.5">
            <p className="font-medium text-sand-800">Cartes de test</p>
            <div className="flex items-center justify-between font-mono">
              <span>{ATTIJARI_TEST_CARDS.approved}</span>
              <span className="text-emerald-700">paiement accepté</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span>{ATTIJARI_TEST_CARDS.declined}</span>
              <span className="text-red-600">refusé (fonds insuffisants)</span>
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
                Code envoyé par SMS au {ATTIJARI_MASKED_PHONE}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Code de vérification
            </label>
            <input
              inputMode="numeric"
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="______"
              className="h-12 w-full rounded-md border border-sand-300 bg-white px-3 text-center text-lg tracking-[0.5em] font-mono text-ink placeholder:text-sand-300 focus:border-atlantic-500 focus:outline-none focus:ring-2 focus:ring-atlantic-500/20"
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
            className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-md bg-atlantic-600 text-white font-medium hover:bg-atlantic-700 transition-colors disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Vérification…
              </>
            ) : (
              "Valider"
            )}
          </button>

          {!isPending && (
            <button
              type="button"
              onClick={() => {
                setStep("card");
                setBankError(null);
              }}
              className="w-full text-center text-sm text-sand-600 hover:text-ink"
            >
              Retour
            </button>
          )}
        </form>
      )}
    </div>
  );
}
