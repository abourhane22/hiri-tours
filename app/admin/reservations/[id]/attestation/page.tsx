import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMAD, formatDateShort } from "@/lib/utils";
import { VoucherPrintButton } from "@/components/voucher-print-button";
import { legalFormLine, legalIdentifiers, PAYMENT_METHOD_LABEL } from "@/lib/invoices";
import { ArrowLeft } from "lucide-react";
import type { CompanySettings } from "@/lib/types";

// Attestation de paiement du dossier : TOUS les règlements, reste à payer nul.
// Document daté du jour de sa génération (pas de numérotation, pas de snapshot) —
// il ne se substitue pas à la facture, qui reste figée à son émission.
export default async function AttestationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, reference, status, departure_date, adults, children, total_amount_mad, paid_amount_mad, circuits(title), customers(full_name, email, phone, address_line, city, country)")
    .eq("id", id)
    .single();
  if (!reservation) notFound();
  const r = reservation as any;
  const circuit = Array.isArray(r.circuits) ? r.circuits[0] : r.circuits;
  const customer = Array.isArray(r.customers) ? r.customers[0] : r.customers;

  const [{ data: paymentRows }, { data: companyRow }, { data: invoiceRow }] = await Promise.all([
    supabase
      .from("payments")
      .select("paid_at, method, amount_mad, external_ref, transaction_ref")
      .eq("reservation_id", id)
      .order("paid_at", { ascending: true }),
    supabase.from("company_settings").select("*").limit(1).maybeSingle(),
    supabase.from("invoices").select("invoice_number").eq("reservation_id", id).neq("status", "cancelled").maybeSingle(),
  ]);
  const payments = ((paymentRows ?? []) as any[]).map((p) => ({
    paid_at: p.paid_at as string,
    method: p.method as string,
    amount: Number(p.amount_mad),
    ref: (p.external_ref ?? p.transaction_ref ?? null) as string | null,
  }));
  const company = (companyRow ?? {}) as Partial<CompanySettings>;
  const total = Number(r.total_amount_mad);
  const paid = Number(r.paid_amount_mad);
  const balance = Math.max(0, total - paid);
  const settled = total > 0 && total - paid <= 0.01;
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const lastPayment = payments.length > 0 ? payments[payments.length - 1].paid_at : null;

  const identifiers = legalIdentifiers(company);
  const formLine = legalFormLine(company);
  const companyAddress = [company.address_line, [company.postal_code, company.city].filter(Boolean).join(" "), company.country]
    .filter(Boolean)
    .join(", ");
  const paxLabel = `${r.adults} adulte${r.adults > 1 ? "s" : ""}${r.children > 0 ? `, ${r.children} enfant${r.children > 1 ? "s" : ""}` : ""}`;
  const th = "px-3 py-2 text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A]";

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto p-8 print:p-0">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <Link href={`/admin/reservations/${id}`} className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E]">
            <ArrowLeft className="size-4" /> Dossier {r.reference}
          </Link>
          {settled && <VoucherPrintButton className="bg-white text-[#1A1F2E] border border-[#E0DACF] hover:bg-[#FBF9F5] rounded-full px-3 text-[11px]" />}
        </div>

        {!settled || r.status === "cancelled" ? (
          <div className="rounded-xl border border-[#E5E0D7] p-8 text-center">
            <p className="font-display text-xl text-[#1A1F2E]">Attestation indisponible</p>
            <p className="text-[13px] text-[#6B6862] mt-2">
              {r.status === "cancelled"
                ? "Dossier annulé — aucune attestation de paiement n'est délivrée."
                : `L'attestation est disponible une fois le dossier soldé. Reste à payer : ${formatMAD(balance)}.`}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#E5E0D7] rounded-xl p-10 print:border-0 print:p-0 print:rounded-none">
            {/* Émetteur */}
            <div className="flex justify-between items-start pb-6 border-b border-[#E5E0D7] mb-6">
              <div>
                <p className="font-display text-2xl text-[#1A1F2E]">{company.commercial_name || company.legal_name || "Hiri Tours"}</p>
                {company.legal_name && company.legal_name !== company.commercial_name && (
                  <p className="text-[12px] text-[#58524A]">{company.legal_name}</p>
                )}
                {formLine && <p className="text-[11.5px] text-[#6B6862]">{formLine}</p>}
                {companyAddress && <p className="text-[11.5px] text-[#6B6862]">{companyAddress}</p>}
                {identifiers.length > 0 && (
                  <p className="text-[10.5px] text-[#968F84] mt-1">{identifiers.map((x) => `${x.label} ${x.value}`).join(" · ")}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#C84B31] font-medium">Attestation de paiement</p>
                <p className="text-[12px] text-[#6B6862] mt-1">Dossier <span className="font-mono">{r.reference}</span></p>
                <p className="text-[12px] text-[#6B6862]">Établie le {today}</p>
              </div>
            </div>

            <p className="text-[13.5px] leading-relaxed text-[#1A1F2E] mb-6">
              Nous soussignés, {company.legal_name || company.commercial_name || "Hiri Tours"}, attestons avoir reçu de{" "}
              <span className="font-medium">{customer?.full_name ?? "—"}</span> le règlement intégral de la somme de{" "}
              <span className="font-medium">{formatMAD(total)}</span> au titre du dossier{" "}
              <span className="font-mono">{r.reference}</span>
              {circuit?.title ? <> — {circuit.title}</> : null}, départ le {formatDateShort(r.departure_date)} ({paxLabel})
              {invoiceRow ? <>, facture {(invoiceRow as any).invoice_number}</> : null}. Le dossier est soldé
              {lastPayment ? <> depuis le {formatDateShort(lastPayment)}</> : null}.
            </p>

            <p className="text-[10px] tracking-[1.4px] uppercase text-[#968F84] font-medium mb-1.5">Règlements reçus</p>
            <table className="w-full text-[12.5px] border border-[#E5E0D7]">
              <thead style={{ backgroundColor: "#FBF9F5" }} className="border-b border-[#E5E0D7]">
                <tr>
                  <th className={`${th} text-left`}>Date</th>
                  <th className={`${th} text-left`}>Mode</th>
                  <th className={`${th} text-left`}>Référence</th>
                  <th className={`${th} text-right w-32`}>Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {payments.map((p, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 tabular-nums">{formatDateShort(p.paid_at)}</td>
                    <td className="px-3 py-2">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</td>
                    <td className="px-3 py-2 font-mono text-[11.5px] text-[#6B6862]">{p.ref ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMAD(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-3">
              <div className="w-72 text-[13px]">
                <div className="flex justify-between py-1.5 border-b border-[#F1EDE5]">
                  <span className="text-[#6B6862]">Montant du dossier</span>
                  <span className="tabular-nums">{formatMAD(total)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F1EDE5]">
                  <span className="text-[#6B6862]">Total réglé</span>
                  <span className="tabular-nums text-[#0F6E56] font-medium">{formatMAD(paid)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-medium text-[#1A1F2E]">Reste à payer</span>
                  <span className="tabular-nums font-medium text-[#0F6E56]">{formatMAD(0)}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#968F84] mt-10">
              Attestation délivrée pour servir et valoir ce que de droit. Elle ne remplace pas la facture.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
