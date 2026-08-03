"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Plus, Info } from "lucide-react";
import { addPayment } from "@/app/admin/reservations/[id]/actions";

type Props = {
  reservationId: string;
  balance: number;
};

export function PaymentForm({ reservationId, balance }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [method, setMethod] = useState("cash");
  const [externalRef, setExternalRef] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const refInput = useRef<HTMLInputElement>(null);

  const isVirement = method === "transfer";

  function handleMethodChange(value: string) {
    setMethod(value);
    setFieldError(null);
    if (value !== "transfer") setExternalRef("");
  }

  function handleSubmit(formData: FormData) {
    if (isPending) return;
    setError(null);
    setWarning(null);

    // Validation client : numéro de virement obligatoire.
    if (method === "transfer" && !externalRef.trim()) {
      setFieldError("Le numéro de virement est obligatoire");
      refInput.current?.focus();
      return;
    }
    setFieldError(null);

    startTransition(async () => {
      const result = await addPayment(reservationId, null, formData);
      if (result.ok) {
        formRef.current?.reset();
        setMethod("cash");
        setExternalRef("");
        if ("warning" in result && result.warning) setWarning(result.warning);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-3 pt-4 border-t border-sand-200"
    >
      <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">
        Enregistrer un paiement
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="method">Méthode</Label>
          <Select
            id="method"
            name="method"
            required
            value={method}
            onChange={(e) => handleMethodChange(e.target.value)}
            disabled={isPending}
          >
            <option value="cash">Espèces</option>
            <option value="transfer">Virement</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="amount_mad">Montant (MAD)</Label>
          <Input
            id="amount_mad"
            name="amount_mad"
            type="number"
            min="0.01"
            step="0.01"
            max={balance}
            defaultValue={balance.toFixed(2)}
            required
            disabled={isPending}
          />
        </div>
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
          Tel qu'il apparaît sur le relevé de compte — permet le rapprochement
          bancaire.
        </p>
        {fieldError && (
          <p className="text-sm text-red-600 mt-1">{fieldError}</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {warning && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {warning}
        </p>
      )}
      <Button type="submit" size="sm" disabled={isPending} aria-busy={isPending}>
        <Plus className="size-3.5" />
        {isPending ? "Enregistrement…" : "Enregistrer le paiement"}
      </Button>
    </form>
  );
}
