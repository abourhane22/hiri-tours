import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VoucherPrintButton } from "@/components/voucher-print-button";
import { RefundCreditNoteForm } from "@/components/credit-note-forms";
import { formatMAD, formatDate, formatDateShort } from "@/lib/utils";
import { legalFormLine, legalIdentifiers } from "@/lib/invoices";
import {
  CREDIT_NOTE_REASON_LABEL,
  CREDIT_NOTE_STATUS_LABEL,
  CREDIT_NOTE_STATUS_STYLE,
  REFUND_METHOD_LABEL,
} from "@/lib/credit-notes";
import { ArrowLeft, FileText, ArrowRight, Undo2 } from "lucide-react";
import type { CreditNote, CreditNoteMovement, RefundMethod } from "@/lib/types";

// Rendu exclusivement depuis le snapshot figé, comme la facture.
export default async function CreditNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: noteRow } = await supabase
    .from("credit_notes")
    .select("*, invoice:invoices(id, invoice_number), reservation:reservations(id, reference)")
    .eq("id", id)
    .single();
  if (!noteRow) notFound();

  const note = noteRow as unknown as CreditNote & {
    invoice: { id: string; invoice_number: string } | { id: string; invoice_number: string }[] | null;
    reservation: { id: string; reference: string } | { id: string; reference: string }[] | null;
  };
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const invoice = one(note.invoice);
  const reservation = one(note.reservation);

  const { data: movementsRows } = await supabase
    .from("credit_note_movements")
    .select("*, target:reservations(id, reference)")
    .eq("credit_note_id", id)
    .order("created_at", { ascending: true });
  const movements = (movementsRows ?? []) as unknown as (CreditNoteMovement & {
    target: { id: string; reference: string } | { id: string; reference: string }[] | null;
  })[];

  const snap = note.snapshot;
  const company = snap?.company ?? ({} as NonNullable<typeof snap>["company"]);
  const customer = snap?.customer ?? { full_name: "—" };
  const identifiers = legalIdentifiers(company);
  const formLine = legalFormLine(company);
  const remaining = Number(note.remaining_mad);
  const amount = Number(note.amount_mad);
  const used = amount - remaining;
  const st = CREDIT_NOTE_STATUS_STYLE[note.status] ?? CREDIT_NOTE_STATUS_STYLE.issued;

  const companyAddress = [company.address_line, [company.postal_code, company.city].filter(Boolean).join(" "), company.country]
    .filter(Boolean)
    .join(", ");
  const sectionLabel = "text-[10px] tracking-[1.4px] uppercase text-[#968F84] font-medium mb-1.5";
  const th = "px-3 py-2 text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A]";

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto p-8 print:p-0">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <Link href="/admin/avoirs" className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E]">
            <ArrowLeft className="size-4" /> Registre des avoirs
          </Link>
          <VoucherPrintButton className="bg-white text-[#1A1F2E] border border-[#E0DACF] hover:bg-[#FBF9F5] rounded-full px-3 text-[11px]" />
        </div>

        {/* Document imprimable */}
        <div className="bg-white border border-[#E5E0D7] rounded-xl p-10 print:border-0 print:p-0 print:rounded-none">
          <div className="flex justify-between items-start gap-6 pb-5 border-b border-[#E5E0D7] mb-5">
            <div className="min-w-0">
              <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Avoir · Note de crédit</p>
              <div className="font-display text-[26px] text-[#1A1F2E] leading-none mt-1.5">{company.commercial_name}</div>
              <p className="text-[12px] text-[#58524A] mt-1.5">
                {company.legal_name}
                {formLine && <> · {formLine}</>}
              </p>
              {companyAddress && <p className="text-[11.5px] text-[#6B6862] mt-0.5">{companyAddress}</p>}
            </div>
            <div className="shrink-0 text-right rounded-lg px-4 py-3" style={{ border: "1px solid #EF9F27", backgroundColor: "#FFF4E0" }}>
              <div className="text-[10px] tracking-[1.4px] uppercase font-medium" style={{ color: "#7A4B00" }}>
                Avoir n°
              </div>
              <div className="font-mono text-[20px] text-[#1A1F2E] mt-0.5 tabular-nums">{note.credit_note_number}</div>
              <div className="text-[11.5px] mt-1" style={{ color: "#7A4B00" }}>
                Émis le {formatDate(note.created_at)}
              </div>
            </div>
          </div>

          {identifiers.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#58524A] mb-6">
              {identifiers.map((it) => (
                <span key={it.label}>
                  <span className="text-[#968F84]">{it.label}</span> <span className="tabular-nums">{it.value}</span>
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className={sectionLabel}>Bénéficiaire</p>
              <p className="text-[#1A1F2E] font-medium">{customer.full_name}</p>
              {customer.address_line && <p className="text-[12.5px] text-[#58524A]">{customer.address_line}</p>}
              {(customer.city || customer.country) && (
                <p className="text-[12.5px] text-[#58524A]">{[customer.city, customer.country].filter(Boolean).join(", ")}</p>
              )}
              {customer.email && <p className="text-[12.5px] text-[#58524A]">{customer.email}</p>}
            </div>
            <div>
              <p className={sectionLabel}>Document d&apos;origine</p>
              <p className="text-[#1A1F2E] font-medium font-mono">{snap?.invoice_number ?? "—"}</p>
              {snap?.invoice_issued_at && (
                <p className="text-[12.5px] text-[#58524A]">Facture émise le {formatDate(snap.invoice_issued_at)}</p>
              )}
              <p className="text-[12.5px] text-[#58524A]">
                Total facturé {formatMAD(snap?.invoice_total_ttc_mad ?? 0)}
              </p>
              {snap?.reservation_reference && (
                <p className="text-[12.5px] text-[#58524A]">
                  Dossier <span className="font-mono">{snap.reservation_reference}</span>
                  {snap.circuit_title && <> · {snap.circuit_title}</>}
                </p>
              )}
            </div>
          </div>

          <table className="w-full text-[13px] border border-[#E5E0D7] mb-5">
            <thead style={{ backgroundColor: "#FBF9F5" }} className="border-b border-[#E5E0D7]">
              <tr>
                <th className={`${th} text-left`}>Motif de l&apos;avoir</th>
                <th className={`${th} text-right w-40`}>Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-3">
                  <div className="text-[#1A1F2E]">{CREDIT_NOTE_REASON_LABEL[note.reason] ?? note.reason}</div>
                  {note.reason_details && <div className="text-[11.5px] text-[#6B6862] mt-0.5">{note.reason_details}</div>}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{formatMAD(amount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mb-6">
            <div className="w-72 text-[13px]">
              <div className="flex justify-between items-baseline pt-2.5 border-t-2 border-[#1A1F2E]">
                <span className="font-medium text-[#1A1F2E]">Montant de l&apos;avoir</span>
                <span className="font-display text-[22px] text-[#C84B31] tabular-nums">{formatMAD(amount)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-[#E5E0D7] text-[11px] text-[#6B6862] space-y-2">
            <p>
              Cet avoir constitue une créance du bénéficiaire sur {company.commercial_name ?? "l'agence"}. Il est
              utilisable en règlement d&apos;une prestation future ou remboursable sur demande.
            </p>
            <p className="text-[10px] text-[#968F84] pt-1">
              Document généré par Hiri Tours Plateforme · by Bright Strategy · avoir figé à l&apos;émission, non modifiable.
            </p>
          </div>
        </div>

        {/* Gestion (hors impression) */}
        <div className="mt-6 space-y-4 print:hidden">
          <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <span className="text-[10.5px] tracking-[1.4px] uppercase text-[#968F84] font-medium">Solde de l&apos;avoir</span>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={{ backgroundColor: st.bg, color: st.color }}>
                {CREDIT_NOTE_STATUS_LABEL[note.status] ?? note.status}
              </span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[#968F84] font-medium">Émis</div>
                <div className="font-display text-[19px] text-[#1A1F2E] tabular-nums mt-0.5">{formatMAD(amount)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[#968F84] font-medium">Consommé</div>
                <div className="font-display text-[19px] text-[#58524A] tabular-nums mt-0.5">{formatMAD(used)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[#968F84] font-medium">Solde disponible</div>
                <div className="font-display text-[19px] tabular-nums mt-0.5" style={{ color: remaining > 0 ? "#B25F0B" : "#0F6E56" }}>
                  {formatMAD(remaining)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {invoice && (
                <Link
                  href={`/admin/factures/${invoice.id}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E0D7] bg-white px-3 text-[12px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors"
                >
                  <FileText className="size-3.5" /> Facture {invoice.invoice_number}
                </Link>
              )}
              {reservation && (
                <Link
                  href={`/admin/reservations/${reservation.id}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E0D7] bg-white px-3 text-[12px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors"
                >
                  Dossier {reservation.reference}
                </Link>
              )}
            </div>

            {remaining > 0 ? (
              <RefundCreditNoteForm creditNoteId={note.id} remaining={remaining} />
            ) : (
              <p className="text-[12px] text-[#6B6862]">
                Avoir entièrement soldé. Pour l&apos;utiliser sur un dossier, choisissez la méthode « Avoir » dans la carte
                Paiements du dossier concerné.
              </p>
            )}
            {remaining > 0 && (
              <p className="text-[11px] text-[#968F84] mt-2">
                Pour l&apos;imputer sur une prestation, ouvrez un dossier du même client et choisissez la méthode « Avoir »
                dans la carte Paiements.
              </p>
            )}
          </div>

          {/* Historique des mouvements */}
          <div className="bg-white border border-[#E5E0D7] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E0D7]">
              <span className="text-[10.5px] tracking-[1.4px] uppercase text-[#968F84] font-medium">
                Historique des mouvements
              </span>
            </div>
            {movements.length === 0 ? (
              <p className="text-[13px] text-[#968F84] text-center py-6">
                Aucun mouvement — l&apos;avoir est intégralement disponible.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="border-b border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
                    <tr>
                      <th className={`${th} text-left`}>Date</th>
                      <th className={`${th} text-left`}>Nature</th>
                      <th className={`${th} text-left`}>Destination</th>
                      <th className={`${th} text-left`}>Référence</th>
                      <th className={`${th} text-right`}>Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1EDE5]">
                    {movements.map((m) => {
                      const target = one(m.target);
                      const isUse = m.kind === "use";
                      return (
                        <tr key={m.id}>
                          <td className="px-3 py-2.5 tabular-nums text-[#6B6862]">{formatDateShort(m.created_at)}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={isUse ? { backgroundColor: "#E6F1FB", color: "#0C447C" } : { backgroundColor: "#E1F5EE", color: "#085041" }}
                            >
                              {isUse ? <ArrowRight className="size-3" /> : <Undo2 className="size-3" />}
                              {isUse ? "Utilisation" : "Remboursement"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {isUse ? (
                              target ? (
                                <Link href={`/admin/reservations/${target.id}`} className="font-mono text-[12px] text-[#1A1F2E] hover:text-[#C84B31]">
                                  {target.reference}
                                </Link>
                              ) : (
                                "—"
                              )
                            ) : (
                              REFUND_METHOD_LABEL[(m.method ?? "cash") as RefundMethod] ?? m.method
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11.5px] text-[#6B6862]">
                            {m.reference ?? "—"}
                            {m.notes && <span className="block font-sans text-[11px] italic">{m.notes}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium">− {formatMAD(m.amount_mad)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
