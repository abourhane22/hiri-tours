import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMAD, formatDateShort } from "@/lib/utils";

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created: searchParamsCreated } = await searchParams;
  const supabase = await createClient();
  const { data: reservations } = await supabase
    .from("reservations")
    .select("*, circuits(title, slug, category), customers(id, full_name, email)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Module 1 — Réservations</p>
          <h1 className="font-display text-3xl text-ink">
            Dossiers de réservation
          </h1>
        </div>
        <Link href="/admin/reservations/new">
          <Button>
            <Plus className="size-4" />
            Nouvelle réservation
          </Button>
        </Link>
      </div>

      {searchParamsCreated && (
        <div className="mb-6 p-4 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          ✅ Réservation{" "}
          <span className="font-mono">{searchParamsCreated}</span> créée avec
          succès.
        </div>
      )}

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">
                Référence
              </th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">
                Circuit
              </th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">
                Client
              </th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">
                Départ
              </th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">
                Pax
              </th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">
                Encaissé / Total
              </th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">
                Statut
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {reservations && reservations.length > 0 ? (
              reservations.map((r) => {
                const totalPaid = Number(r.paid_amount_mad);
                const totalAmount = Number(r.total_amount_mad);
                const balance = totalAmount - totalPaid;
                const customer = (r as any).customers;
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-sand-50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/reservations/${r.id}`}
                        className="font-mono text-sm text-terracotta-600 hover:text-terracotta-700 hover:underline"
                      >
                        {r.reference}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-ink">
                        {(r as any).circuits?.title ?? "—"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {customer ? (
                        <Link
                          href={`/admin/clients/${customer.id}`}
                          className="text-ink hover:text-terracotta-600"
                        >
                          {customer.full_name}
                        </Link>
                      ) : (
                        <span className="text-sand-500">—</span>
                      )}
                      {customer?.email && (
                        <div className="text-xs text-sand-600">
                          {customer.email}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sand-800">
                      {formatDateShort(r.departure_date)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {r.adults + r.children}
                      <span className="text-xs text-sand-600 ml-1">
                        ({r.adults}A
                        {r.children > 0 ? `/${r.children}E` : ""})
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      <span
                        className={
                          balance <= 0
                            ? "text-emerald-700 font-medium"
                            : "text-ink"
                        }
                      >
                        {formatMAD(totalPaid)}
                      </span>
                      <span className="text-sand-500">
                        {" "}
                        / {formatMAD(totalAmount)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-sand-700"
                >
                  Aucune réservation pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { tone: "warning" | "info" | "success" | "danger" | "neutral"; label: string }
  > = {
    pending: { tone: "warning", label: "En attente" },
    confirmed: { tone: "info", label: "Confirmée" },
    paid: { tone: "success", label: "Payée" },
    cancelled: { tone: "danger", label: "Annulée" },
    completed: { tone: "neutral", label: "Terminée" },
  };
  const c = config[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={c.tone}>{c.label}</Badge>;
}
