import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContractForm } from "@/components/contract-form";
import { createContract } from "../../../actions";
import type { Supplier } from "@/lib/types";

export default async function NewContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: supplierRow } = await supabase
    .from("suppliers")
    .select("id, name, default_currency")
    .eq("id", id)
    .single();
  if (!supplierRow) notFound();
  const s = supplierRow as unknown as Pick<Supplier, "id" | "name" | "default_currency">;

  const today = new Date();
  const inOneYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        href={`/admin/fournisseurs/${id}`}
        className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4"
      >
        <ArrowLeft className="size-4" /> Retour à {s.name}
      </Link>

      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Achats · Contrat</p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Nouveau contrat</h1>
        <p className="text-[12px] text-[#6B6862] mt-1">{s.name}</p>
      </div>

      <ContractForm
        mode="create"
        action={createContract.bind(null, id)}
        cancelHref={`/admin/fournisseurs/${id}`}
        defaults={{
          reference: "",
          label: "",
          validFrom: iso(today),
          validTo: iso(inOneYear),
          currency: s.default_currency ?? "MAD",
          remunerationMode: "net",
          commissionRatePct: "",
          markupRatePct: "",
          cancellationPolicy: [],
          paymentSchedule: [],
          releaseDaysDefault: "0",
          status: "draft",
          documentUrl: "",
          notes: "",
        }}
      />
    </div>
  );
}
