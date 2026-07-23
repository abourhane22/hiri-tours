"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { addPayment, type ActionResult } from "@/app/admin/reservations/[id]/actions";

type Props = {
  reservationId: string;
  balance: number;
};

export function PaymentForm({ reservationId, balance }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await addPayment(reservationId, null, formData);
      if (result.ok) {
        formRef.current?.reset();
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
            defaultValue="cash"
            disabled={isPending}
          >
            <option value="cash">Espèces</option>
            <option value="attijari">Attijari Payment</option>
            <option value="transfer">Virement</option>
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
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
      <div>
        <Label htmlFor="transaction_ref">
          Référence transaction (optionnel)
        </Label>
        <Input
          id="transaction_ref"
          name="transaction_ref"
          type="text"
          placeholder="TXN-12345..."
          disabled={isPending}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending} aria-busy={isPending}>
        <Plus className="size-3.5" />
        {isPending ? "Enregistrement…" : "Enregistrer le paiement"}
      </Button>
    </form>
  );
}
