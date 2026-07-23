import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAttijariLogo } from "@/lib/attijari-server";
import { maskPhone, ATTIJARI_FALLBACK_PHONE } from "@/lib/attijari";
import { TunnelShell } from "@/components/payer/tunnel-shell";
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

  // Numéro du client (via reservations → customers), masqué pour le 3D Secure.
  const { data: resa } = await supabase
    .from("reservations")
    .select("customers(phone)")
    .eq("id", o.reservation_id)
    .maybeSingle();
  const customerPhone = (resa as any)?.customers?.phone ?? null;
  const maskedPhone = maskPhone(customerPhone) ?? ATTIJARI_FALLBACK_PHONE;

  const hasLogo = hasAttijariLogo();
  const amount = Number(o.amount_mad);

  return (
    <TunnelShell>
      <div className="rounded-2xl border border-[#E5E0D7] bg-white shadow-sm overflow-hidden">
        {/* En-tête gateway : fournisseur de paiement */}
        <div className="px-6 py-6 border-b border-[#E5E0D7] flex items-center justify-between gap-4">
          <AttijariLogo hasLogo={hasLogo} className="h-11" />
          <span className="text-[11px] uppercase tracking-widest text-[#968F84] shrink-0">
            Paiement par carte
          </span>
        </div>

        <div className="px-6 py-6">
          {o.status === "failed" ? (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FDECEA]">
                <XCircle className="size-8 text-[#B42318]" />
              </div>
              <h1 className="font-display text-xl text-[#1A1F2E] mb-1">
                Paiement échoué
              </h1>
              <p className="text-sm text-[#6B6862] mb-5">
                Cet ordre de paiement a été refusé. Vous pouvez relancer une
                nouvelle tentative.
              </p>
              <Link
                href={`/payer/${o.reservation_id}`}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#0F6E56] px-5 text-white font-medium hover:bg-[#085041] transition-colors"
              >
                Recommencer le paiement
              </Link>
            </div>
          ) : (
            <AttijariCheckout
              orderId={o.order_id}
              reservationId={o.reservation_id}
              amountMad={amount}
              maskedPhone={maskedPhone}
            />
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-[#968F84] mt-4">
        Réf. commande <span className="font-mono">{o.order_id}</span>
      </p>
    </TunnelShell>
  );
}
