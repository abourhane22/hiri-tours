import { notFound } from "next/navigation";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMAD } from "@/lib/utils";
import { TunnelShell } from "@/components/payer/tunnel-shell";

export const metadata = {
  title: "Paiement reçu — Hiri Tours",
};

export default async function MerciPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { id } = await params;
  const { ref } = await searchParams;
  const supabase = createAdminClient();

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("id, reference, total_amount_mad, paid_amount_mad")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[payer/merci] Échec de chargement de la réservation:", error);
    throw new Error(`Impossible de charger la réservation : ${error.message}`);
  }
  if (!reservation) notFound();

  const r = reservation as any;
  const total = Number(r.total_amount_mad);
  const paid = Number(r.paid_amount_mad);
  const remaining = Math.max(0, total - paid);
  const fullyPaid = remaining <= 0;

  return (
    <TunnelShell bodyClassName="text-center">
      <div className="py-4">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#E1F5EE]">
          <CircleCheck className="size-10 text-[#0F6E56]" />
        </div>

        <h1 className="font-display text-[22px] text-[#1A1F2E] mb-1.5">
          Paiement reçu
        </h1>
        <p className="text-[13px] text-[#6B6862] mb-6">
          {fullyPaid
            ? "Votre réservation est confirmée."
            : "Votre acompte a bien été enregistré."}
        </p>

        {/* Montant payé */}
        <div className="mb-5">
          <div className="text-[11px] tracking-wider uppercase text-[#968F84]">
            Montant réglé
          </div>
          <div className="font-display text-[30px] text-[#0F6E56] tabular-nums leading-tight">
            {formatMAD(paid)}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E0D7] bg-white px-5 py-4 text-[13px] text-left space-y-2 max-w-xs mx-auto">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#6B6862]">Réservation</span>
            <span className="text-[#1A1F2E] font-medium font-mono">
              {r.reference}
            </span>
          </div>
          {ref && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#6B6862]">Transaction</span>
              <span className="text-[#1A1F2E] font-medium font-mono">{ref}</span>
            </div>
          )}
          {!fullyPaid && (
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-[#E5E0D7]">
              <span className="text-[#6B6862]">Restant dû</span>
              <span className="text-[#C84B31] font-medium tabular-nums">
                {formatMAD(remaining)}
              </span>
            </div>
          )}
        </div>

        {!fullyPaid && (
          <Link
            href={`/payer/${id}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#E5E0D7] bg-white px-5 text-sm font-medium text-[#1A1F2E] hover:bg-sand-100 transition-colors mt-6"
          >
            Régler le solde
          </Link>
        )}

        <p className="text-[11px] text-[#968F84] mt-6">
          Environnement de démonstration — aucune transaction bancaire réelle
          n'a été effectuée.
        </p>
      </div>
    </TunnelShell>
  );
}
