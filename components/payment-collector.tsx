"use client";

import { useRef, useState, useTransition } from "react";
import { Coins, Landmark, Link2, Info, Loader2, ShieldCheck } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { formatMAD } from "@/lib/utils";
import { addPayment } from "@/app/admin/reservations/[id]/actions";
import {
  PaymentLinkPanel,
  type ActiveLink,
  type ShareData,
} from "@/components/payment-link-panel";

type Mode = "especes" | "virement" | "lien";

const METHODS: { mode: Mode; label: string; icon: typeof Coins }[] = [
  { mode: "especes", label: "Espèces", icon: Coins },
  { mode: "virement", label: "Virement", icon: Landmark },
  { mode: "lien", label: "Lien de paiement", icon: Link2 },
];

/**
 * Zone d'encaissement unifiée : un sélecteur segmenté (Espèces · Virement ·
 * Lien de paiement en ligne) commande l'une des trois méthodes. Tout le
 * câblage serveur est réutilisé tel quel :
 *  - Espèces / Virement → server action `addPayment` (cap, dédup, virement
 *    obligatoire côté serveur) ;
 *  - Lien → `PaymentLinkPanel` autonome (createPaymentLink + panneau
 *    Copier/WhatsApp/Email + révocation).
 * Seule l'ORGANISATION visuelle change.
 */
export function PaymentCollector({
  reservationId,
  balance,
  initialLink,
  share,
}: {
  reservationId: string;
  balance: number;
  initialLink: ActiveLink | null;
  share: ShareData;
}) {
  const [mode, setMode] = useState<Mode>("especes");
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [externalRef, setExternalRef] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const refInput = useRef<HTMLInputElement>(null);

  const isVirement = mode === "virement";
  const half = Math.round(balance / 2);

  function selectMode(next: Mode) {
    setMode(next);
    setFieldError(null);
    setError(null);
    setWarning(null);
    if (next !== "virement") setExternalRef("");
  }

  function encaisser() {
    if (isPending) return;
    setError(null);
    setWarning(null);

    // Validation client : numéro de virement obligatoire (miroir du serveur).
    if (isVirement && !externalRef.trim()) {
      setFieldError("Le numéro de virement est obligatoire");
      refInput.current?.focus();
      return;
    }
    setFieldError(null);

    const formData = new FormData();
    formData.set("method", isVirement ? "transfer" : "cash");
    formData.set("amount_mad", amount);
    if (isVirement) formData.set("external_ref", externalRef.trim());

    startTransition(async () => {
      const result = await addPayment(reservationId, null, formData);
      if (result.ok) {
        setAmount(balance.toFixed(2));
        setExternalRef("");
        if ("warning" in result && result.warning) setWarning(result.warning);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-[#EEE9E0] p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#968F84] mb-2.5">
        Encaisser un paiement — choisir la méthode
      </p>

      {/* Sélecteur segmenté */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#F1EFE8] p-[3px]">
        {METHODS.map(({ mode: m, label, icon: Icon }) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => selectMode(m)}
              aria-pressed={active}
              disabled={isPending}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-60 ${
                active
                  ? "bg-white text-[#1A1F2E] shadow-sm"
                  : "text-[#6B6862] hover:text-[#1A1F2E]"
              }`}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Espèces / Virement */}
      {mode !== "lien" ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="amount_mad">Montant (MAD)</Label>
              <Input
                id="amount_mad"
                name="amount_mad"
                type="number"
                min="0.01"
                step="0.01"
                max={balance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isPending}
              />
            </div>
            <button
              type="button"
              onClick={encaisser}
              disabled={isPending}
              aria-busy={isPending}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#0F6E56] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#085041] disabled:opacity-60 disabled:pointer-events-none"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Encaissement…
                </>
              ) : (
                "Encaisser"
              )}
            </button>
          </div>

          {/* Raccourcis de montant */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAmount(balance.toFixed(2))}
              disabled={isPending}
              className="inline-flex items-center rounded-full border border-[#E0DACF] bg-white px-3 py-1 text-[12px] text-[#6B6862] hover:border-[#0F6E56] hover:text-[#0F6E56] transition-colors disabled:opacity-60"
            >
              Tout solder · {formatMAD(balance)}
            </button>
            {balance >= 20 && (
              <button
                type="button"
                onClick={() => setAmount(half.toFixed(2))}
                disabled={isPending}
                className="inline-flex items-center rounded-full border border-[#E0DACF] bg-white px-3 py-1 text-[12px] text-[#6B6862] hover:border-[#0F6E56] hover:text-[#0F6E56] transition-colors disabled:opacity-60"
              >
                50 % · {formatMAD(half)}
              </button>
            )}
          </div>

          {/* Champ conditionnel : numéro de virement (animé) */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              isVirement ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <Label htmlFor="external_ref">Numéro de virement *</Label>
            <Input
              ref={refInput}
              id="external_ref"
              name="external_ref"
              type="text"
              value={externalRef}
              onChange={(e) => {
                setExternalRef(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              placeholder="Référence visible sur le relevé bancaire (ex. VIR-2026-078456)"
              disabled={isPending}
              aria-invalid={fieldError ? true : undefined}
            />
            <p className="text-[11px] text-sand-600 mt-1 flex items-start gap-1.5">
              <Info className="size-3.5 shrink-0 mt-px" />
              Tel qu'il apparaît sur le relevé de compte — permet le
              rapprochement bancaire.
            </p>
            {fieldError && <p className="text-sm text-red-600 mt-1">{fieldError}</p>}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {warning && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {warning}
            </p>
          )}
        </div>
      ) : (
        /* Lien de paiement en ligne */
        <div className="mt-3 space-y-3">
          <p className="text-[12.5px] leading-relaxed text-[#6B6862]">
            Le client règle à distance par carte bancaire (mobile ou
            ordinateur). Le lien couvre le solde restant —{" "}
            <span className="font-medium text-[#1A1F2E]">{formatMAD(balance)}</span> — et
            expire après 24 h.
          </p>

          {/* Bouton "Générer le lien" + panneau (Copier / WhatsApp / Email /
              lien actif / révocation) — composant autonome réutilisé tel quel. */}
          <PaymentLinkPanel
            reservationId={reservationId}
            initialLink={initialLink}
            share={share}
            generateMainLabel="Générer le lien"
          />

          <p className="flex items-start gap-1.5 text-[11px] text-[#0F6E56]">
            <ShieldCheck className="size-3.5 shrink-0 mt-px" />
            Attijari Payment (cartes marocaines) et Stripe (cartes
            internationales) · 3D Secure
          </p>
        </div>
      )}
    </div>
  );
}
