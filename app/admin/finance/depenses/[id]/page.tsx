import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadExpenseFormData } from "@/lib/expense-form-data";
import { attachmentOf } from "@/lib/expenses";
import { ExpenseForm } from "@/components/finance/expense-form";
import { QueryErrorPanel, isNoRowError } from "@/components/query-error";

// Modification d'une dépense — même formulaire que la création. Un dossier annulé déjà
// rattaché reste affiché (et accepté tant qu'il n'est pas changé).
export default async function EditExpensePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ back?: string }> }) {
  const { id } = await params;
  const { back } = await searchParams;
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("expenses")
    .select("*, reservation:reservations(id, reference, status, departure_date, adults, children, circuits(title), customers(full_name))")
    .eq("id", id)
    .maybeSingle();
  if (error && !isNoRowError(error)) {
    console.error(`[dépense ${id}] chargement :`, error);
    return <QueryErrorPanel title="Impossible de charger la dépense" error={error} />;
  }
  if (!row) notFound();
  const e = row as any;
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const resa = one(e.reservation);
  const data = await loadExpenseFormData(supabase, { categoryId: e.category_id, circuitId: e.circuit_id, vehicleId: e.vehicle_id });
  const returnTo = back?.startsWith("/admin/finance/depenses") ? back : "/admin/finance/depenses";

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <Link href={returnTo} className="inline-flex h-11 items-center gap-1 text-[13px] text-[#6B6862] hover:text-[#1A1F2E]">
        <ArrowLeft className="size-4" /> Retour aux dépenses
      </Link>
      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Finance · coûts</p>
        <h1 className="font-display text-3xl tracking-[-0.02em] text-[#1A1F2E] mt-1">Modifier la dépense</h1>
      </div>
      <ExpenseForm
        mode="edit"
        returnTo={returnTo}
        {...data}
        initial={{
          id: e.id,
          description: e.description ?? "",
          category_id: e.category_id,
          amount_mad: String(Number(e.amount_mad)),
          expense_date: e.expense_date,
          payment_method: e.payment_method ?? "",
          attachment: attachmentOf(e),
          dossier: resa
            ? {
                id: resa.id,
                reference: resa.reference,
                status: resa.status,
                customer: one(resa.customers)?.full_name ?? null,
                product: one(resa.circuits)?.title ?? null,
                departure_date: resa.departure_date,
                pax: Number(resa.adults) + Number(resa.children),
              }
            : null,
          circuit_id: e.circuit_id ?? "",
          vehicle_id: e.vehicle_id ?? "",
          receipt_path: e.receipt_path ?? null,
          notes: e.notes ?? "",
        }}
      />
    </div>
  );
}
