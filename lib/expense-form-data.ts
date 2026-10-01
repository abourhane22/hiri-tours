// Données de référence du formulaire de dépense (serveur) : catégories, produits et
// véhicules actifs — plus l'élément déjà rattaché en modification, même inactif.

import type { SupabaseClient } from "@supabase/supabase-js";
import { vehicleLabel } from "@/lib/expenses-query";
import type { ExpenseCategoryOption, ExpenseOption } from "@/components/finance/expense-form";

export async function loadExpenseFormData(
  supabase: SupabaseClient,
  keep: { categoryId?: string | null; circuitId?: string | null; vehicleId?: string | null } = {},
): Promise<{ categories: ExpenseCategoryOption[]; circuits: ExpenseOption[]; vehicles: ExpenseOption[] }> {
  const [catRes, circRes, vehRes] = await Promise.all([
    supabase.from("cost_categories").select("id, name, type, description, is_active, sort_order").order("type").order("sort_order"),
    supabase.from("circuits").select("id, title, is_active").order("title"),
    supabase.from("vehicles").select("id, registration, make, model, is_active").order("registration"),
  ]);
  const categories = ((catRes.data ?? []) as any[])
    .filter((c) => c.is_active || c.id === keep.categoryId)
    .map((c) => ({ id: c.id, name: c.name, type: c.type, description: c.description ?? null }));
  const circuits = ((circRes.data ?? []) as any[])
    .filter((c) => c.is_active || c.id === keep.circuitId)
    .map((c) => ({ id: c.id, label: c.is_active ? c.title : `${c.title} (inactif)` }));
  const vehicles = ((vehRes.data ?? []) as any[])
    .filter((v) => v.is_active || v.id === keep.vehicleId)
    .map((v) => ({ id: v.id, label: vehicleLabel(v) }));
  return { categories, circuits, vehicles };
}
