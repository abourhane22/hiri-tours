import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Tag, CalendarClock, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_STYLE,
  REMUNERATION_LABEL,
  describeCancellationStep,
} from "@/lib/purchasing";
import { ContractForm } from "@/components/contract-form";
import { PurchaseRatesEditor, type RateProduct } from "@/components/purchase-rates-editor";
import { updateContract } from "../../../actions";
import type { ContractStatus, PurchaseRate, Supplier, SupplierContract } from "@/lib/types";

export default async function ContractDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; contratId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id, contratId } = await params;
  const { created } = await searchParams;
  const supabase = await createClient();

  const [{ data: supplierRow }, { data: contractRow }] = await Promise.all([
    supabase.from("suppliers").select("id, name, default_currency").eq("id", id).single(),
    supabase.from("supplier_contracts").select("*").eq("id", contratId).eq("supplier_id", id).single(),
  ]);
  if (!supplierRow || !contractRow) notFound();

  const s = supplierRow as unknown as Pick<Supplier, "id" | "name" | "default_currency">;
  const c = contractRow as unknown as SupplierContract;

  const [{ data: rateRows }, { data: productRows }] = await Promise.all([
    supabase.from("purchase_rates").select("*").eq("contract_id", contratId).order("valid_from", { ascending: false }),
    supabase.from("circuits").select("id, title, base_price_mad, sale_unit").eq("is_active", true).order("title"),
  ]);
  const rates = (rateRows ?? []) as unknown as PurchaseRate[];
  const products = (productRows ?? []) as unknown as RateProduct[];

  const st = CONTRACT_STATUS_STYLE[c.status as ContractStatus] ?? CONTRACT_STATUS_STYLE.draft;
  const pct = (v: number | null) => (v === null ? null : Math.round(Number(v) * 1000) / 10);
  const cancellation = c.cancellation_policy ?? [];
  const schedule = c.payment_schedule ?? [];

  const cardLabel = "flex items-center gap-1.5 text-[10.5px] tracking-[1.4px] uppercase text-[#968F84] font-medium";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href={`/admin/fournisseurs/${id}`}
        className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4"
      >
        <ArrowLeft className="size-4" /> Retour à {s.name}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Achats · Contrat fournisseur</p>
          <div className="flex items-center gap-3 flex-wrap mt-1.5">
            <h1 className="font-display text-[26px] text-[#1A1F2E] leading-none">{c.label}</h1>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: st.bg, color: st.color }}
            >
              {CONTRACT_STATUS_LABEL[c.status as ContractStatus] ?? c.status}
            </span>
          </div>
          <p className="text-[12px] text-[#6B6862] mt-2">
            {s.name} · {formatDate(c.valid_from)} → {formatDate(c.valid_to)} · {c.currency}
            {c.reference && <> · réf. <span className="font-mono">{c.reference}</span></>}
          </p>
        </div>
        {c.document_url && (
          <a
            href={c.document_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#E5E0D7] bg-white px-3.5 text-[12.5px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors"
          >
            <FileText className="size-4" /> Contrat signé
          </a>
        )}
      </div>

      {created && (
        <div className="mb-6 rounded-lg px-3 py-2.5 text-[13px]" style={{ backgroundColor: "#E1F5EE", border: "1px solid #A9DFCC", color: "#085041" }}>
          Contrat créé. Passez-le en « Actif » pour qu&apos;il soit retenu par la résolution tarifaire, puis saisissez ses tarifs d&apos;achat.
        </div>
      )}

      {/* Conditions commerciales — lecture */}
      <div className="grid md:grid-cols-3 gap-4 mb-6 items-start">
        <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <span className={cardLabel}><Wallet className="size-3.5" /> Rémunération</span>
          <div className="font-display text-[19px] text-[#1A1F2E] mt-2">
            {REMUNERATION_LABEL[c.remuneration_mode] ?? c.remuneration_mode}
          </div>
          <div className="text-[12px] text-[#6B6862] mt-1">
            {c.remuneration_mode === "commission" && pct(c.commission_rate) !== null && <>{pct(c.commission_rate)} % reversés à l&apos;agence</>}
            {c.remuneration_mode === "markup" && pct(c.markup_rate) !== null && <>Marge de {pct(c.markup_rate)} % appliquée au coût net</>}
            {c.remuneration_mode === "net" && <>Prix de vente libre</>}
          </div>
        </div>

        <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <span className={cardLabel}><CalendarClock className="size-3.5" /> Annulation</span>
          {cancellation.length === 0 ? (
            <p className="text-[13px] text-[#968F84] italic mt-2">Aucune condition — sans frais.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-[12.5px] text-[#58524A]">
              {[...cancellation]
                .sort((a, b) => b.days_before - a.days_before)
                .map((step, i) => (
                  <li key={i}>{describeCancellationStep(step)}</li>
                ))}
            </ul>
          )}
          <p className="text-[11px] text-[#968F84] mt-2">Release par défaut : J−{c.release_days_default}</p>
        </div>

        <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <span className={cardLabel}><Tag className="size-3.5" /> Échéancier</span>
          {schedule.length === 0 ? (
            <p className="text-[13px] text-[#968F84] italic mt-2">Selon les conditions du fournisseur.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-[12.5px] text-[#58524A]">
              {schedule.map((p, i) => (
                <li key={i}>
                  <span className="font-medium">{p.pct} %</span> — {p.label}
                  {p.due && <span className="text-[#968F84]"> · {p.due}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Grille tarifaire */}
      <div className="bg-white border border-[#E5E0D7] rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={cardLabel}>Grille tarifaire d&apos;achat</span>
          <span className="text-[11px] text-[#6B6862]">
            {rates.length} tarif{rates.length > 1 ? "s" : ""}
          </span>
        </div>
        <PurchaseRatesEditor
          supplierId={id}
          contractId={contratId}
          contractCurrency={c.currency}
          rates={rates}
          products={products}
        />
      </div>

      {/* Édition du contrat */}
      <ContractForm
        mode="edit"
        action={updateContract.bind(null, id, contratId)}
        cancelHref={`/admin/fournisseurs/${id}`}
        defaults={{
          reference: c.reference ?? "",
          label: c.label,
          validFrom: c.valid_from,
          validTo: c.valid_to,
          currency: c.currency,
          remunerationMode: c.remuneration_mode,
          commissionRatePct: pct(c.commission_rate)?.toString() ?? "",
          markupRatePct: pct(c.markup_rate)?.toString() ?? "",
          cancellationPolicy: cancellation,
          paymentSchedule: schedule,
          releaseDaysDefault: String(c.release_days_default),
          status: c.status,
          documentUrl: c.document_url ?? "",
          notes: c.notes ?? "",
        }}
      />
    </div>
  );
}
