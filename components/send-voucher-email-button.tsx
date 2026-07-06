"use client";

import { useEffect, useRef, useState } from "react";
import { sendVoucherEmailAction } from "@/app/admin/reservations/[id]/email-actions";
import { Button } from "@/components/ui/button";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Mail, Check, Loader2 } from "lucide-react";

export function SendVoucherEmailButton({
  reservationId,
  customerEmail,
}: {
  reservationId: string;
  customerEmail: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!customerEmail) return null;

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setError(null);
    if (timerRef.current) clearTimeout(timerRef.current);

    const result = await sendVoucherEmailAction(reservationId);

    setPending(false);
    if (result.ok) {
      setSuccess(true);
      timerRef.current = setTimeout(() => setSuccess(false), 4000);
    } else {
      setError(result.error);
      timerRef.current = setTimeout(() => setError(null), 6000);
    }
  }

  return (
    <div className="inline-block">
      <Button
        onClick={handleClick}
        disabled={pending || success}
        variant="secondary"
        size="sm"
      >
        {pending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" /> Envoi...
          </>
        ) : success ? (
          <>
            <Check className="size-3.5 text-emerald-600" /> Envoyé
          </>
        ) : (
          <>
            <Mail className="size-3.5" /> Envoyer voucher par email
          </>
        )}
      </Button>
      {error && (
        <AlertBanner
          tone="error"
          message={error}
          className="mt-2 max-w-md"
        />
      )}
    </div>
  );
}
