"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function VoucherPrintButton({ className }: { className?: string }) {
  return (
    <Button onClick={() => window.print()} size="sm" className={className}>
      <Printer className="size-3.5" />Imprimer / Télécharger PDF
    </Button>
  );
}
