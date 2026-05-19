import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatMAD, formatDateShort } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "paid", label: "Payée" },
  { value: "completed", label: "Terminée" },
  { value: "cancelled", label: "Annulée" },
];

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; q?: string; status?: string; circuit?: string }>;
}) {
  const { created, q, status, circuit } = await searchParams;
  const supabase = await createClient();

  const { data: circuits } = await supabase.from("circuits").select("id, title").eq("is_active", true).order("title");

  let query = supabase.from("reservations")
    .select("*, circuits(id, title, slug, category), customers(id, full_name, email)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (circuit) query = query.eq("circuit_id", circuit);

  const { data: allReservations } = await query;
  const trimmedQ = (q || "").trim().toLowerCase();
  const reservations = trimmedQ
    ? (allReservations || []).filter((r: any) =>
        r.reference?.toLowerCase().includes(trimmedQ) ||
        r.customers?.full_name?.toLowerCase().includes(trimmedQ) ||
        r.customers?.email?.toLowerCase().includes(trimmedQ)
      )
    : (allReservations || []);

  const hasFilters = !!(q || status || circuit);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Module 1 — Réservations</p>
          <h1 className="font-display text-3xl text-ink">Dossiers de réservation</h1>
        </div>
        <Link href="/admin/reservations/new"><Button><Plus className="size-4" />Nouvelle réservation</Button></Link>
      </div>

      {created && (
        <div className="mb-6 p-4 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          ✅ Réservation <span className="font-mono">{created}</span> créée avec succès.
        </div>
      )}

      <form method="get" className="bg-white border border-sand-200 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs uppercase tracking-wide text-sand-600 mb-1">Recherche</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-sand-500" />
            <Input name="q" defaultValue={q || ""} placeholder="Référence, nom client, email..." className="pl-9" />
          </div>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs uppercase tracking-wide text-sand-600 mb-1">Statut</label>
          <Select name="status" defaultValue={status || ""}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs uppercase tracking-wide text-sand-600 mb-1">Circuit</label>
          <Select name="circuit" defaultValue={circuit || ""}>
            <option value="">Tous les circuits</option>
            {circuits?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
        </div>
        <Button type="submit" size="md">Filtrer</Button>
        {hasFilters && (
          <Link href="/admin/reservations">
            <Button type="button" variant="secondary" size="md"><X className="size-3.5" />Réinitialiser</Button>
          </Link>
        )}
      </form>

      {hasFilters && (
        <p className="text-xs text-sand-700 mb-3">{reservations.length} résultat{reservations.length > 1 ? "s" : ""}</p>
      )}

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Référence</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Circuit</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Client</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Départ</th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">Pax</th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">Encaissé / Total</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {reservations.length > 0 ? reservations.map((r: any) => {
              const totalPaid = Number(r.paid_amount_mad);
              const totalAmount = Number(r.total_amount_mad);
              const balance = totalAmount - totalPaid;
              const cust = r.customers;
              return (
                <tr key={r.id} className="hover:bg-sand-50 transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/admin/reservations/${r.id}`} className="font-mono text-sm text-terracotta-600 hover:text-terracotta-700 hover:underline">{r.reference}</Link>
                  </td>
                  <td className="px-5 py-4"><div className="text-ink">{r.circuits?.title ?? "—"}</div></td>
                  <td className="px-5 py-4">
                    {cust ? <Link href={`/admin/clients/${cust.id}`} className="text-ink hover:text-terracotta-600">{cust.full_name}</Link> : <span className="text-sand-500">—</span>}
                    {cust?.email && <div className="text-xs text-sand-600">{cust.email}</div>}
                  </td>
                  <td className="px-5 py-4 text-sand-800">{formatDateShort(r.departure_date)}</td>
                  <td className="px-5 py-4 text-right tabular-nums">{r.adults + r.children}<span className="text-xs text-sand-600 ml-1">({r.adults}A{r.children > 0 ? `/${r.children}E` : ""})</span></td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    <span className={balance <= 0 ? "text-emerald-700 font-medium" : "text-ink"}>{formatMAD(totalPaid)}</span>
                    <span className="text-sand-500"> / {formatMAD(totalAmount)}</span>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={r.status} /></td>
                </tr>
              );
            }) : (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-sand-700">
                {hasFilters ? "Aucun résultat pour ces filtres." : "Aucune réservation pour le moment."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { tone: "warning"|"info"|"success"|"danger"|"neutral"; label: string }> = {
    pending: { tone: "warning", label: "En attente" },
    confirmed: { tone: "info", label: "Confirmée" },
    paid: { tone: "success", label: "Payée" },
    cancelled: { tone: "danger", label: "Annulée" },
    completed: { tone: "neutral", label: "Terminée" },
  };
  const c = config[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={c.tone}>{c.label}</Badge>;
}
