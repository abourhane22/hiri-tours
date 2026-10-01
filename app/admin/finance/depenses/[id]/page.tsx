import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMAD, formatDate } from "@/lib/utils";
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
  const returnTo = back?.startsWith("/admin/finance/depenses") ? back : "/admin/finance/depenses";

  // Dépense automatique (billet de l'ordre de distribution) : lecture seule.
  if (e.source === "distribution") {
    const { data: cat } = await supabase.from("cost_categories").select("name").eq("id", e.category_id).maybeSingle();
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        <Link href={returnTo} className="inline-flex h-11 items-center gap-1 text-[13px] text-[#6B6862] hover:text-[#1A1F2E]">
          <ArrowLeft className="size-4" /> Retour aux dépenses
        </Link>
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Finance · coûts</p>
        <h1 className="font-display text-3xl tracking-[-0.02em] text-[#1A1F2E] mt-1">{e.description}</h1>
        <div className="mt-5 rounded-xl border border-[#E5E0D7] bg-white p-5 space-y-3 text-[13.5px]">
          <p className="rounded-lg px-3 py-2 text-[12.5px]" style={{ backgroundColor: "#E3F0F4", color: "#0C6B8A" }}>
            Dépense automatique : coût réel du billet, enregistré à l&apos;émission de l&apos;ordre (montant de l&apos;ordre × taux figé, moins le
            remboursement en cas d&apos;annulation). Elle n&apos;est ni modifiable ni supprimable à la main.
          </p>
          <dl className="grid grid-cols-[160px_1fr] gap-y-2">
            <dt className="text-[#6B6862]">Montant</dt>
            <dd className="font-medium tabular-nums text-[#1A1F2E]">{formatMAD(e.amount_mad)}</dd>
            <dt className="text-[#6B6862]">Date</dt>
            <dd>{formatDate(e.expense_date)}</dd>
            <dt className="text-[#6B6862]">Catégorie</dt>
            <dd>{(cat as { name: string } | null)?.name ?? "—"}</dd>
            <dt className="text-[#6B6862]">Dossier</dt>
            <dd>
              {resa ? (
                <Link href={`/admin/reservations/${resa.id}`} className="font-mono text-[#0C6B8A] hover:underline">{resa.reference}</Link>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-[#6B6862]">Détail</dt>
            <dd className="text-[#58524A]">{e.notes ?? "—"}</dd>
          </dl>
        </div>
      </div>
    );
  }

  const data = await loadExpenseFormData(supabase, { categoryId: e.category_id, circuitId: e.circuit_id, vehicleId: e.vehicle_id });

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
