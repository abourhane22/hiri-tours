"use client";

import { useState } from "react";
import { createInvoice } from "@/app/admin/factures/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { FileText, X } from "lucide-react";

export function IssueInvoiceButton({ reservationId, defaultTvaRate }: { reservationId: string; defaultTvaRate: number }) {
  const [open, setOpen] = useState(false);
  const action = createInvoice.bind(null, reservationId);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="secondary" size="sm">
        <FileText className="size-3.5" /> Émettre la facture
      </Button>
    );
  }

  return (
    <form action={action} className="border border-sand-200 rounded-md p-4 bg-sand-50 space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Émission de facture</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-sand-700 hover:text-ink flex items-center gap-1">
          <X className="size-3" /> Annuler
        </button>
      </div>
      <div>
        <Label htmlFor="tva_rate">Taux de TVA (%)</Label>
        <div className="relative">
          <Input id="tva_rate" name="tva_rate" type="number" step="0.1" min="0" max="100" defaultValue={(defaultTvaRate * 100).toFixed(1).replace(/\.0$/, "")} required className="pr-8" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-600 text-sm pointer-events-none">%</span>
        </div>
        <p className="text-xs text-sand-600 mt-1">Ex : 20 pour standard, 10 pour tourisme</p>
      </div>
      <div>
        <Label htmlFor="notes">Notes sur la facture (optionnel)</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      <Button type="submit" size="sm">Confirmer l&apos;émission</Button>
    </form>
  );
}
