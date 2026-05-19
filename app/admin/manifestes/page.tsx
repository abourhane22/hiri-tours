import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { FileText, ArrowRight } from "lucide-react";

export default async function ManifestesPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: reservations } = await supabase
    .from("reservations")
    .select("departure_date, adults, children, status, circuits(id, slug, title)")
    .gte("departure_date", today)
    .in("status", ["confirmed", "paid"])
    .order("departure_date", { ascending: true });

  const groups: Record<string, { date: string; circuitId: string; circuitSlug: string; circuitTitle: string; reservations: number; pax: number }> = {};
  (reservations || []).forEach((r: any) => {
    const key = `${r.departure_date}__${r.circuits?.id}`;
    if (!groups[key]) {
      groups[key] = {
        date: r.departure_date,
        circuitId: r.circuits?.id,
        circuitSlug: r.circuits?.slug,
        circuitTitle: r.circuits?.title,
        reservations: 0,
        pax: 0,
      };
    }
    groups[key].reservations += 1;
    groups[key].pax += r.adults + r.children;
  });

  const list = Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="eyebrow mb-2">Module 1 — Opérations terrain</p>
        <h1 className="font-display text-3xl text-ink">Manifestes passagers</h1>
        <p className="text-sm text-sand-700 mt-2">Liste des départs à venir avec réservations confirmées ou payées. Générez le manifeste pour chaque départ.</p>
      </div>

      {list.length > 0 ? (
        <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sand-100 border-b border-sand-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-sand-800">Date de départ</th>
                <th className="text-left px-5 py-3 font-medium text-sand-800">Circuit</th>
                <th className="text-right px-5 py-3 font-medium text-sand-800">Réservations</th>
                <th className="text-right px-5 py-3 font-medium text-sand-800">Passagers</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {list.map((g) => (
                <tr key={`${g.date}-${g.circuitId}`} className="hover:bg-sand-50">
                  <td className="px-5 py-4 text-ink">{formatDate(g.date)}</td>
                  <td className="px-5 py-4 text-ink">{g.circuitTitle}</td>
                  <td className="px-5 py-4 text-right tabular-nums">{g.reservations}</td>
                  <td className="px-5 py-4 text-right tabular-nums font-medium">{g.pax}</td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/admin/manifestes/${g.date}/${g.circuitId}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-terracotta-600 hover:text-terracotta-700">
                      <FileText className="size-3.5" />Manifeste<ArrowRight className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-sand-200 rounded-lg p-12 text-center text-sand-700">
          Aucun départ à venir avec réservations confirmées.
        </div>
      )}
    </div>
  );
}
