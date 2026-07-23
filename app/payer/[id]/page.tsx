import { notFound } from "next/navigation";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAttijariLogo } from "@/lib/attijari-server";
import { formatMAD, formatDate } from "@/lib/utils";
import { TestBanner } from "@/components/payer/test-banner";
import { AttijariMethodButton } from "@/components/payer/attijari-method-button";

export const metadata = {
  title: "Paiement — Hiri Tours",
};

export default async function PayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: reservation } = await supabase
    .from("reservations")
    .select(
      "id, reference, status, total_amount_mad, paid_amount_mad, departure_date, guest_full_name, circuits(title), customers(full_name)",
    )
    .eq("id", id)
    .single();

  if (!reservation) notFound();

  const r = reservation as any;
  const total = Number(r.total_amount_mad);
  const paid = Number(r.paid_amount_mad);
  const remaining = Math.max(0, total - paid);
  const clientName = r.customers?.full_name ?? r.guest_full_name ?? "—";
  const circuitTitle = r.circuits?.title ?? "—";
  const isCancelled = r.status === "cancelled";
  const hasLogo = hasAttijariLogo();

  return (
    <main className="min-h-screen bg-sand-50">
      <TestBanner />
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <p className="eyebrow mb-1">Paiement sécurisé</p>
          <h1 className="font-display text-2xl text-ink">Régler ma réservation</h1>
        </div>

        {/* Récapitulatif */}
        <div className="rounded-xl border border-sand-200 bg-white overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-sand-200">
            <h2 className="font-display text-lg text-ink">Récapitulatif</h2>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm">
            <Row label="Référence" value={<span className="font-mono">{r.reference}</span>} />
            <Row label="Client" value={clientName} />
            <Row label="Circuit" value={circuitTitle} />
            <Row label="Date de départ" value={formatDate(r.departure_date)} />
            {paid > 0 && (
              <Row
                label="Déjà réglé"
                value={<span className="text-emerald-700">{formatMAD(paid)}</span>}
              />
            )}
            <div className="pt-3 mt-1 border-t border-sand-200 flex items-baseline justify-between">
              <span className="text-sand-700">Montant restant dû</span>
              <span className="font-display text-2xl text-terracotta-600 tabular-nums">
                {formatMAD(remaining)}
              </span>
            </div>
          </div>
        </div>

        {isCancelled ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            Cette réservation est annulée — aucun paiement n'est possible.
          </div>
        ) : remaining <= 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-3">
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">
              Cette réservation est déjà soldée. Merci !
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">
              Choisir un moyen de paiement
            </p>

            <AttijariMethodButton reservationId={id} hasLogo={hasLogo} />

            {/* Stripe — lot 2, désactivé */}
            <div className="w-full flex items-center gap-4 rounded-xl border-2 border-sand-200 bg-sand-50 px-4 py-4 opacity-70 cursor-not-allowed">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sand-100 shrink-0">
                <CreditCard className="size-5 text-sand-500" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-sand-700">
                  Carte internationale (Stripe)
                </span>
                <span className="block text-xs text-sand-500 mt-0.5">
                  Visa · Mastercard
                </span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-sand-300 bg-white text-xs font-medium text-sand-600 shrink-0">
                Bientôt disponible
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sand-600">{label}</span>
      <span className="text-ink font-medium text-right">{value}</span>
    </div>
  );
}
