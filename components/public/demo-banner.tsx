"use client";

import { usePathname } from "next/navigation";
import { FlaskConical } from "lucide-react";

/**
 * Bandeau « environnement de démonstration ». Masqué sur le catalogue
 * (/reserver) — il n'a de sens que là où un paiement en mode test peut avoir
 * lieu (fiche, tunnel, paiement, suivi).
 */
export function DemoBanner() {
  const pathname = usePathname();
  if (pathname === "/reserver") return null;

  return (
    <div className="bg-[#FFF4E0] border-b border-[#F1D9A8] print:hidden">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2">
        <FlaskConical className="size-3.5 text-[#8A5A00] shrink-0" />
        <p className="text-xs text-[#8A5A00]">
          Environnement de démonstration — aucune transaction bancaire réelle.
        </p>
      </div>
    </div>
  );
}
