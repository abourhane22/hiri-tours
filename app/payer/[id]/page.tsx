import { notFound } from "next/navigation";
import { CircleCheck, Ban } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAttijariLogo } from "@/lib/attijari-server";
import { formatMAD, formatDate } from "@/lib/utils";
import { TunnelShell } from "@/components/payer/tunnel-shell";
import { AttijariPayPanel } from "@/components/payer/attijari-pay-panel";

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

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select(
      "id, reference, status, total_amount_mad, paid_amount_mad, departure_date, adults, children, circuits(title), customers(full_name)",
    )
    .eq("id", id)
    .maybeSingle();

  // Un échec de requête (clé service-role invalide, RLS, PostgREST…) ne doit
  // PAS se déguiser en 404 : on le remonte pour le voir dans les logs.
  if (error) {
    console.error("[payer/[id]] Échec de chargement de la réservation:", error);
    throw new Error(`Impossible de charger la réservation : ${error.message}`);
  }
  // Seul le cas "aucune ligne" est un vrai 404.
  if (!reservation) notFound();

  const r = reservation as any;
  const total = Number(r.total_amount_mad);
  const paid = Number(r.paid_amount_mad);
  const remaining = Math.max(0, total - paid);
  const clientName = r.customers?.full_name ?? "—";
  const circuitTitle = r.circuits?.title ?? "—";
  const isCancelled = r.status === "cancelled";
  const hasLogo = hasAttijariLogo();

  const adults = Number(r.adults ?? 0);
  const children = Number(r.children ?? 0);
  const paxLabel =
    `${adults} adulte${adults > 1 ? "s" : ""}` +
    (children > 0 ? `, ${children} enfant${children > 1 ? "s" : ""}` : "");

  return (
    <TunnelShell>
      {/* a. Titre */}
      <div className="mb-5">
        <h1 className="font-display text-[22px] text-[#1A1F2E] leading-tight">
          Régler ma réservation
        </h1>
        <p className="text-[13px] text-[#6B6862] mt-1">
          Vérifiez le récapitulatif puis choisissez votre moyen de paiement.
        </p>
      </div>

      {/* b. Carte récapitulatif */}
      <div className="rounded-xl border border-[#E5E0D7] bg-white p-4 mb-5">
        <p className="text-[11px] tracking-wider uppercase text-[#968F84] mb-3">
          Récapitulatif
        </p>
        <div className="space-y-2">
          <SummaryRow
            label="Référence"
            value={<span className="font-mono">{r.reference}</span>}
          />
          <SummaryRow label="Client" value={clientName} />
          <SummaryRow label="Circuit" value={circuitTitle} />
          <SummaryRow
            label="Départ"
            value={`${formatDate(r.departure_date)} · ${paxLabel}`}
          />
        </div>

        <div className="my-3 border-t border-[#E5E0D7]" />

        <div className="space-y-2">
          <SummaryRow label="Montant total" value={formatMAD(total)} />
          {paid > 0 && (
            <SummaryRow
              label="Déjà payé"
              value={
                <span className="text-[#0F6E56]">− {formatMAD(paid)}</span>
              }
            />
          )}
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-[13px] font-semibold text-[#1A1F2E]">
              Restant dû
            </span>
            <span className="font-display text-[26px] text-[#C84B31] tabular-nums leading-none">
              {formatMAD(remaining)}
            </span>
          </div>
        </div>
      </div>

      {/* c/d/e ou cas particuliers */}
      {isCancelled ? (
        <div className="rounded-xl bg-[#FDECEA] px-5 py-4 flex items-center gap-3">
          <Ban className="size-5 text-[#B42318] shrink-0" />
          <p className="text-sm text-[#B42318] font-medium">
            Cette réservation est annulée — aucun paiement n'est possible.
          </p>
        </div>
      ) : remaining <= 0 ? (
        <div className="rounded-xl bg-[#E1F5EE] px-5 py-4 flex items-center gap-3">
          <CircleCheck className="size-5 text-[#085041] shrink-0" />
          <p className="text-sm text-[#085041] font-medium">
            Cette réservation est déjà soldée. Merci !
          </p>
        </div>
      ) : (
        <AttijariPayPanel
          reservationId={id}
          remaining={remaining}
          hasLogo={hasLogo}
        />
      )}
    </TunnelShell>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-[13px]">
      <span className="text-[#6B6862]">{label}</span>
      <span className="text-[#1A1F2E] font-medium text-right">{value}</span>
    </div>
  );
}
