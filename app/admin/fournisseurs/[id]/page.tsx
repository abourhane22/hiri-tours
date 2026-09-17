import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, FileText, Mail, Phone, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort } from "@/lib/utils";
import {
  SUPPLIER_TYPE_LABEL,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_STYLE,
  REMUNERATION_LABEL,
} from "@/lib/purchasing";
import { SupplierForm } from "@/components/supplier-form";
import { updateSupplier } from "../actions";
import type { ContractStatus, Supplier, SupplierContract } from "@/lib/types";

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const supabase = await createClient();

  const { data: supplierRow } = await supabase.from("suppliers").select("*").eq("id", id).single();
  if (!supplierRow) notFound();
  const s = supplierRow as unknown as Supplier;

  const { data: contractRows } = await supabase
    .from("supplier_contracts")
    .select("*")
    .eq("supplier_id", id)
    .order("valid_from", { ascending: false });
  const contracts = (contractRows ?? []) as unknown as SupplierContract[];

  const updateBound = updateSupplier.bind(null, id);
  const contact = [s.phone, s.email, s.website].filter(Boolean);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        href="/admin/fournisseurs"
        className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4"
      >
        <ArrowLeft className="size-4" /> Retour aux fournisseurs
      </Link>

      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">
          Achats · {SUPPLIER_TYPE_LABEL[s.supplier_type] ?? s.supplier_type}
        </p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">{s.name}</h1>
        {contact.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#6B6862] mt-1.5">
            {s.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" />{s.phone}</span>}
            {s.email && <span className="inline-flex items-center gap-1"><Mail className="size-3.5" />{s.email}</span>}
            {s.website && <span className="inline-flex items-center gap-1"><Globe className="size-3.5" />{s.website}</span>}
          </p>
        )}
      </div>

      {created && (
        <div className="mb-6 rounded-lg px-3 py-2.5 text-[13px]" style={{ backgroundColor: "#E1F5EE", border: "1px solid #A9DFCC", color: "#085041" }}>
          Fournisseur créé. Ajoutez maintenant un contrat pour saisir ses conditions commerciales et ses tarifs d&apos;achat.
        </div>
      )}

      {/* Contrats */}
      <div className="bg-white border border-[#E5E0D7] rounded-xl mb-6">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E5E0D7]">
          <div className="flex items-center gap-1.5">
            <FileText className="size-[13px] text-[#968F84]" />
            <span className="text-[10.5px] tracking-[1.4px] uppercase text-[#968F84] font-medium">
              Contrats ({contracts.length})
            </span>
          </div>
          <Link
            href={`/admin/fournisseurs/${id}/contrats/new`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[12px] font-medium text-white hover:bg-[#2A3142] transition-colors"
          >
            <Plus className="size-3.5" /> Nouveau contrat
          </Link>
        </div>

        {contracts.length === 0 ? (
          <p className="text-[13px] text-[#968F84] text-center py-8">
            Aucun contrat. Les tarifs d&apos;achat et les allotements se rattachent à un contrat.
          </p>
        ) : (
          <div className="divide-y divide-[#F1EDE5]">
            {contracts.map((c) => {
              const st = CONTRACT_STATUS_STYLE[c.status as ContractStatus] ?? CONTRACT_STATUS_STYLE.draft;
              return (
                <Link
                  key={c.id}
                  href={`/admin/fournisseurs/${id}/contrats/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[#FBF9F5] transition-colors"
                >
                  <span className="min-w-0">
                    <span className="text-[14px] text-[#1A1F2E] font-medium">{c.label}</span>
                    {c.reference && <span className="text-[12px] text-[#968F84] font-mono"> · {c.reference}</span>}
                    <span className="block text-[11.5px] text-[#6B6862] mt-0.5">
                      {formatDateShort(c.valid_from)} → {formatDateShort(c.valid_to)} ·{" "}
                      {REMUNERATION_LABEL[c.remuneration_mode] ?? c.remuneration_mode}
                      {c.remuneration_mode === "commission" && c.commission_rate !== null && (
                        <> {Math.round(Number(c.commission_rate) * 1000) / 10} %</>
                      )}
                      {c.remuneration_mode === "markup" && c.markup_rate !== null && (
                        <> {Math.round(Number(c.markup_rate) * 1000) / 10} %</>
                      )}
                      {" · "}{c.currency}
                    </span>
                  </span>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
                    style={{ backgroundColor: st.bg, color: st.color }}
                  >
                    {CONTRACT_STATUS_LABEL[c.status as ContractStatus] ?? c.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Fiche éditable */}
      <SupplierForm
        mode="edit"
        action={updateBound}
        cancelHref="/admin/fournisseurs"
        defaults={{
          name: s.name,
          legalName: s.legal_name ?? "",
          supplierType: s.supplier_type,
          ice: s.ice ?? "",
          ifNumber: s.if_number ?? "",
          rc: s.rc ?? "",
          addressLine: s.address_line ?? "",
          city: s.city ?? "",
          country: s.country ?? "Maroc",
          phone: s.phone ?? "",
          email: s.email ?? "",
          website: s.website ?? "",
          contacts: s.contacts ?? [],
          paymentTerms: s.payment_terms,
          defaultCurrency: s.default_currency,
          isActive: s.is_active,
          notes: s.notes ?? "",
        }}
      />
    </div>
  );
}
