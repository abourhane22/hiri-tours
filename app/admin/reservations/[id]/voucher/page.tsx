import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMAD, formatDate } from "@/lib/utils";
import { VoucherPrintButton } from "@/components/voucher-print-button";

export default async function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: reservation } = await supabase
    .from("reservations")
    .select("*, circuits(title, slug, category, meeting_point, duration_days, duration_hours, included, excluded), customers(full_name, email, phone)")
    .eq("id", id)
    .single();

  if (!reservation) notFound();

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
                {r.circuits?.meeting_point && <tr><td className="py-2 text-sand-700">Point de rendez-vous</td><td className="py-2 text-ink">{r.circuits.meeting_point}</td></tr>}
              </tbody>
            </table>
          </div>

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
          </div>
        </div>
      </div>
    </div>
  );
}
