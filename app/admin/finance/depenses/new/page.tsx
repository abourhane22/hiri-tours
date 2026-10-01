import Link from "next/link";
import { randomUUID } from "crypto";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { agencyDate } from "@/lib/tz";
import { loadExpenseFormData } from "@/lib/expense-form-data";
import { ExpenseForm } from "@/components/finance/expense-form";
import type { DossierOption } from "@/app/admin/finance/depenses/actions";

// Nouvelle dépense. `?reservation=<id>` (lien « Ajouter une dépense » de la carte Marge)
// pré-remplit le rattachement Dossier et ramène sur la fiche après enregistrement.
export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ reservation?: string; back?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const data = await loadExpenseFormData(supabase);

  let dossier: DossierOption | null = null;
  if (params.reservation && /^[0-9a-f-]{36}$/i.test(params.reservation)) {
    const { data: r } = await supabase
      .from("reservations")
      .select("id, reference, status, departure_date, adults, children, circuits(title), customers(full_name)")
      .eq("id", params.reservation)
      .maybeSingle();
    if (r) {
      const row = r as any;
      const one = (v: any) => (Array.isArray(v) ? v[0] : v);
      dossier = {
        id: row.id,
        reference: row.reference,
        status: row.status,
        customer: one(row.customers)?.full_name ?? null,
        product: one(row.circuits)?.title ?? null,
        departure_date: row.departure_date,
        pax: Number(row.adults) + Number(row.children),
      };
    }
  }
  const returnTo = dossier ? `/admin/reservations/${dossier.id}` : params.back?.startsWith("/admin/finance/depenses") ? params.back : "/admin/finance/depenses";

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <Link href={returnTo} className="inline-flex h-11 items-center gap-1 text-[13px] text-[#6B6862] hover:text-[#1A1F2E]">
        <ArrowLeft className="size-4" /> {dossier ? `Retour au dossier ${dossier.reference}` : "Retour aux dépenses"}
      </Link>
      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Finance · coûts</p>
        <h1 className="font-display text-3xl tracking-[-0.02em] text-[#1A1F2E] mt-1">Nouvelle dépense</h1>
      </div>
      <ExpenseForm
        mode="create"
        returnTo={returnTo}
        {...data}
        initial={{
          id: randomUUID(),
          description: "",
          category_id: "",
          amount_mad: "",
          expense_date: agencyDate(),
          payment_method: "",
          attachment: dossier ? "dossier" : "general",
          dossier,
          circuit_id: "",
          vehicle_id: "",
          receipt_path: null,
          notes: "",
        }}
      />
    </div>
  );
}
