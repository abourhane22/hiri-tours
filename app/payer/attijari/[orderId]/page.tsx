import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { XCircle, Lock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAttijariLogo } from "@/lib/attijari-server";
import { TestBanner } from "@/components/payer/test-banner";
import { AttijariLogo } from "@/components/payer/attijari-logo";
import { AttijariCheckout } from "@/components/payer/attijari-checkout";

export const metadata = {
  title: "Attijari Payment — Environnement de test",
};

export default async function AttijariGatewayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("payment_orders")
    .select("order_id, reservation_id, amount_mad, status")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    console.error("[payer/attijari] Échec de chargement de l'ordre:", error);
    throw new Error(`Impossible de charger l'ordre de paiement : ${error.message}`);
  }
  if (!order) notFound();

  const o = order as {
    order_id: string;
    reservation_id: string;
    amount_mad: number | string;
    status: string;
  };

  // Déjà payé → on renvoie vers la page de confirmation.
  if (o.status === "paid") {
    redirect(`/payer/${o.reservation_id}/merci?ref=${o.order_id}`);
  }

  const hasLogo = hasAttijariLogo();
  const amount = Number(o.amount_mad);

  return (
    <main className="min-h-screen bg-sand-100">
      <TestBanner />
      <div className="max-w-md mx-auto px-4 py-8 sm:py-12">
        <div className="rounded-2xl border border-sand-200 bg-white shadow-sm overflow-hidden">
          {/* En-tête gateway */}
          <div className="px-6 py-5 border-b border-sand-200 flex items-center justify-between">
            <AttijariLogo hasLogo={hasLogo} className="h-7" />
            <span className="inline-flex items-center gap-1 text-xs text-sand-500">
              <Lock className="size-3.5" />
              Paiement sécurisé
            </span>
          </div>

          <div className="px-6 py-6">
            {o.status === "failed" ? (
              <div className="text-center py-4">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="size-8 text-red-600" />
                </div>
                <h1 className="font-display text-xl text-ink mb-1">
                  Paiement échoué
                </h1>
                <p className="text-sm text-sand-700 mb-5">
                  Cet ordre de paiement a été refusé. Vous pouvez relancer une
                  nouvelle tentative.
                </p>
                <Link
                  href={`/payer/${o.reservation_id}`}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[#E67817] px-5 text-white font-medium hover:bg-[#CC6810] transition-colors"
                >
                  Recommencer le paiement
                </Link>
              </div>
            ) : (
              <AttijariCheckout
                orderId={o.order_id}
                reservationId={o.reservation_id}
                amountMad={amount}
              />
            )}
          </div>
        </div>

        <p className="text-center text-xs text-sand-500 mt-4">
          Réf. commande <span className="font-mono">{o.order_id}</span>
        </p>
      </div>
    </main>
  );
}
