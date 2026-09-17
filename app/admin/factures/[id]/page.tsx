import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VoucherPrintButton } from "@/components/voucher-print-button";
import { formatMAD, formatDate, formatDateShort } from "@/lib/utils";
import { legalFormLine, legalIdentifiers, PAYMENT_METHOD_LABEL } from "@/lib/invoices";
import { ArrowLeft } from "lucide-react";
import type { Invoice } from "@/lib/types";

// La facture est rendue EXCLUSIVEMENT depuis ses snapshots : aucune jointure
// vers le dossier, le client ou les paramètres courants. Un changement
// ultérieur de ces données ne modifie jamais un document émis.
export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!invoice) notFound();

  const inv = invoice as Invoice;
  const company = inv.company_snapshot ?? ({} as Invoice["company_snapshot"]);
  const customer = inv.customer_snapshot ?? { full_name: "—" };
  const resa = inv.reservation_snapshot; // null sur les factures antérieures au 2026-09-17
  const payments = inv.payments_snapshot ?? [];
  const lines = inv.lines ?? [];
  const isCancelled = inv.status === "cancelled";
  const identifiers = legalIdentifiers(company);
  const formLine = legalFormLine(company);
  const balance = Number(inv.balance_at_issue_mad ?? 0);

  const companyAddress = [
    company.address_line,
    [company.postal_code, company.city].filter(Boolean).join(" "),
    company.country,
  ]
    .filter(Boolean)
    .join(", ");
  const companyContact = [company.phone, company.email, company.website].filter(Boolean).join(" · ");
  const rib = company.bank_rib || company.iban;

  const sectionLabel = "text-[10px] tracking-[1.4px] uppercase text-[#968F84] font-medium mb-1.5";
  const th = "px-3 py-2 text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A]";

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto p-8 print:p-0">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <Link href="/admin/factures" className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E]">
            <ArrowLeft className="size-4" /> Registre des factures
          </Link>
          <VoucherPrintButton className="bg-white text-[#1A1F2E] border border-[#E0DACF] hover:bg-[#FBF9F5] rounded-full px-3 text-[11px]" />
        </div>

        <div className="relative bg-white border border-[#E5E0D7] rounded-xl p-10 print:border-0 print:p-0 print:rounded-none">
          {isCancelled && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="font-display text-[110px] -rotate-12 select-none" style={{ color: "rgba(163,45,45,0.14)" }}>
                ANNULÉE
              </div>
            </div>
          )}

          {/* En-tête : émetteur + cartouche numéro */}
          <div className="flex justify-between items-start gap-6 pb-5 border-b border-[#E5E0D7] mb-5">
            <div className="min-w-0">
              <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Facture</p>
              <div className="font-display text-[26px] text-[#1A1F2E] leading-none mt-1.5">{company.commercial_name}</div>
              <p className="text-[12px] text-[#58524A] mt-1.5">
                {company.legal_name}
                {formLine && <> · {formLine}</>}
              </p>
              {companyAddress && <p className="text-[11.5px] text-[#6B6862] mt-0.5">{companyAddress}</p>}
              {companyContact && <p className="text-[11.5px] text-[#6B6862]">{companyContact}</p>}
            </div>
            <div className="shrink-0 text-right rounded-lg px-4 py-3" style={{ border: "1px solid #E5E0D7", backgroundColor: "#FBF9F5" }}>
              <div className="text-[10px] tracking-[1.4px] uppercase text-[#968F84] font-medium">N° de facture</div>
              <div className="font-mono text-[20px] text-[#1A1F2E] mt-0.5 tabular-nums">{inv.invoice_number}</div>
              <div className="text-[11.5px] text-[#58524A] mt-1">Émise le {formatDate(inv.issued_at)}</div>
              {resa && <div className="text-[11px] text-[#968F84] font-mono">Dossier {resa.reference}</div>}
            </div>
          </div>

          {/* Identifiants réglementaires (figés à l'émission) */}
          {identifiers.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#58524A] mb-6">
              {identifiers.map((it) => (
                <span key={it.label}>
                  <span className="text-[#968F84]">{it.label}</span> <span className="tabular-nums">{it.value}</span>
                </span>
              ))}
            </div>
          )}

          {/* Client + prestation */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className={sectionLabel}>Facturé à</p>
              <p className="text-[#1A1F2E] font-medium">{customer.full_name}</p>
              {customer.address_line && <p className="text-[12.5px] text-[#58524A]">{customer.address_line}</p>}
              {(customer.city || customer.country) && (
                <p className="text-[12.5px] text-[#58524A]">{[customer.city, customer.country].filter(Boolean).join(", ")}</p>
              )}
              {customer.email && <p className="text-[12.5px] text-[#58524A]">{customer.email}</p>}
              {customer.phone && <p className="text-[12.5px] text-[#58524A]">{customer.phone}</p>}
            </div>
            {resa && (
              <div>
                <p className={sectionLabel}>Prestation</p>
                <p className="text-[#1A1F2E] font-medium">{resa.circuit_title ?? "Prestation touristique"}</p>
                <p className="text-[12.5px] text-[#58524A]">Départ le {formatDate(resa.departure_date)}</p>
                <p className="text-[12.5px] text-[#58524A]">
                  {resa.adults} adulte{resa.adults > 1 ? "s" : ""}
                  {resa.children > 0 && <>, {resa.children} enfant{resa.children > 1 ? "s" : ""}</>}
                </p>
                <p className="text-[12.5px] text-[#58524A]">
                  Référence dossier <span className="font-mono">{resa.reference}</span>
                </p>
              </div>
            )}
          </div>

          {/* Lignes */}
          <table className="w-full text-[13px] border border-[#E5E0D7] mb-5">
            <thead style={{ backgroundColor: "#FBF9F5" }} className="border-b border-[#E5E0D7]">
              <tr>
                <th className={`${th} text-left`}>Désignation</th>
                <th className={`${th} text-right w-14`}>Qté</th>
                <th className={`${th} text-right w-32`}>PU HT</th>
                <th className={`${th} text-right w-32`}>Total HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EDE5]">
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-3 py-3">
                    <div className="text-[#1A1F2E]">{l.description}</div>
                    {l.details && <div className="text-[11.5px] text-[#6B6862] mt-0.5">{l.details}</div>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{l.quantity}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMAD(l.unit_price_ht_mad)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMAD(l.total_ht_mad)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totaux */}
          <div className="flex justify-end mb-6">
            <div className="w-72 text-[13px]">
              <div className="flex justify-between py-1.5 border-b border-[#F1EDE5]">
                <span className="text-[#6B6862]">Total HT</span>
                <span className="tabular-nums text-[#1A1F2E]">{formatMAD(inv.total_ht_mad)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F1EDE5]">
                <span className="text-[#6B6862]">TVA ({Math.round(Number(inv.tva_rate) * 1000) / 10} %)</span>
                <span className="tabular-nums text-[#1A1F2E]">{formatMAD(inv.tva_amount_mad)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2.5 mt-1 border-t-2 border-[#1A1F2E]">
                <span className="font-medium text-[#1A1F2E]">Total TTC</span>
                <span className="font-display text-[22px] text-[#C84B31] tabular-nums">{formatMAD(inv.total_ttc_mad)}</span>
              </div>
            </div>
          </div>

          {/* Encaissements à la date d'émission (factures émises depuis le circuit figé) */}
          {resa && (
            <div className="mb-6 print:break-inside-avoid">
              <p className={sectionLabel}>Encaissements à la date d&apos;émission</p>
              {payments.length > 0 ? (
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
                        <td className="px-3 py-2 text-right tabular-nums">{formatMAD(p.amount_mad)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[12.5px] text-[#968F84] italic">Aucun encaissement à la date d&apos;émission.</p>
              )}
              <div className="flex justify-end mt-3">
                <div className="w-72 text-[13px]">
                  <div className="flex justify-between py-1.5 border-b border-[#F1EDE5]">
                    <span className="text-[#6B6862]">Total encaissé</span>
                    <span className="tabular-nums text-[#0F6E56] font-medium">{formatMAD(inv.paid_at_issue_mad)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="font-medium text-[#1A1F2E]">Reste à payer</span>
                    <span className="tabular-nums font-medium" style={{ color: balance > 0 ? "#B25F0B" : "#0F6E56" }}>
                      {formatMAD(balance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {inv.notes && (
            <div className="mb-6">
              <p className={sectionLabel}>Notes</p>
              <p className="text-[12.5px] text-[#58524A]">{inv.notes}</p>
            </div>
          )}

          {isCancelled && (
            <div className="mb-6 rounded-lg px-3 py-2.5 text-[12.5px]" style={{ backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }}>
              <p className="font-medium">Facture annulée{inv.cancelled_at && <> le {formatDate(inv.cancelled_at)}</>}</p>
              {inv.cancellation_reason && <p className="text-[11.5px] mt-0.5">Motif : {inv.cancellation_reason}</p>}
            </div>
          )}

          {/* Pied : règlement, mentions, génération */}
          <div className="mt-8 pt-5 border-t border-[#E5E0D7] text-[11px] text-[#6B6862] space-y-2">
            {(company.bank_name || rib) && (
              <p>
                <span className="font-medium text-[#58524A]">Règlement par virement</span>
                {company.bank_name && <> · {company.bank_name}</>}
                {rib && (
                  <>
                    {" "}· RIB <span className="font-mono tabular-nums">{rib}</span>
                  </>
                )}
                {company.bank_account_holder && <> · Titulaire {company.bank_account_holder}</>}
              </p>
            )}
            <p>
              Toute somme non réglée à échéance fait l&apos;objet d&apos;une pénalité de retard conformément à la loi 32-10 relative
              aux délais de paiement.
            </p>
            <p className="text-[10px] text-[#968F84] pt-1">
              Document généré par Hiri Tours Plateforme · by Bright Strategy · facture figée à l&apos;émission, non modifiable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
