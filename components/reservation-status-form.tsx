"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Info } from "lucide-react";
import { updateStatus, type ActionResult } from "@/app/admin/reservations/[id]/actions";

type Props = {
  reservationId: string;
  currentStatus: string;
  paidAmount: number;
  totalAmount: number;
};

type Feedback =
  | { tone: "success"; message: string }
  | { tone: "error"; message: string }
  | null;

export function ReservationStatusForm({
  reservationId,
  currentStatus,
  paidAmount,
  totalAmount,
}: Props) {
  const isSettled = totalAmount > 0 && paidAmount >= totalAmount;
  const hasPartial = paidAmount > 0;
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resync when the server re-renders with a fresh status (after revalidatePath).
  useEffect(() => {
    setSelectedStatus(currentStatus);
  }, [currentStatus]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function scheduleClear(ms: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFeedback(null), ms);
  }

  function handleSubmit(formData: FormData) {
    if (isPending) return;
    setFeedback(null);
    startTransition(async () => {
      const result: ActionResult<{ status: string; label: string }> =
        await updateStatus(reservationId, null, formData);
      if (result.ok) {
        setFeedback({
          tone: "success",
          message: `Statut mis à jour : ${result.label}`,
        });
        scheduleClear(4000);
      } else {
        setFeedback({ tone: "error", message: result.error });
        scheduleClear(6000);
      }
    });
  }

  return (
    <div className="space-y-3">
      {feedback && (
        <AlertBanner tone={feedback.tone} message={feedback.message} />
      )}
      <form action={handleSubmit} className="space-y-3">
        <Label htmlFor="status">Statut du dossier</Label>
        <Select
          id="status"
          name="status"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          disabled={isPending}
        >
          <option
            value="pending"
            disabled={hasPartial}
            title={
              hasPartial
                ? "Des paiements ont été encaissés — retour « En attente » impossible."
                : undefined
            }
          >
            En attente
          </option>
          <option
            value="confirmed"
            disabled={isSettled}
            title={
              isSettled
                ? "Réservation soldée — rétrogradation impossible."
                : undefined
            }
          >
            Confirmée
          </option>
          <option value="paid" disabled={currentStatus !== "paid"}>
            {currentStatus !== "paid" ? "Payée (automatique)" : "Payée"}
          </option>
          <option value="completed" disabled={currentStatus !== "completed"}>
            {currentStatus !== "completed" ? "Terminée (automatique)" : "Terminée"}
          </option>
          <option value="cancelled">Annulée</option>
        </Select>
        <p className="flex items-start gap-1.5 text-[11px] text-[#968F84]">
          <Info className="size-3.5 shrink-0 mt-px" />
          <span>
            « Confirmée » et « Payée » s'appliquent automatiquement à
            l'encaissement · « Terminée » après le départ. Ce menu sert aux
            corrections et à l'annulation.
          </span>
        </p>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Mise à jour…" : "Mettre à jour"}
        </Button>
      </form>
    </div>
  );
}
