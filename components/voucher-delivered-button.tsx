"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Loader2 } from "lucide-react";
import { markVoucherDeliveredAction } from "@/app/admin/reservations/[id]/email-actions";
import { useToast } from "@/components/ui/toaster";

const CHANNELS: { value: string; label: string }[] = [
  { value: "comptoir", label: "Remis au comptoir (imprimé)" },
  { value: "whatsapp", label: "Envoyé par WhatsApp" },
  { value: "autre", label: "Autre remise" },
];

/**
 * Remise du voucher hors email (l'envoi email est enregistré automatiquement).
 * Affiche la dernière remise quand elle existe ; la dernière l'emporte.
 */
export function VoucherDeliveredButton({
  reservationId,
  deliveredLabel,
}: {
  reservationId: string;
  deliveredLabel: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function mark(channel: string) {
    setError(null);
    startTransition(async () => {
      const res = await markVoucherDeliveredAction(reservationId, channel);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`Voucher ${CHANNELS.find((c) => c.value === channel)?.label.toLowerCase() ?? "remis"}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        title={deliveredLabel ?? "Marquer le voucher comme remis au client"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E0D7] bg-white text-[12.5px] font-medium px-3.5 py-2 text-[#1A1F2E] hover:bg-[#FAF5F0] disabled:opacity-60 transition-colors"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" style={deliveredLabel ? { color: "#0F6E56" } : undefined} />}
        {deliveredLabel ? "Voucher remis" : "Marquer comme remis"}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-[#E5E0D7] bg-white p-1.5 shadow-lg">
          {deliveredLabel && <p className="px-2 py-1.5 text-[11px] text-[#968F84]">{deliveredLabel}</p>}
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => mark(c.value)}
              disabled={isPending}
              className="block w-full rounded-md px-2 py-1.5 text-left text-[12.5px] text-[#1A1F2E] hover:bg-[#FAF5F0] disabled:opacity-60"
            >
              {c.label}
            </button>
          ))}
          {error && <p className="px-2 py-1.5 text-[11.5px] text-[#791F1F]">{error}</p>}
        </div>
      )}
    </div>
  );
}
