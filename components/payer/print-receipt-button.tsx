"use client";

import { Printer } from "lucide-react";

/**
 * Bouton d'impression du reçu (client — window.print()).
 * La page /payer/[id]/merci reste un server component ; seul ce bouton
 * est client. Masqué à l'impression (print:hidden).
 */
export function PrintReceiptButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center justify-center gap-2 rounded-lg border border-[#E0DACF] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1A1F2E] hover:bg-sand-100 transition-colors"
    >
      <Printer className="size-4" />
      Imprimer le reçu
    </button>
  );
}
