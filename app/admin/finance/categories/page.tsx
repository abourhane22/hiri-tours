import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge, Card, CardBody } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createCategory, toggleCategory, deleteCategory } from "./actions";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("cost_categories")
    .select("*")
    .order("type")
    .order("sort_order")
    .order("name");

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/admin/finance" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Finance
      </Link>
      <div className="mb-8">
        <p className="eyebrow mb-2">États financiers</p>
        <h1 className="font-display text-3xl text-ink">Catégories de coûts</h1>
        <p className="text-sm text-sand-700 mt-2">Coûts <strong>directs</strong> : alloués à une réservation ou un circuit pour calculer la marge. <strong>Overhead</strong> : frais généraux non alloués.</p>
      </div>

      <Card className="mb-6">
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Ajouter une catégorie</h2>
        </div>
        <CardBody>
          <form action={createCategory} className="grid sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
            <div><Label htmlFor="name">Nom *</Label><Input id="name" name="name" required placeholder="Ex: Hébergement guides" /></div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" defaultValue="direct">
                <option value="direct">Coût direct</option>
                <option value="overhead">Frais général</option>
              </Select>
            </div>
            <Button type="submit"><Plus className="size-4" />Ajouter</Button>
          </form>
        </CardBody>
      </Card>

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Nom</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Type</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">État</th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {(categories || []).map((c: any) => {
              const toggleBound = toggleCategory.bind(null, c.id, c.is_active);
              const deleteBound = deleteCategory.bind(null, c.id);
              return (
                <tr key={c.id} className="hover:bg-sand-50">
                  <td className="px-5 py-3 text-ink">{c.name}</td>
                  <td className="px-5 py-3"><Badge tone={c.type === "direct" ? "info" : "neutral"}>{c.type === "direct" ? "Direct" : "Overhead"}</Badge></td>
                  <td className="px-5 py-3"><Badge tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "Actif" : "Inactif"}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <form action={toggleBound}><Button type="submit" variant="secondary" size="sm">{c.is_active ? "Désactiver" : "Activer"}</Button></form>
                      <form action={deleteBound}><Button type="submit" variant="danger" size="sm"><Trash2 className="size-3.5" /></Button></form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
