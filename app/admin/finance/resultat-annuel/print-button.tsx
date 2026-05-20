"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-sand-300 bg-white text-ink hover:bg-sand-50 transition"
    >
      <Printer className="size-3.5" />
      Imprimer / PDF
    </button>
  );
}
