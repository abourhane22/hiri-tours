import Link from "next/link";
import { SubmitButton } from "@/components/ui/submit-button";
import { ExpenseTabs } from "@/components/report-tabs";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_META } from "@/lib/category-fields";
import type { CircuitCategory } from "@/lib/types";

const PRODUCT_TYPES: CircuitCategory[] = ["circuit", "excursion", "transfert", "sejour", "hebergement", "billetterie", "prestation"];
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge, Card, CardBody } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createCategory, toggleCategory, deleteCategory, updateCategory } from "./actions";

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
      <div className="mb-6">
        <p className="eyebrow mb-2">Finance · Dépenses</p>
        <h1 className="font-display text-3xl text-ink">Catégories de coûts</h1>
        <p className="text-sm text-sand-700 mt-2">Coûts <strong>directs</strong> : alloués à une réservation ou un circuit pour calculer la marge. <strong>Overhead</strong> : frais généraux non alloués.</p>
      </div>

      <ExpenseTabs active="categories" />

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
            <SubmitButton><Plus className="size-4" />Ajouter</SubmitButton>
            <div className="sm:col-span-3">
              <Label htmlFor="description">Description (aide affichée sous le champ Catégorie)</Label>
              <Input id="description" name="description" placeholder="Ce que couvre cette catégorie, avec un ou deux exemples" />
            </div>
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
                  <td className="px-5 py-3 text-ink align-top">
                    <details>
                      <summary className="cursor-pointer list-none">
                        <span className="font-medium">{c.name}</span>
                        <span className="block text-xs text-sand-700 mt-0.5">{c.description || <em>Sans description</em>}</span>
                        {Array.isArray(c.main_cost_for) && c.main_cost_for.length > 0 && (
                          <span className="mt-1 block text-[11px] text-[#0C6B8A]">
                            Coût fournisseur principal : {c.main_cost_for.map((t: string) => CATEGORY_META[t as CircuitCategory]?.label ?? t).join(", ")}
                          </span>
                        )}
                        <span className="mt-1 inline-block text-xs font-medium text-[#0C6B8A] hover:underline">Modifier le nom et la description</span>
                      </summary>
                      <form action={updateCategory.bind(null, c.id)} className="mt-3 space-y-2">
                        <div><Label htmlFor={`name-${c.id}`}>Nom *</Label><Input id={`name-${c.id}`} name="name" required defaultValue={c.name} /></div>
                        <div>
                          <Label htmlFor={`desc-${c.id}`}>Description</Label>
                          <textarea id={`desc-${c.id}`} name="description" rows={3} defaultValue={c.description ?? ""} className="w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-navy-500" />
                        </div>
                        <fieldset>
                          <legend className="text-xs font-medium text-sand-800">Coût fournisseur principal pour…</legend>
                          <p className="text-[11px] text-sand-700">Une dépense de cette catégorie rend la marge réelle d&apos;un dossier de ce type définitive.</p>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                            {PRODUCT_TYPES.map((t) => (
                              <label key={t} className="inline-flex min-h-[32px] items-center gap-1.5 text-xs text-ink">
                                <input type="checkbox" name="main_cost_for" value={t} defaultChecked={Array.isArray(c.main_cost_for) && c.main_cost_for.includes(t)} className="size-4" />
                                {CATEGORY_META[t].label}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <SubmitButton size="sm">Enregistrer</SubmitButton>
                      </form>
                    </details>
                  </td>
                  <td className="px-5 py-3"><Badge tone={c.type === "direct" ? "info" : "neutral"}>{c.type === "direct" ? "Direct" : "Overhead"}</Badge></td>
                  <td className="px-5 py-3"><Badge tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "Actif" : "Inactif"}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <form action={toggleBound}><SubmitButton variant="secondary" size="sm" pendingLabel="…">{c.is_active ? "Désactiver" : "Activer"}</SubmitButton></form>
                      <form action={deleteBound}><SubmitButton variant="danger" size="sm" pendingLabel="Suppression…"><Trash2 className="size-3.5" /></SubmitButton></form>
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
