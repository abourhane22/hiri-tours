import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { formatMAD, formatDateShort } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { CustomerWithStats } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  walk_in: "Walk-in",
  phone: "Téléphone",
  whatsapp: "WhatsApp",
  email: "Email",
  website: "Site web",
  referral: "Bouche-à-oreille",
  social_media: "Réseaux sociaux",
  partner: "Partenaire",
  other: "Autre",
};

export default async function AdminClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("customers_with_stats")
    .select("*")
    .order("full_name", { ascending: true });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Module 3 — Base clients</p>
          <h1 className="font-display text-3xl text-ink">Clients</h1>
        </div>
        <Link href="/admin/clients/new">
          <Button>
            <Plus className="size-4" />
            Nouveau client
          </Button>
        </Link>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">
                Nom
              </th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">
                Contact
              </th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">
                Source
              </th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">
                Réservations
              </th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">
                Total dépensé
              </th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">
                Dernière sortie
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {clients && clients.length > 0 ? (
              (clients as CustomerWithStats[]).map((c) => (
                <tr key={c.id} className="hover:bg-sand-50 transition-colors">
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="font-medium text-ink hover:text-terracotta-600"
                    >
                      {c.full_name}
                    </Link>
                    {c.nationality && (
                      <div className="text-xs text-sand-600">
                        {c.nationality}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {c.email && (
                      <div className="text-sand-800">{c.email}</div>
                    )}
                    {c.phone && (
                      <div className="text-xs text-sand-600">{c.phone}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sand-700">
                    {SOURCE_LABEL[c.acquisition_source] ?? c.acquisition_source}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-ink">
                    {c.nb_reservations}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-terracotta-600 font-medium">
                    {formatMAD(c.total_spent_mad)}
                  </td>
                  <td className="px-5 py-4 text-sand-700">
                    {c.last_departure_date
                      ? formatDateShort(c.last_departure_date)
                      : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-sand-700"
                >
                  Aucun client enregistré.{" "}
                  <Link
                    href="/admin/clients/new"
                    className="text-terracotta-600 hover:underline"
                  >
                    Créer le premier
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
