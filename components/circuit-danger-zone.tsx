"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, EyeOff } from "lucide-react";
import { deleteCircuit, deactivateCircuit } from "@/app/admin/circuits/actions";

export function CircuitDangerZone({
  circuitId,
  reservationCount,
  isActive,
}: {
  circuitId: string;
  reservationCount: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasReservations = reservationCount > 0;

  function handleDelete() {
    if (isPending) return;
    if (
      !window.confirm(
        "Supprimer définitivement ce circuit ? Cette action est irréversible.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      // Succès ⇒ redirection serveur ; échec ⇒ { ok:false, error }.
      const result = await deleteCircuit(circuitId);
      if (result?.error) setError(result.error);
    });
  }

  function handleDeactivate() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      await deactivateCircuit(circuitId);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 bg-white border border-red-200 rounded-lg p-6">
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="size-4 text-red-700 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-ink">Zone de danger</h3>
          {hasReservations ? (
            <p className="text-sm text-sand-700 mt-1">
              Suppression impossible : {reservationCount} réservation
              {reservationCount > 1 ? "s" : ""} utilise
              {reservationCount > 1 ? "nt" : ""} ce circuit. Désactivez-le plutôt
              pour le retirer de la vente sans perdre l&apos;historique.
            </p>
          ) : (
            <p className="text-sm text-sand-700 mt-1">
              Aucune réservation n&apos;utilise ce circuit. La suppression est
              définitive.
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {hasReservations ? (
          isActive ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDeactivate}
              disabled={isPending}
            >
              <EyeOff className="size-3.5" />
              {isPending ? "Désactivation…" : "Désactiver le circuit"}
            </Button>
          ) : (
            <span className="text-sm text-sand-600 italic self-center">
              Circuit déjà désactivé — invisible à la vente.
            </span>
          )
        ) : (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
          >
            <Trash2 className="size-3.5" />
            {isPending ? "Suppression…" : "Supprimer définitivement"}
          </Button>
        )}
      </div>
    </div>
  );
}
