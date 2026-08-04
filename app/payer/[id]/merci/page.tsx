import { notFound } from "next/navigation";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { formatMAD, formatDate } from "@/lib/utils";
import { TunnelShell } from "@/components/payer/tunnel-shell";
import { PrintReceiptButton } from "@/components/payer/print-receipt-button";

export const metadata = {
  title: "Paiement reçu — Hiri Tours",
};

export default async function MerciPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string; provider?: string; session_id?: string }>;
}) {
  const { id } = await params;
  const { ref, provider, session_id } = await searchParams;
  const supabase = createAdminClient();

  const isStripe = provider === "stripe";
  const externalRef = ref ?? session_id ?? null;

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select(
      "id, reference, total_amount_mad, paid_amount_mad, circuits(title), customers(full_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[payer/merci] Échec de chargement de la réservation:", error);
    throw new Error(`Impossible de charger la réservation : ${error.message}`);
  }
  if (!reservation) notFound();

  const r = reservation as any;
  const total = Number(r.total_amount_mad);
  const paidCumulative = Number(r.paid_amount_mad);

  // ---- Montant de LA transaction (jamais total_amount_mad) ----
  let transactionAmount: number | null = null;
  let paidAt: string | null = null;
  let recorded = false; // le paiement est-il déjà écrit en base ?

  if (externalRef) {
    // Le paiement réellement enregistré (Attijari ET Stripe : external_ref).
    const { data: payment } = await supabase
      .from("payments")
      .select("amount_mad, paid_at")
      .eq("external_ref", externalRef)
      .maybeSingle();

    if (payment) {
      transactionAmount = Number((payment as any).amount_mad);
      paidAt = (payment as any).paid_at ?? null;
      recorded = true;
    } else if (isStripe && session_id && stripe) {
      // Webhook pas encore passé → montant depuis la metadata de la session.
      try {
        const sess = await stripe.checkout.sessions.retrieve(session_id);
        const meta = Number(sess.metadata?.amount_mad);
        if (Number.isFinite(meta)) transactionAmount = meta;
      } catch (e: any) {
        console.error("[payer/merci] retrieve session Stripe:", e?.message);
      }
    } else if (!isStripe) {
      // Attijari : repli sur l'ordre payé rattaché à cette réservation.
      const { data: order } = await supabase
        .from("payment_orders")
        .select("amount_mad, status, reservation_id")
        .eq("order_id", ref)
        .maybeSingle();
      if (order && (order as any).reservation_id === id && (order as any).status === "paid") {
        transactionAmount = Number((order as any).amount_mad);
        recorded = true;
      }
    }
  }

  // Reste à payer APRÈS cette transaction.
  const remainingAfter = recorded
    ? Math.max(0, total - paidCumulative)
    : Math.max(0, total - paidCumulative - (transactionAmount ?? 0));
  const settledAfter = remainingAfter <= 0;

  const pending = isStripe && !recorded; // Stripe en attente du webhook
  const showAmount = transactionAmount !== null;
  const clientName = r.customers?.full_name ?? null;
  const circuitTitle = r.circuits?.title ?? null;
  const methodLabel = isStripe ? "Stripe · carte internationale" : "Attijari Payment";
  const refDisplay =
    externalRef && externalRef.length > 22 ? `${externalRef.slice(0, 20)}…` : externalRef;
  const emittedOn = formatDate(new Date());

  return (
    <TunnelShell bodyClassName="text-center">
      {/* En-tête imprimé uniquement */}
      <div className="hidden print:block text-left mb-6">
        <h2 className="font-display text-xl text-[#1A1F2E]">
          Hiri Tours — Reçu de paiement
        </h2>
        <p className="text-[11px] text-[#968F84] mt-0.5">
          Hiri Tours Plateforme by Bright Strategy
        </p>
        <p className="text-[11px] text-[#968F84]">Émis le {emittedOn}</p>
      </div>

      <div className="py-4">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#E1F5EE] print:hidden">
          <CircleCheck className="size-10 text-[#0F6E56]" />
        </div>

        <h1 className="font-display text-[22px] text-[#1A1F2E] mb-1.5">Paiement reçu</h1>
        <p className="text-[13px] text-[#6B6862] mb-6">
          {pending
            ? "Votre paiement a été confirmé — enregistrement en cours…"
            : settledAfter
              ? "Votre réservation est confirmée."
              : "Votre acompte a bien été enregistré."}
        </p>

        {/* Montant de LA transaction */}
        {showAmount ? (
          <div className="mb-5">
            <div className="text-[11px] tracking-wider uppercase text-[#968F84]">
              Montant réglé
            </div>
            <div className="font-display text-[30px] text-[#0F6E56] tabular-nums leading-tight">
              {formatMAD(transactionAmount as number)}
            </div>
            {/* Contexte : total prestation + reste à payer */}
            <div className="mt-2 space-y-0.5 text-[12px] text-[#6B6862]">
              <div>Total de la prestation : {formatMAD(total)}</div>
              {settledAfter ? (
                <div className="font-medium" style={{ color: "#0F6E56" }}>Prestation soldée</div>
              ) : (
                <div>Reste à payer : {formatMAD(remainingAfter)}</div>
              )}
            </div>
            {pending && (
              <div className="text-[11px] text-[#968F84] mt-1">Enregistrement en cours…</div>
            )}
          </div>
        ) : (
          <div className="mb-5 text-[12px] text-[#968F84]">
            Le paiement sera visible dans quelques secondes.
          </div>
        )}

        {/* Détails du reçu */}
        <div className="rounded-xl border border-[#E5E0D7] bg-white px-5 py-4 text-[13px] text-left space-y-2 max-w-xs mx-auto">
          {clientName && <ReceiptRow label="Client" value={clientName} />}
          {circuitTitle && <ReceiptRow label="Circuit" value={circuitTitle} />}
          <ReceiptRow label="Réservation" value={<span className="font-mono">{r.reference}</span>} />
          {refDisplay && (
            <ReceiptRow label="Transaction" value={<span className="font-mono">{refDisplay}</span>} />
          )}
          <ReceiptRow label="Méthode" value={methodLabel} />
          {paidAt && <ReceiptRow label="Payé le" value={formatDate(paidAt)} />}
        </div>

        {/* Actions (jamais imprimées) */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6 print:hidden">
          <PrintReceiptButton />
          {!pending && !settledAfter && (
            <Link
              href={`/payer/${id}`}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#E0DACF] bg-white px-4 text-[13px] font-medium text-[#1A1F2E] hover:bg-sand-100 transition-colors"
            >
              Régler le solde
            </Link>
          )}
        </div>

        <p className="text-[11px] text-[#968F84] mt-6">
          Environnement de démonstration — aucune transaction bancaire réelle
          n'a été effectuée.
        </p>
      </div>
    </TunnelShell>
  );
}

function ReceiptRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#6B6862]">{label}</span>
      <span className="text-[#1A1F2E] font-medium text-right">{value}</span>
    </div>
  );
}
