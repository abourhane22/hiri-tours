"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { missingLegalMentions } from "@/lib/invoices";
import type {
  CompanySettings,
  InvoiceCustomerSnapshot,
  InvoiceLine,
  InvoicePaymentSnapshot,
  InvoiceReservationSnapshot,
} from "@/lib/types";

export type InvoiceActionState =
  | { ok: true; invoiceId?: string; invoiceNumber?: string; warnings?: string[] }
  | { ok: false; error: string };

const fail = (error: string): InvoiceActionState => ({ ok: false, error });

/**
 * Émet la facture d'un dossier : document FIGÉ (snapshots agence, client,
 * prestation, encaissements à date) numéroté par le trigger Postgres
 * `invoices_assign_number` (séquence continue par année, sûre en concurrence).
 * Une fois émise, rien dans l'application ne la modifie.
 */
export async function generateInvoice(
  reservationId: string,
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Session expirée — reconnectez-vous.");

  // Dossier (RLS : un non-staff obtient « introuvable »)
  const { data: reservation } = await supabase
    .from("reservations")
    .select(
      "id, reference, status, departure_date, adults, children, total_amount_mad, customer_id, " +
        "circuits(title, category, duration_days, duration_hours), " +
        "customers(id, full_name, email, phone, address_line, city, country)",
    )
    .eq("id", reservationId)
    .single();
  if (!reservation) return fail("Réservation introuvable.");
  const r = reservation as any;
  if (r.status === "cancelled") return fail("Dossier annulé — aucune facture ne peut être émise.");
  if (r.status === "pending") return fail("Le dossier doit être confirmé avant l'émission d'une facture.");

  // Une seule facture active par dossier (l'index unique partiel fait foi en cas de course).
  const { data: existing } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("reservation_id", reservationId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing) return fail(`La facture ${(existing as any).invoice_number} est déjà émise pour ce dossier.`);

  const { data: companyRow } = await supabase.from("company_settings").select("*").limit(1).single();
  if (!companyRow) return fail("Paramètres société non configurés (Paramètres › Société).");
  const company = companyRow as CompanySettings;

  const { data: paymentsRows } = await supabase
    .from("payments")
    .select("paid_at, method, amount_mad, external_ref, transaction_ref")
    .eq("reservation_id", reservationId)
    .order("paid_at", { ascending: true });

  // TVA : saisie (%) sinon taux par défaut des paramètres.
  const tvaInput = parseFloat((formData.get("tva_rate") as string) ?? "");
  const tvaRate =
    Number.isFinite(tvaInput) && tvaInput >= 0 && tvaInput <= 100
      ? tvaInput / 100
      : Number(company.tva_default_rate);

  const totalTtc = Number(r.total_amount_mad);
  const totalHt = +(totalTtc / (1 + tvaRate)).toFixed(2);
  const tvaAmount = +(totalTtc - totalHt).toFixed(2);

  const payments: InvoicePaymentSnapshot[] = ((paymentsRows ?? []) as any[]).map((p) => ({
    paid_at: p.paid_at,
    method: p.method,
    amount_mad: Number(p.amount_mad),
    ref: p.external_ref ?? p.transaction_ref ?? null,
  }));
  const paidAtIssue = +payments.reduce((s, p) => s + p.amount_mad, 0).toFixed(2);
  const balanceAtIssue = +Math.max(0, totalTtc - paidAtIssue).toFixed(2);

  const circuit = Array.isArray(r.circuits) ? r.circuits[0] : r.circuits;
  const customerRow = Array.isArray(r.customers) ? r.customers[0] : r.customers;

  const paxLabel =
    `${r.adults} adulte${r.adults > 1 ? "s" : ""}` +
    (r.children > 0 ? `, ${r.children} enfant${r.children > 1 ? "s" : ""}` : "");

  // Dossier issu de la distribution aérienne : la facture dit d'où vient le
  // montant MAD (devise, taux figé, référence) — honnêteté de la conversion.
  const { data: distRow } = await supabase
    .from("distribution_bookings")
    .select("currency, amount, fx_rate, fx_source, booking_reference")
    .eq("reservation_id", reservationId)
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const fxNote = distRow
    ? ` — ${Number((distRow as any).amount).toFixed(2)} ${(distRow as any).currency} converti au taux ${Number((distRow as any).fx_rate)} MAD (${
        (distRow as any).fx_source === "saisi" ? "taux saisi à la création" : "taux paramétré"
      })${(distRow as any).booking_reference ? ` — réf. compagnie ${(distRow as any).booking_reference}` : ""}`
    : "";

  const lines: InvoiceLine[] = [
    {
      description: circuit?.title || "Prestation touristique",
      details: `Départ le ${new Date(r.departure_date).toLocaleDateString("fr-FR")} — ${paxLabel} — dossier ${r.reference}${fxNote}`,
      quantity: 1,
      unit_price_ht_mad: totalHt,
      total_ht_mad: totalHt,
      total_ttc_mad: totalTtc,
    },
  ];

  const customerSnapshot: InvoiceCustomerSnapshot = {
    id: customerRow?.id,
    full_name: customerRow?.full_name ?? "Client",
    email: customerRow?.email ?? null,
    phone: customerRow?.phone ?? null,
    address_line: customerRow?.address_line ?? null,
    city: customerRow?.city ?? null,
    country: customerRow?.country ?? null,
  };
  const reservationSnapshot: InvoiceReservationSnapshot = {
    id: r.id,
    reference: r.reference,
    status: r.status,
    departure_date: r.departure_date,
    adults: r.adults,
    children: r.children,
    circuit_title: circuit?.title ?? null,
    circuit_category: circuit?.category ?? null,
    duration_days: circuit?.duration_days ?? null,
    duration_hours: circuit?.duration_hours ?? null,
  };

  // Pas de numéro côté application : attribué par le trigger dans la même transaction.
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      reservation_id: reservationId,
      customer_id: r.customer_id ?? customerRow?.id ?? null,
      issued_at: new Date().toISOString(),
      status: "issued",
      company_snapshot: company,
      customer_snapshot: customerSnapshot,
      reservation_snapshot: reservationSnapshot,
      payments_snapshot: payments,
      paid_at_issue_mad: paidAtIssue,
      balance_at_issue_mad: balanceAtIssue,
      lines,
      total_ht_mad: totalHt,
      tva_rate: tvaRate,
      tva_amount_mad: tvaAmount,
      total_ttc_mad: totalTtc,
      notes: ((formData.get("notes") as string) || "").trim() || null,
      created_by: user.id,
    })
    .select("id, invoice_number")
    .single();

  if (error) {
    console.error("[generateInvoice]", error);
    if (error.code === "23505") {
      return fail("Une facture vient d'être émise pour ce dossier par un autre utilisateur.");
    }
    return fail("Impossible d'émettre la facture.");
  }

  revalidatePath(`/admin/reservations/${reservationId}`);
  revalidatePath("/admin/factures");
  revalidatePath("/admin");

  return {
    ok: true,
    invoiceId: (invoice as any).id,
    invoiceNumber: (invoice as any).invoice_number,
    warnings: missingLegalMentions(company),
  };
}
