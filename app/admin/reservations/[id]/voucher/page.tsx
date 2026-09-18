import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMAD, formatDate } from "@/lib/utils";
import { VoucherPrintButton } from "@/components/voucher-print-button";
import { TRAVELER_TYPE_LABEL } from "@/lib/travelers";
import type { TravelerType, DistributionBooking } from "@/lib/types";
import type { DuffelDocument, DuffelOrder, DuffelSlice } from "@/lib/duffel-types";
import { offerFromSnapshot, ticketsByTraveler } from "@/lib/distribution";

export default async function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: reservation } = await supabase
    .from("reservations")
    .select("*, circuits(title, slug, category, meeting_point, duration_days, duration_hours, included, excluded), customers(full_name, email, phone)")
    .eq("id", id)
    .single();

  if (!reservation) notFound();

  // Document remis au client : noms + type uniquement, jamais de passeport.
  const { data: travelersData } = await supabase
    .from("reservation_travelers")
    .select("full_name, traveler_type")
    .eq("reservation_id", id)
    .order("created_at", { ascending: true });
  const travelers = (travelersData ?? []) as { full_name: string; traveler_type: TravelerType }[];

  // Billetterie : uniquement si l'ordre est ÉMIS. Référence, segments et
  // e-tickets viennent des snapshots figés ; aucun passeport sur le document.
  const { data: distRow } = await supabase
    .from("distribution_bookings")
    .select("*")
    .eq("reservation_id", id)
    .eq("status", "ordered")
    .order("ordered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const flight = (() => {
    const b = (distRow ?? null) as DistributionBooking | null;
    if (!b || b.status !== "ordered") return null;
    const offer = offerFromSnapshot(b.offer_snapshot);
    const order = (b.order_snapshot ?? null) as DuffelOrder | null;
    const slices: DuffelSlice[] = order?.slices?.length ? order.slices : offer?.slices ?? [];
    const docs = (Array.isArray(b.documents) ? b.documents : []) as DuffelDocument[];
    const tickets = offer ? ticketsByTraveler(offer, docs, travelers) : travelers.map(() => []);
    return {
      reference: b.booking_reference,
      airline: order?.owner?.name ?? offer?.owner.name ?? "—",
      airlineIata: order?.owner?.iata_code ?? offer?.owner.iata_code ?? null,
      slices,
      tickets,
      liveMode: b.live_mode,
    };
  })();
  const flightDay = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const flightTime = (iso: string) => iso.slice(11, 16);

  const r = reservation as any;
  const totalPaid = Number(r.paid_amount_mad);
  const totalAmount = Number(r.total_amount_mad);
  const balance = totalAmount - totalPaid;

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto p-8 print:p-0">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <p className="text-sm text-sand-700">Aperçu du voucher — cliquez sur Imprimer pour télécharger en PDF.</p>
          <VoucherPrintButton />
        </div>

        <div className="bg-white border border-sand-200 rounded-lg p-10 print:border-0 print:p-0 print:rounded-none">
          <div className="flex justify-between items-start pb-6 border-b border-sand-200 mb-6">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl text-navy-700">Hiri Tours</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta-600 font-medium">Voucher</span>
              </div>
              <p className="text-xs text-sand-700 mt-1">Agence touristique · Agadir, Maroc</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-sand-600 uppercase tracking-wide">Référence</div>
              <div className="font-mono text-lg text-ink">{r.reference}</div>
              <div className="text-xs text-sand-700 mt-1">Émis le {formatDate(r.created_at)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium mb-2">Client</p>
              <p className="text-ink font-medium">{r.customers?.full_name ?? "—"}</p>
              {r.customers?.email && <p className="text-sm text-sand-800">{r.customers.email}</p>}
              {r.customers?.phone && <p className="text-sm text-sand-800">{r.customers.phone}</p>}
            </div>
            <div>
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium mb-2">Émetteur</p>
              <p className="text-ink font-medium">Hiri Tours</p>
              <p className="text-sm text-sand-800">contact@hiri-tours.com</p>
              <p className="text-sm text-sand-800">Agadir, Maroc</p>
            </div>
          </div>

          <div className="mb-6 pb-6 border-b border-sand-200">
            <h2 className="font-display text-xl text-ink mb-3">{r.circuits?.title}</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-sand-100">
                <tr><td className="py-2 text-sand-700 w-1/3">Date de départ</td><td className="py-2 text-ink font-medium">{formatDate(r.departure_date)}</td></tr>
                <tr><td className="py-2 text-sand-700">Durée</td><td className="py-2 text-ink">{r.circuits?.duration_days > 1 ? `${r.circuits.duration_days} jours` : r.circuits?.duration_hours ? `${r.circuits.duration_hours} h` : "1 jour"}</td></tr>
                <tr><td className="py-2 text-sand-700">Participants</td><td className="py-2 text-ink">{r.adults} adulte{r.adults > 1 ? "s" : ""}{r.children > 0 && `, ${r.children} enfant${r.children > 1 ? "s" : ""}`}</td></tr>
                {travelers.length > 0 && (
                  <tr>
                    <td className="py-2 text-sand-700 align-top">Voyageurs</td>
                    <td className="py-2 text-ink">
                      <ul className="space-y-0.5">
                        {travelers.map((t, i) => (
                          <li key={i}>
                            {t.full_name} <span className="text-sand-600 text-xs">· {TRAVELER_TYPE_LABEL[t.traveler_type]}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
                {r.circuits?.meeting_point && <tr><td className="py-2 text-sand-700">Point de rendez-vous</td><td className="py-2 text-ink">{r.circuits.meeting_point}</td></tr>}
              </tbody>
            </table>
          </div>

          {flight && (
            <div className="mb-6 pb-6 border-b border-sand-200 break-inside-avoid">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">Billet d&apos;avion</p>
                  <p className="text-sm text-ink mt-0.5">
                    {flight.airline}
                    {flight.airlineIata && <span className="text-sand-600"> · {flight.airlineIata}</span>}
                    {!flight.liveMode && <span className="text-[10px] uppercase tracking-wide text-sand-500 ml-2">environnement de test</span>}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-sand-600 uppercase tracking-wide">Référence de réservation</div>
                  <div className="font-mono text-2xl tracking-[0.15em] text-navy-700 leading-tight">{flight.reference ?? "—"}</div>
                  <div className="text-[10px] text-sand-600 mt-0.5">à présenter à l&apos;enregistrement</div>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-sand-600">
                    <th className="text-left font-medium py-1.5 w-[22%]">Vol</th>
                    <th className="text-left font-medium py-1.5">Départ</th>
                    <th className="text-left font-medium py-1.5">Arrivée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {flight.slices.map((sl, si) =>
                    sl.segments.map((seg, gi) => (
                      <tr key={`${si}-${gi}`}>
                        <td className="py-2 align-top">
                          <div className="font-mono text-ink">
                            {seg.marketing_carrier?.iata_code ?? flight.airlineIata ?? ""}
                            {seg.marketing_carrier_flight_number ?? ""}
                          </div>
                          {gi === 0 && flight.slices.length > 1 && (
                            <div className="text-[10px] uppercase tracking-wide text-sand-600">{si === 0 ? "Aller" : "Retour"}</div>
                          )}
                        </td>
                        <td className="py-2 align-top">
                          <div className="text-ink">
                            <span className="font-medium">{seg.origin.iata_code}</span>
                            <span className="text-sand-700"> · {seg.origin.name}</span>
                          </div>
                          <div className="text-xs text-sand-800 tabular-nums">
                            {flightDay(seg.departing_at)} · <span className="font-medium text-ink">{flightTime(seg.departing_at)}</span>
                          </div>
                        </td>
                        <td className="py-2 align-top">
                          <div className="text-ink">
                            <span className="font-medium">{seg.destination.iata_code}</span>
                            <span className="text-sand-700"> · {seg.destination.name}</span>
                          </div>
                          <div className="text-xs text-sand-800 tabular-nums">
                            {flightDay(seg.arriving_at)} · <span className="font-medium text-ink">{flightTime(seg.arriving_at)}</span>
                          </div>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>

              {travelers.length > 0 && (
                <table className="w-full text-sm mt-3">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-sand-600">
                      <th className="text-left font-medium py-1.5">Voyageur</th>
                      <th className="text-left font-medium py-1.5">Billet électronique</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {travelers.map((t, i) => (
                      <tr key={i}>
                        <td className="py-1.5 text-ink">
                          {t.full_name} <span className="text-sand-600 text-xs">· {TRAVELER_TYPE_LABEL[t.traveler_type]}</span>
                        </td>
                        <td className="py-1.5 font-mono text-ink tabular-nums">
                          {flight.tickets[i] && flight.tickets[i].length > 0 ? flight.tickets[i].join(", ") : <span className="text-sand-500 font-sans">en cours d&apos;émission</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-[10px] text-sand-600 mt-2">Horaires en heure locale de chaque aéroport. Présentez une pièce d&apos;identité en cours de validité au nom exact figurant sur le billet.</p>
            </div>
          )}

          {r.circuits?.included && r.circuits.included.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium mb-2">Inclus dans la prestation</p>
              <ul className="text-sm text-ink space-y-1">
                {r.circuits.included.map((item: string, i: number) => <li key={i}>• {item}</li>)}
              </ul>
            </div>
          )}

          <div className="bg-sand-50 -mx-10 px-10 py-5 mt-8 print:bg-transparent print:mx-0 print:px-0 print:border-t print:border-sand-300">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-sand-700 uppercase tracking-wide">Total</span>
              <span className="font-display text-3xl text-terracotta-600 tabular-nums">{formatMAD(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm mt-3 text-sand-800">
              <span>Encaissé</span>
              <span className="tabular-nums">{formatMAD(totalPaid)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1 font-medium">
              <span>Solde restant</span>
              <span className={balance > 0 ? "text-atlantic-700 tabular-nums" : "text-emerald-700 tabular-nums"}>{formatMAD(balance)}</span>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-sand-200 text-xs text-sand-700 space-y-2">
            <p><strong>Conditions :</strong> Ce voucher fait foi de réservation. Il doit être présenté le jour du départ. En cas d&apos;annulation, contactez l&apos;agence sous 48h avant le départ pour étudier les modalités.</p>
            <p>Pour toute question : contact@hiri-tours.com · +212 5 28 XX XX XX</p>
            <p className="text-center pt-4 italic">Hiri Tours vous souhaite un excellent séjour 🌅</p>
            <p className="text-center text-[10px] text-sand-500 pt-1">by Bright Strategy</p>
          </div>
        </div>
      </div>
    </div>
  );
}
