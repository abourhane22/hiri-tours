"use client";

import { Clock, Luggage, RefreshCw, Undo2, AlertTriangle, ChevronRight } from "lucide-react";
import { formatDateShort } from "@/lib/utils";
import {
  baggageSummary,
  formatMinutes,
  formatMoney,
  isoDurationToMinutes,
  offerIsExpired,
  sliceMinutes,
  type DuffelOffer,
  type DuffelSlice,
} from "@/lib/duffel-types";

/** "2026-10-12T10:35:00" → "10:35" (heure locale de l'aéroport, telle que fournie). */
export const hhmm = (iso: string) => iso.slice(11, 16);
export const ymd = (iso: string) => iso.slice(0, 10);

export function countdownLabel(expiresAt: string, now: number): string {
  const ms = Date.parse(expiresAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return "Offre expirée";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `expire dans ${h} h ${String(m).padStart(2, "0")}`;
  if (m > 0) return `expire dans ${m} min ${String(s).padStart(2, "0")}`;
  return `expire dans ${s} s`;
}

export function AirlineBadge({ name, iata, logo }: { name: string; iata: string | null; logo?: string | null }) {
  const fictive = iata === "ZZ";
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-5 rounded-sm object-contain shrink-0" />
      ) : (
        <span className="size-5 rounded-sm bg-[#F1EFE8] text-[9px] font-mono flex items-center justify-center text-[#6B6862] shrink-0">
          {iata ?? "—"}
        </span>
      )}
      <span className="truncate text-[13px] font-medium text-[#1A1F2E]">{name}</span>
      {fictive && (
        <span
          className="inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium shrink-0"
          style={{ backgroundColor: "#E1F5EE", color: "#085041" }}
          title="Compagnie fictive de l'environnement de test Duffel — la seule dont les offres sont réservables de façon fiable en test"
        >
          ZZ · fictive · réservable en test
        </span>
      )}
    </span>
  );
}

export function SliceRow({ slice, compact }: { slice: DuffelSlice; compact?: boolean }) {
  const first = slice.segments[0];
  const last = slice.segments[slice.segments.length - 1];
  if (!first || !last) return null;
  const stops = slice.segments.length - 1;
  const bags = baggageSummary(first);
  const overnight = ymd(first.departing_at) !== ymd(last.arriving_at);

  return (
    <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-right shrink-0">
            <div className="font-display text-[17px] text-[#1A1F2E] tabular-nums leading-none">{hhmm(first.departing_at)}</div>
            <div className="text-[11px] font-mono text-[#6B6862] mt-0.5">{first.origin.iata_code}</div>
          </div>
          <div className="flex-1 min-w-[80px] text-center">
            <div className="text-[11px] text-[#6B6862] tabular-nums">{formatMinutes(sliceMinutes(slice))}</div>
            <div className="relative h-px my-1" style={{ backgroundColor: "#C9C4BA" }}>
              {Array.from({ length: stops }).map((_, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 size-1.5 rounded-full"
                  style={{ backgroundColor: "#D98324", left: `${((i + 1) / (stops + 1)) * 100}%` }}
                />
              ))}
            </div>
            <div className="text-[11px]" style={{ color: stops === 0 ? "#0F6E56" : "#B25F0B" }}>
              {stops === 0 ? "direct" : `${stops} escale${stops > 1 ? "s" : ""}`}
            </div>
          </div>
          <div className="shrink-0">
            <div className="font-display text-[17px] text-[#1A1F2E] tabular-nums leading-none">
              {hhmm(last.arriving_at)}
              {overnight && <sup className="text-[10px] text-[#B25F0B] ml-0.5">+1</sup>}
            </div>
            <div className="text-[11px] font-mono text-[#6B6862] mt-0.5">{last.destination.iata_code}</div>
          </div>
        </div>
        <div className="text-right shrink-0 text-[11px] text-[#6B6862]">
          <div>{formatDateShort(ymd(first.departing_at))}</div>
          {bags && (
            <div className="inline-flex items-center gap-1 mt-0.5">
              <Luggage className="size-3" /> {bags}
            </div>
          )}
        </div>
      </div>

      {!compact && (
        <ul className="mt-2.5 pt-2.5 border-t border-[#EEE9E0] space-y-1.5">
          {slice.segments.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-[#58524A]">
              <span className="font-mono text-[#1A1F2E]">
                {s.marketing_carrier.iata_code ?? ""}
                {s.marketing_carrier_flight_number ?? ""}
              </span>
              <span className="tabular-nums">
                {hhmm(s.departing_at)} {s.origin.iata_code} → {hhmm(s.arriving_at)} {s.destination.iata_code}
              </span>
              <span className="text-[#968F84]">
                {formatMinutes(isoDurationToMinutes(s.duration) ?? sliceMinutes({ ...slice, segments: [s] }))}
              </span>
              {s.aircraft?.name && <span className="text-[#968F84]">{s.aircraft.name}</span>}
              {s.operating_carrier && s.operating_carrier.iata_code !== s.marketing_carrier.iata_code && (
                <span className="text-[#968F84]">opéré par {s.operating_carrier.name}</span>
              )}
              {s.passengers?.[0]?.cabin_class_marketing_name && (
                <span className="text-[#968F84]">{s.passengers[0].cabin_class_marketing_name}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ConditionChips({ offer }: { offer: DuffelOffer }) {
  const r = offer.conditions?.refund_before_departure ?? null;
  const c = offer.conditions?.change_before_departure ?? null;
  const chip = (ok: boolean | null, label: string, penalty?: string | null, cur?: string | null, Icon = Undo2) => {
    if (ok === null) return null;
    const bg = ok ? "#E1F5EE" : "#F1EFE8";
    const color = ok ? "#085041" : "#6B6862";
    const pen = ok && penalty && Number(penalty) > 0 ? ` · frais ${formatMoney(penalty, cur ?? offer.total_currency)}` : "";
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: bg, color }}>
        <Icon className="size-3" /> {ok ? label : `Non ${label.toLowerCase()}`}
        {pen}
      </span>
    );
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {chip(r ? r.allowed : null, "Remboursable", r?.penalty_amount, r?.penalty_currency, Undo2)}
      {chip(c ? c.allowed : null, "Modifiable", c?.penalty_amount, c?.penalty_currency, RefreshCw)}
      {offer.passenger_identity_documents_required && (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "#E6F1FB", color: "#0C447C" }}>
          Passeport requis
        </span>
      )}
    </div>
  );
}

export function OfferCard({
  offer,
  now,
  onSelect,
  selected,
}: {
  offer: DuffelOffer;
  now: number;
  onSelect: (offer: DuffelOffer) => void;
  selected?: boolean;
}) {
  const expired = offerIsExpired(offer, now);
  const soon = !expired && Date.parse(offer.expires_at) - now < 5 * 60_000;

  return (
    <div
      className={`bg-white border rounded-xl p-4 transition-colors ${
        selected ? "border-[#1A1F2E] ring-1 ring-[#1A1F2E]" : "border-[#E5E0D7]"
      } ${expired ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <AirlineBadge name={offer.owner.name} iata={offer.owner.iata_code} logo={offer.owner.logo_symbol_url} />
        <div className="text-right">
          <div className="font-display text-[22px] text-[#1A1F2E] tabular-nums leading-none">
            {formatMoney(offer.total_amount, offer.total_currency)}
          </div>
          <div className="text-[10.5px] text-[#968F84] mt-1">
            {offer.passengers.length} passager{offer.passengers.length > 1 ? "s" : ""} · conversion MAD au lot D1b
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {offer.slices.map((sl) => (
          <SliceRow key={sl.id} slice={sl} compact />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <ConditionChips offer={offer} />
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1 text-[11px] tabular-nums"
            style={{ color: expired ? "#791F1F" : soon ? "#B25F0B" : "#968F84" }}
          >
            {expired ? <AlertTriangle className="size-3" /> : <Clock className="size-3" />}
            {countdownLabel(offer.expires_at, now)}
          </span>
          <button
            type="button"
            disabled={expired}
            onClick={() => onSelect(offer)}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1A1F2E] px-3 text-[12px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {expired ? "Expirée" : "Voir le détail"} {!expired && <ChevronRight className="size-3.5" />}
          </button>
        </div>
      </div>
      {expired && (
        <p className="mt-2 text-[11.5px]" style={{ color: "#791F1F" }}>
          Offre expirée — relancez la recherche pour obtenir des prix à jour.
        </p>
      )}
    </div>
  );
}
