import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { VoucherPrintButton } from "@/components/voucher-print-button";

export default async function ManifestePage({ params }: { params: Promise<{ date: string; circuitId: string }> }) {
  const { date, circuitId } = await params;
  const supabase = await createClient();

  const { data: circuit } = await supabase.from("circuits").select("*").eq("id", circuitId).single();
  if (!circuit) notFound();

  const { data: reservations } = await supabase
    .from("reservations")
    .select("*, customers(full_name, email, phone, internal_notes, nationality)")
    .eq("circuit_id", circuitId)
    .eq("departure_date", date)
    .in("status", ["confirmed", "paid"])
    .order("created_at", { ascending: true });

  const totalPax = (reservations || []).reduce((sum: number, r: any) => sum + r.adults + r.children, 0);
  const totalAdults = (reservations || []).reduce((sum: number, r: any) => sum + r.adults, 0);
  const totalChildren = (reservations || []).reduce((sum: number, r: any) => sum + r.children, 0);

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto p-8 print:p-0">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <p className="text-sm text-sand-700">Manifeste passagers — cliquez sur Imprimer pour télécharger en PDF.</p>
          <VoucherPrintButton />
        </div>

        <div className="bg-white border border-sand-200 rounded-lg p-10 print:border-0 print:p-0">
          <div className="pb-6 border-b border-sand-200 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl text-navy-700">Hiri Tours</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta-600 font-medium">Manifeste passagers</span>
                </div>
              </div>
              <div className="text-right text-xs text-sand-700">
                <p>Document de bord</p>
                <p>Édité le {formatDate(new Date().toISOString())}</p>
              </div>
            </div>
            <h2 className="font-display text-2xl text-ink mt-4">{circuit.title}</h2>
            <p className="text-sm text-sand-800 mt-1">Départ le {formatDate(date)}</p>
            {circuit.meeting_point && <p className="text-sm text-sand-800 mt-1"><strong>Point de rendez-vous :</strong> {circuit.meeting_point}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="border border-sand-200 rounded p-3">
              <div className="text-xs text-sand-600 uppercase tracking-wide">Réservations</div>
              <div className="font-display text-2xl text-ink">{reservations?.length ?? 0}</div>
            </div>
            <div className="border border-sand-200 rounded p-3">
              <div className="text-xs text-sand-600 uppercase tracking-wide">Total pax</div>
              <div className="font-display text-2xl text-terracotta-600">{totalPax}</div>
            </div>
            <div className="border border-sand-200 rounded p-3">
              <div className="text-xs text-sand-600 uppercase tracking-wide">Adultes / Enfants</div>
              <div className="font-display text-2xl text-ink">{totalAdults}<span className="text-base text-sand-600"> / {totalChildren}</span></div>
            </div>
          </div>

          <table className="w-full text-sm border border-sand-200">
            <thead className="bg-sand-100 border-b border-sand-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-sand-800 border-r border-sand-200">#</th>
                <th className="text-left px-3 py-2 font-medium text-sand-800 border-r border-sand-200">Référence</th>
                <th className="text-left px-3 py-2 font-medium text-sand-800 border-r border-sand-200">Passager principal</th>
                <th className="text-left px-3 py-2 font-medium text-sand-800 border-r border-sand-200">Contact</th>
                <th className="text-right px-3 py-2 font-medium text-sand-800 border-r border-sand-200">A</th>
                <th className="text-right px-3 py-2 font-medium text-sand-800 border-r border-sand-200">E</th>
                <th className="text-left px-3 py-2 font-medium text-sand-800">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(reservations || []).map((r: any, i: number) => (
                <tr key={r.id} className="border-b border-sand-200 last:border-b-0">
                  <td className="px-3 py-2 border-r border-sand-200 text-sand-700">{i + 1}</td>
                  <td className="px-3 py-2 border-r border-sand-200 font-mono text-xs">{r.reference}</td>
                  <td className="px-3 py-2 border-r border-sand-200">
                    <div className="text-ink">{r.customers?.full_name ?? "—"}</div>
                    {r.customers?.nationality && <div className="text-xs text-sand-600">{r.customers.nationality}</div>}
                  </td>
                  <td className="px-3 py-2 border-r border-sand-200 text-xs">
                    {r.customers?.phone && <div>{r.customers.phone}</div>}
                    {r.customers?.email && <div className="text-sand-700">{r.customers.email}</div>}
                  </td>
                  <td className="px-3 py-2 border-r border-sand-200 text-right tabular-nums">{r.adults}</td>
                  <td className="px-3 py-2 border-r border-sand-200 text-right tabular-nums">{r.children}</td>
                  <td className="px-3 py-2 text-xs text-sand-800">
                    {r.notes && <div>{r.notes}</div>}
                    {r.customers?.internal_notes && <div className="text-sand-600 italic">{r.customers.internal_notes}</div>}
                  </td>
                </tr>
              ))}
              {(reservations || []).length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-sand-700">Aucun passager.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-sand-50 border-t-2 border-sand-300">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right font-medium text-sand-800">Totaux</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium border-r border-sand-200">{totalAdults}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium border-r border-sand-200">{totalChildren}</td>
                <td className="px-3 py-2 font-medium">{totalPax} pax</td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-10 pt-4 border-t border-sand-300 text-xs text-sand-700 grid grid-cols-2 gap-8">
            <div>
              <p className="font-medium text-sand-800 mb-2">Signature guide</p>
              <div className="h-16 border-b border-sand-300"></div>
            </div>
            <div>
              <p className="font-medium text-sand-800 mb-2">Signature chauffeur</p>
              <div className="h-16 border-b border-sand-300"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
