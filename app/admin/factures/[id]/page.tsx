import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { VoucherPrintButton } from "@/components/voucher-print-button";
import { formatMAD, formatDate } from "@/lib/utils";
import { ArrowLeft, Ban } from "lucide-react";
import { cancelInvoice } from "../actions";
import type { Invoice, InvoiceLine, CompanySettings } from "@/lib/types";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!invoice) notFound();

  const inv = invoice as Invoice;
  const company = inv.company_snapshot as CompanySettings;
  const customer = inv.customer_snapshot as any;
  const lines = inv.lines as InvoiceLine[];
  const isCancelled = inv.status === "cancelled";
  const cancelBound = cancelInvoice.bind(null, id);

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto p-8 print:p-0">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <Link href="/admin/factures" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink">
            <ArrowLeft className="size-4" /> Liste des factures
          </Link>
          <VoucherPrintButton />
        </div>

        <div className="bg-white border border-sand-200 rounded-lg p-10 print:border-0 print:p-0 print:rounded-none relative">
          {isCancelled && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-red-200 font-display text-[120px] -rotate-12 select-none print:text-red-300">ANNULÉE</div>
            </div>
          )}

          <div className="flex justify-between items-start pb-6 border-b border-sand-200 mb-6">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl text-navy-700">{company.commercial_name}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta-600 font-medium">Facture</span>
              </div>
              <p className="text-xs text-sand-700 mt-1">{company.legal_name}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-sand-600 uppercase tracking-wide">N° de facture</div>
              <div className="font-mono text-lg text-ink">{inv.invoice_number}</div>
              <div className="text-xs text-sand-700 mt-1">Émise le {formatDate(inv.issued_at)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium mb-2">Émetteur</p>
              <p className="text-ink font-medium">{company.legal_name}</p>
              {company.address_line && <p className="text-sm text-sand-800">{company.address_line}</p>}
              <p className="text-sm text-sand-800">{[company.postal_code, company.city].filter(Boolean).join(" ")} · {company.country}</p>
              {company.phone && <p className="text-sm text-sand-800">{company.phone}</p>}
              {company.email && <p className="text-sm text-sand-800">{company.email}</p>}
            </div>
            <div>
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium mb-2">Destinataire</p>
              <p className="text-ink font-medium">{customer?.full_name ?? "—"}</p>
              {customer?.address_line && <p className="text-sm text-sand-800">{customer.address_line}</p>}
              {(customer?.city || customer?.country) && <p className="text-sm text-sand-800">{[customer.city, customer.country].filter(Boolean).join(", ")}</p>}
              {customer?.email && <p className="text-sm text-sand-800">{customer.email}</p>}
              {customer?.phone && <p className="text-sm text-sand-800">{customer.phone}</p>}
            </div>
          </div>

          <table className="w-full text-sm border border-sand-200 mb-6">
            <thead className="bg-sand-100 border-b border-sand-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-sand-800 border-r border-sand-200">Désignation</th>
                <th className="text-right px-3 py-2 font-medium text-sand-800 border-r border-sand-200 w-16">Qté</th>
                <th className="text-right px-3 py-2 font-medium text-sand-800 border-r border-sand-200 w-32">PU HT</th>
                <th className="text-right px-3 py-2 font-medium text-sand-800 w-32">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-sand-200 last:border-b-0">
                  <td className="px-3 py-3 border-r border-sand-200">
                    <div className="text-ink">{l.description}</div>
                    {l.details && <div className="text-xs text-sand-600 mt-0.5">{l.details}</div>}
                  </td>
                  <td className="px-3 py-3 border-r border-sand-200 text-right tabular-nums">{l.quantity}</td>
                  <td className="px-3 py-3 border-r border-sand-200 text-right tabular-nums">{formatMAD(l.unit_price_ht_mad)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMAD(l.total_ht_mad)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-6">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between border-b border-sand-200 pb-2">
                <span className="text-sand-700">Total HT</span>
                <span className="tabular-nums text-ink">{formatMAD(inv.total_ht_mad)}</span>
              </div>
              <div className="flex justify-between border-b border-sand-200 pb-2">
                <span className="text-sand-700">TVA ({Math.round(Number(inv.tva_rate) * 100)}%)</span>
                <span className="tabular-nums text-ink">{formatMAD(inv.tva_amount_mad)}</span>
              </div>
              <div className="flex justify-between bg-sand-50 -mx-3 px-3 py-2 print:bg-transparent print:border-t-2 print:border-sand-700">
                <span className="font-medium text-ink">Total TTC</span>
                <span className="tabular-nums font-display text-xl text-terracotta-600">{formatMAD(inv.total_ttc_mad)}</span>
              </div>
            </div>
          </div>

          {inv.notes && (
            <div className="mb-6">
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium mb-1">Notes</p>
              <p className="text-sm text-sand-800">{inv.notes}</p>
            </div>
          )}

          {isCancelled && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900">
              <p className="font-medium">Facture annulée le {formatDate(inv.cancelled_at!)}</p>
              {inv.cancellation_reason && <p className="text-xs mt-1">Motif : {inv.cancellation_reason}</p>}
            </div>
          )}

          <div className="mt-10 pt-6 border-t border-sand-200 text-xs text-sand-700 space-y-2">
            <p><strong>Mentions légales</strong></p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {company.ice && <p>ICE : {company.ice}</p>}
              {company.rc && <p>RC : {company.rc}</p>}
              {company.if_number && <p>IF : {company.if_number}</p>}
              {company.patente && <p>Patente : {company.patente}</p>}
              {company.cnss && <p>CNSS : {company.cnss}</p>}
              {company.bank_name && <p>Banque : {company.bank_name}</p>}
              {company.iban && <p className="col-span-2">IBAN : <span className="font-mono">{company.iban}</span></p>}
            </div>
            <p className="pt-2">Toute somme non réglée à échéance fait l&apos;objet d&apos;une pénalité de retard conformément à la loi 32-10 marocaine.</p>
          </div>
        </div>

        {!isCancelled && (
          <div className="mt-6 print:hidden">
            <Card className="border-red-200">
              <div className="px-5 py-4 border-b border-red-200 bg-red-50">
                <h2 className="font-display text-lg text-red-900">Annulation de facture</h2>
              </div>
              <CardBody>
                <p className="text-sm text-sand-800 mb-3">L&apos;annulation marque la facture comme nulle. Le numéro reste réservé pour la traçabilité légale. Une nouvelle facture peut ensuite être émise pour cette réservation.</p>
                <form action={cancelBound} className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label htmlFor="reason">Motif d&apos;annulation</Label>
                    <Input id="reason" name="reason" placeholder="Erreur de saisie, etc." />
                  </div>
                  <Button type="submit" variant="danger" size="sm"><Ban className="size-3.5" />Annuler la facture</Button>
                </form>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
