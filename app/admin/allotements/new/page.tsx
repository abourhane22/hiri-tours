import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AllotmentForm, type ContractOption, type ProductOption } from "@/components/allotment-form";
import { createAllotment } from "../actions";

export default async function NewAllotmentPage({
  searchParams,
}: {
  searchParams: Promise<{ produit?: string }>;
}) {
  const { produit } = await searchParams;
  const supabase = await createClient();

  const [{ data: productRows }, { data: contractRows }] = await Promise.all([
    supabase.from("circuits").select("id, title, max_participants").eq("is_active", true).order("title"),
    supabase
      .from("supplier_contracts")
      .select("id, label, release_days_default, suppliers(name)")
      .eq("status", "active")
      .order("label"),
  ]);

  const products = (productRows ?? []) as ProductOption[];
  const contracts: ContractOption[] = ((contractRows ?? []) as any[]).map((c) => ({
    id: c.id,
    label: c.label,
    supplierName: (Array.isArray(c.suppliers) ? c.suppliers[0] : c.suppliers)?.name ?? "Fournisseur",
    releaseDaysDefault: Number(c.release_days_default) || 0,
  }));

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const in90 = new Date(today.getTime() + 90 * 86400000);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/admin/allotements" className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4">
        <ArrowLeft className="size-4" /> Retour aux allotements
      </Link>

      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Ressources · Allotements</p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Nouvel allotement</h1>
        <p className="text-[12px] text-[#6B6862] mt-1">
          Un compteur par jour est créé à l&apos;enregistrement. Le tunnel et le backoffice décomptent les places à chaque
          réservation ; deux ventes simultanées sur la dernière place ne peuvent pas passer toutes les deux.
        </p>
      </div>

      <AllotmentForm
        mode="create"
        action={createAllotment}
        cancelHref="/admin/allotements"
        products={products}
        contracts={contracts}
        defaults={{
          productId: produit && products.some((p) => p.id === produit) ? produit : "",
          origin: "own",
          contractId: "",
          label: "",
          startsOn: iso(today),
          endsOn: iso(in90),
          quotaPerDay: "10",
          weekdays: null,
          releaseDays: "0",
          commitment: "guaranteed",
          onExhausted: "request",
          isActive: true,
          notes: "",
        }}
      />
    </div>
  );
}
