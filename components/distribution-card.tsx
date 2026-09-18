import { FlaskConical, Lock, Ticket, FileText } from "lucide-react";
import { formatMAD, formatDate } from "@/lib/utils";
import { formatMoney, offerIsExpired, type DuffelDocument, type DuffelOrder } from "@/lib/duffel-types";
import { DISTRIBUTION_STATUS_LABEL, DISTRIBUTION_STATUS_STYLE, FX_SOURCE_LABEL, offerFromSnapshot } from "@/lib/distribution";
import { SliceRow, AirlineBadge, ConditionChips } from "@/components/billetterie/offer-card";
import { DistributionActions } from "@/components/distribution-actions";
import type { DistributionBooking } from "@/lib/types";

/** Contenu de la carte « Détail du vol » sur la fiche dossier. Serveur ; lu depuis les snapshots. */
export function DistributionCard({
  booking,
  tokenMode,
  reservationCancelled,
}: {
  booking: DistributionBooking;
  tokenMode: "test" | "live" | "unknown";
  reservationCancelled: boolean;
}) {
  const offer = offerFromSnapshot(booking.offer_snapshot);
  const order = (booking.order_snapshot ?? null) as DuffelOrder | null;
  const docs = (Array.isArray(booking.documents) ? booking.documents : []) as DuffelDocument[];
  const st = DISTRIBUTION_STATUS_STYLE[booking.status];
  const expired = offer ? offerIsExpired(offer) : booking.offer_expires_at ? Date.parse(booking.offer_expires_at) <= Date.now() : false;

  const liveBlocked = booking.live_mode || tokenMode === "live";
  const canIssue = booking.status === "draft" && !liveBlocked && !reservationCancelled && !expired;
  const canCancel = booking.status === "ordered" && !liveBlocked;
  const blockedReason = liveBlocked
    ? "Identifiant ou offre LIVE : ce démonstrateur n'émet ni n'annule de vrais billets."
    : booking.status === "draft" && expired
      ? "L'offre a expiré : ce dossier ne peut plus être émis. Relancez une recherche et créez un nouveau dossier."
      : booking.status === "draft" && reservationCancelled
        ? "Dossier annulé — aucune émission possible."
        : booking.failure_message && booking.status !== "ordered"
          ? booking.failure_message
          : null;

  return (
    <div className="space-y-3">
      {/* Mode + statut */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
          style={{ backgroundColor: st.bg, color: st.color }}
        >
          {DISTRIBUTION_STATUS_LABEL[booking.status]}
        </span>
        {booking.live_mode ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ backgroundColor: "#791F1F", color: "#FCEBEB" }}>
            <Lock className="size-3" /> LIVE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ backgroundColor: "#7A4B00", color: "#FFF4E0" }}>
            <FlaskConical className="size-3" /> TEST · Duffel
          </span>
        )}
      </div>

      {/* Référence & e-tickets */}
      {booking.status === "ordered" && (
        <div className="rounded-lg p-3" style={{ backgroundColor: "#E1F5EE", border: "1px solid #A9DFCC" }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10.5px] uppercase tracking-wide font-medium" style={{ color: "#085041" }}>Référence de réservation</span>
            <span className="font-mono text-[18px] tracking-wider text-[#1A1F2E]">{booking.booking_reference ?? "—"}</span>
          </div>
          <div className="text-[11px] mt-1" style={{ color: "#085041" }}>
            Ordre Duffel <span className="font-mono">{booking.order_id}</span>
            {booking.ordered_at && <> · émis le {formatDate(booking.ordered_at)}</>}
          </div>
          {docs.length > 0 && (
            <ul className="mt-2 space-y-1">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[12px] text-[#1A1F2E]">
                  <Ticket className="size-3.5 text-[#085041]" />
                  <span className="font-mono">{d.unique_identifier}</span>
                  <span className="text-[11px] text-[#6B6862]">· {d.type.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          )}
          {order?.payment_status?.awaiting_payment && (
            <p className="text-[11px] mt-1.5" style={{ color: "#B25F0B" }}>
              En attente de paiement Duffel{order.payment_status.payment_required_by ? ` avant le ${formatDate(order.payment_status.payment_required_by)}` : ""}.
            </p>
          )}
        </div>
      )}

      {booking.status === "cancelled" && (
        <div className="rounded-lg px-3 py-2.5 text-[12.5px]" style={{ backgroundColor: "#F1EFE8", border: "1px solid #E0DACF", color: "#58524A" }}>
          Ordre annulé{booking.cancelled_at && <> le {formatDate(booking.cancelled_at)}</>}.
          {(() => {
            const c = booking.cancellation_snapshot as { refund_amount?: string | null; refund_currency?: string | null; refund_to?: string | null } | null;
            return c?.refund_amount ? <> Remboursement {c.refund_amount} {c.refund_currency ?? ""} ({c.refund_to ?? "—"}).</> : null;
          })()}
        </div>
      )}

      {/* Prix : devise + MAD + taux figé */}
      <div className="rounded-lg p-3" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] uppercase tracking-wide text-[#968F84]">Prix de l&apos;offre</span>
          <span className="font-display text-[20px] text-[#1A1F2E] tabular-nums">{formatMAD(booking.amount_mad)}</span>
        </div>
        <div className="text-[11.5px] text-[#6B6862] mt-0.5 tabular-nums">
          {formatMoney(booking.amount, booking.currency)} × {Number(booking.fx_rate)} MAD · {FX_SOURCE_LABEL[booking.fx_source]}
        </div>
      </div>

      {/* Compagnie + segments + conditions (depuis le snapshot) */}
      {offer ? (
        <div className="space-y-2">
          <AirlineBadge name={offer.owner.name} iata={offer.owner.iata_code} logo={offer.owner.logo_symbol_url} />
          {offer.slices.map((sl) => <SliceRow key={sl.id} slice={sl} />)}
          <ConditionChips offer={offer} />
          <p className="text-[11px] text-[#968F84] tabular-nums">
            Offre <span className="font-mono">{offer.id}</span>
            {booking.status === "draft" && (
              <> · {expired ? <span style={{ color: "#791F1F" }}>expirée</span> : <>valable jusqu&apos;au {new Date(offer.expires_at).toLocaleString("fr-FR")}</>}</>
            )}
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-[#968F84] italic inline-flex items-center gap-1.5">
          <FileText className="size-3.5" /> Snapshot d&apos;offre illisible.
        </p>
      )}

      {booking.status === "draft" && !reservationCancelled && (
        <p className="text-[11.5px] text-[#6B6862] leading-snug">
          Avant l&apos;émission, complétez la carte <span className="font-medium">Voyageurs</span> : prénom et nom exacts du
          passeport, date de naissance, genre{offer?.passenger_identity_documents_required ? ", passeport et sa date d'expiration" : ""}.
          Le contact (email, téléphone) est celui du client payeur.
        </p>
      )}

      <DistributionActions bookingId={booking.id} canIssue={canIssue} canCancel={canCancel} blockedReason={blockedReason} />
    </div>
  );
}
