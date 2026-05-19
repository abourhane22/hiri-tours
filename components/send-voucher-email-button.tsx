"use client";

import { useState } from "react";
import { sendVoucherEmailAction } from "@/app/admin/reservations/[id]/email-actions";
import { Button } from "@/components/ui/button";
import { Mail, Check, Loader2 } from "lucide-react";

export function SendVoucherEmailButton({ reservationId, customerEmail }: { reservationId: string; customerEmail: string | null }) {
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!customerEmail) return null;

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      await sendVoucherEmailAction(reservationId);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e: any) {
      setError(e?.message || "Erreur d'envoi");
      setTimeout(() => setError(null), 5000);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-block">
      <Button onClick={handleClick} disabled={pending || success} variant="secondary" size="sm">
        {pending ? (<><Loader2 className="size-3.5 animate-spin" /> Envoi...</>) :
         success ? (<><Check className="size-3.5 text-emerald-600" /> Envoyé</>) :
         (<><Mail className="size-3.5" /> Envoyer voucher par email</>)}
      </Button>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
