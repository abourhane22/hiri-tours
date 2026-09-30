"use client";

import { useEffect, useState } from "react";
import { Check, Clock } from "lucide-react";
import { countdownLabel } from "@/components/billetterie/offer-card";
import type { TicketingStep, TicketingStepState } from "@/lib/distribution";

/**
 * Avancement d'un dossier billetterie, en tête de la carte « Détail du vol ».
 * Les états sont calculés côté serveur (fiche dossier) ; ce composant ne fait
 * qu'afficher et faire tourner le compte à rebours d'expiration de l'offre.
 * Une étape suivante reste grisée tant que la précédente n'est pas faite —
 * sauf un acompte non bloquant (réglage « paiement complet » désactivé).
 */
const STYLE: Record<TicketingStepState, { dot: string; dotText: string; label: string }> = {
  done: { dot: "#0F6E56", dotText: "#FFFFFF", label: "#1A1F2E" },
  partial: { dot: "#D98324", dotText: "#FFFFFF", label: "#7A4B00" },
  current: { dot: "#1A1F2E", dotText: "#FFFFFF", label: "#1A1F2E" },
  blocked: { dot: "#791F1F", dotText: "#FFFFFF", label: "#791F1F" },
  locked: { dot: "#E5E0D7", dotText: "#968F84", label: "#B4AEA3" },
};

export function TicketingStepper({ steps, expiresAt }: { steps: TicketingStep[]; expiresAt: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const expired = expiresAt && now !== null ? Date.parse(expiresAt) <= now : false;

  return (
    <div className="space-y-2">
      <ol className="grid grid-cols-3 sm:grid-cols-6 gap-x-1 gap-y-3">
        {steps.map((s, i) => {
          const st = STYLE[s.state];
          return (
            <li key={s.key} className="flex flex-col items-center text-center min-w-0" title={s.hint ?? undefined}>
              <span
                className="flex size-6 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: st.dot, color: st.dotText }}
              >
                {s.state === "done" ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="mt-1 text-[11px] leading-tight font-medium" style={{ color: st.label }}>
                {s.label}
              </span>
              {s.hint && s.state !== "locked" && (
                <span className="mt-0.5 text-[10px] leading-tight text-[#968F84]">{s.hint}</span>
              )}
            </li>
          );
        })}
      </ol>

      {expiresAt && now !== null && (
        <p
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums"
          style={expired ? { backgroundColor: "#FCEBEB", color: "#791F1F" } : { backgroundColor: "#FFF4E0", color: "#7A4B00" }}
        >
          <Clock className="size-3" />
          {expired ? "Offre expirée — relancez une recherche" : `Offre compagnie : ${countdownLabel(expiresAt, now)}`}
        </p>
      )}
    </div>
  );
}
