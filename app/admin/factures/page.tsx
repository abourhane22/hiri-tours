import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMAD, formatDateShort } from "@/lib/utils";
import { Search, X } from "lucide-react";

export default async function FacturesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("invoices")
    .select("id, invoice_number, issued_at, status, total_ttc_mad, customer_id, customers(full_name, email)")
    .order("issued_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data: invoices } = await query;
  const trimmed = (q || "").trim().toLowerCase();
  const filtered = trimmed
    ? (invoices || []).filter((i: any) =>
        i.invoice_number?.toLowerCase().includes(trimmed) ||
        i.customers?.full_name?.toLowerCase().includes(trimmed) ||
        i.customers?.email?.toLowerCase().includes(trimmed))
    : (invoices || []);

  const hasFilters = !!(q || status);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="eyebrow mb-2">Module 4 — Facturation</p>
        <h1 className="font-display text-3xl text-ink">Factures émises</h1>
        <p className="text-sm text-sand-700 mt-2">Les factures sont émises depuis chaque fiche réservation payée. Numérotation officielle séquentielle (HT-YYYY-NNNN).</p>
      </div>

      <form method="get" className="bg-white border border-sand-200 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs uppercase tracking-wide text-sand-600 mb-1">Recherche</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-sand-500" />
            <Input name="q" defaultValue={q || ""} placeholder="Numéro facture, nom client, email..." className="pl-9" />
          </div>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs uppercase tracking-wide text-sand-600 mb-1">Statut</label>
          <Select name="status" defaultValue={status || ""}>
            <option value="">Tous les statuts</option>
            <option value="issued">Émise</option>
            <option value="cancelled">Annulée</option>
          </Select>
        </div>
        <Button type="submit">Filtrer</Button>
        {hasFilters && <Link href="/admin/factures"><Button type="button" variant="secondary"><X className="size-3.5" />Réinitialiser</Button></Link>}
      </form>

      {hasFilters && <p className="text-xs text-sand-700 mb-3">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</p>}

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Numéro</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Émise le</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Client</th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">Total TTC</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {filtered.length > 0 ? filtered.map((i: any) => (
              <tr key={i.id} className="hover:bg-sand-50">
                <td className="px-5 py-4">
                  <Link href={`/admin/factures/${i.id}`} className="font-mono text-sm text-terracotta-600 hover:text-terracotta-700 hover:underline">{i.invoice_number}</Link>
                </td>
                <td className="px-5 py-4 text-sand-800">{formatDateShort(i.issued_at)}</td>
                <td className="px-5 py-4">
                  <div className="text-ink">{i.customers?.full_name ?? "—"}</div>
                  {i.customers?.email && <div className="text-xs text-sand-600">{i.customers.email}</div>}
                </td>
                <td className="px-5 py-4 text-right tabular-nums font-medium">{formatMAD(i.total_ttc_mad)}</td>
                <td className="px-5 py-4">
                  <Badge tone={i.status === "issued" ? "success" : "danger"}>
                    {i.status === "issued" ? "Émise" : "Annulée"}
                  </Badge>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-sand-700">
                {hasFilters ? "Aucun résultat." : "Aucune facture émise pour le moment. Émettez-en une depuis une réservation payée."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
