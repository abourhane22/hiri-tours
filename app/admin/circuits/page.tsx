import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { formatMAD } from "@/lib/utils";
import { Plus, Pencil } from "lucide-react";

export default async function AdminCircuitsPage() {
  const supabase = await createClient();
  const { data: circuits } = await supabase
    .from("circuits")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Module 2 — Catalogue</p>
          <h1 className="font-display text-3xl text-ink">Circuits & excursions</h1>
        </div>
        <Link href="/admin/circuits/new">
          <Button>
            <Plus className="size-4" />
            Nouveau circuit
          </Button>
        </Link>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Titre</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Catégorie</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Durée</th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">Prix</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Statut</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {circuits && circuits.length > 0 ? (
              circuits.map((c) => (
                <tr key={c.id} className="hover:bg-sand-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-medium text-ink">{c.title}</div>
                    <div className="text-xs text-sand-600 font-mono">{c.slug}</div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone="accent">
                      {labelForCategory(c.category)}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-sand-800">
                    {c.duration_days > 1
                      ? `${c.duration_days} jours`
                      : c.duration_hours
                        ? `${c.duration_hours} h`
                        : "1 jour"}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {formatMAD(c.base_price_mad)}
                  </td>
                  <td className="px-5 py-4">
                    {c.is_active ? (
                      <Badge tone="success">Actif</Badge>
                    ) : (
                      <Badge tone="neutral">Inactif</Badge>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/circuits/${c.id}`}
                      className="inline-flex items-center gap-1 text-sm text-terracotta-600 hover:text-terracotta-700"
                    >
                      <Pencil className="size-3.5" />
                      Modifier
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sand-700">
                  Aucun circuit. Créez-en un pour commencer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function labelForCategory(cat: string) {
  return (
    { circuit: "Circuit", excursion: "Excursion", transfert: "Transfert", sejour: "Séjour" }[cat] || cat
  );
}
