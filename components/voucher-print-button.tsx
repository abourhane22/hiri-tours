"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function VoucherPrintButton() {
  return (
    <Button onClick={() => window.print()} size="sm">
      <Printer className="size-3.5" />Imprimer / Télécharger PDF
    </Button>
  );
}
