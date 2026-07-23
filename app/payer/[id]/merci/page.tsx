import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMAD } from "@/lib/utils";
import { TestBanner } from "@/components/payer/test-banner";

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

  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, reference, total_amount_mad, paid_amount_mad")
    .eq("id", id)
    .single();

  if (!reservation) notFound();

  const r = reservation as any;
  const total = Number(r.total_amount_mad);
  const paid = Number(r.paid_amount_mad);
  const remaining = Math.max(0, total - paid);
  const fullyPaid = remaining <= 0;

  return (
    <main className="min-h-screen bg-sand-50">
      <TestBanner />
      <div className="max-w-lg mx-auto px-4 py-12 sm:py-16">
        <div className="rounded-2xl border border-sand-200 bg-white overflow-hidden text-center">
          <div className="px-6 py-10">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="size-9 text-emerald-600" />
            </div>
            <h1 className="font-display text-2xl text-ink mb-2">Paiement reçu</h1>
            <p className="text-sand-700 mb-6">
              {fullyPaid
                ? "Votre réservation est confirmée."
                : "Votre acompte a bien été enregistré."}
            </p>

            <div className="rounded-xl bg-sand-50 border border-sand-200 px-5 py-4 text-sm text-left space-y-2 max-w-xs mx-auto">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sand-600">Réservation</span>
                <span className="text-ink font-medium font-mono">{r.reference}</span>
              </div>
              {ref && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sand-600">Transaction</span>
                  <span className="text-ink font-medium font-mono">{ref}</span>
                </div>
              )}
              {!fullyPaid && (
                <div className="flex items-center justify-between gap-4 pt-2 border-t border-sand-200">
                  <span className="text-sand-600">Restant dû</span>
                  <span className="text-terracotta-600 font-medium tabular-nums">
                    {formatMAD(remaining)}
                  </span>
                </div>
              )}
            </div>

            {!fullyPaid && (
              <Link
                href={`/payer/${id}`}
                className="inline-flex h-10 items-center justify-center rounded-md border border-sand-300 bg-white px-5 text-sm font-medium text-ink hover:bg-sand-100 transition-colors mt-6"
              >
                Régler le solde
              </Link>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-sand-500 mt-4">
          Environnement de démonstration — aucune transaction bancaire réelle n'a
          été effectuée.
        </p>
      </div>
    </main>
  );
}
