"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isCreditNoteReason, isRefundMethod } from "@/lib/credit-notes";
import type { CompanySettings, CreditNoteSnapshot, Invoice } from "@/lib/types";

export type CreditNoteActionState =
  | { ok: true; creditNoteId?: string; creditNoteNumber?: string; savedAt?: number }
  | { ok: false; error: string };

const fail = (error: string): CreditNoteActionState => ({ ok: false, error });

/**
 * Les fonctions plpgsql portent la transaction et re-vérifient tous les soldes
 * (verrou FOR UPDATE). Leurs `raise exception` remontent ici en message métier :
 * on les affiche telles quelles, elles sont rédigées pour l'utilisateur.
 */
function rpcError(error: { message?: string }, fallback: string): string {
  const raw = (error.message ?? "").trim();
  if (!raw) return fallback;
  // PostgREST préfixe parfois le message ; on garde la phrase métier finale.
  const cleaned = raw.replace(/^.*?(?:exception|error):\s*/i, "").trim();
  return cleaned || fallback;
}

function revalidateAll(paths: string[]) {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/admin/factures");
  revalidatePath("/admin");
}

/** Émission d'un avoir sur une facture (montant ≤ TTC − avoirs déjà émis). */
export async function issueCreditNote(
  invoiceId: string,
  _prev: CreditNoteActionState,
  formData: FormData,
): Promise<CreditNoteActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Session expirée — reconnectez-vous.");

  const amount = parseFloat((formData.get("amount_mad") as string) ?? "");
  const reason = ((formData.get("reason") as string) || "").trim();
  const details = ((formData.get("reason_details") as string) || "").trim();

  if (!Number.isFinite(amount) || amount <= 0) return fail("Le montant de l'avoir doit être supérieur à 0.");
  if (!isCreditNoteReason(reason)) return fail("Le motif de l'avoir est obligatoire.");

  const { data: invoiceRow } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (!invoiceRow) return fail("Facture introuvable.");
  const inv = invoiceRow as Invoice;
  if (inv.status === "cancelled") return fail("Cette facture est déjà annulée.");

  const { data: companyRow } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
  const resa = inv.reservation_snapshot;

  // Document figé : l'avoir ne dépendra jamais d'une donnée modifiée plus tard.
  const snapshot: CreditNoteSnapshot = {
    invoice_number: inv.invoice_number,
    invoice_issued_at: inv.issued_at,
    invoice_total_ttc_mad: Number(inv.total_ttc_mad),
    reservation_reference: resa?.reference ?? "—",
    reservation_departure_date: resa?.departure_date ?? null,
    circuit_title: resa?.circuit_title ?? null,
    customer: inv.customer_snapshot,
    company: (companyRow as CompanySettings) ?? inv.company_snapshot,
    amount_mad: amount,
    reason: reason,
    reason_details: details || null,
  };

  const { data, error } = await supabase.rpc("issue_credit_note", {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_reason: reason,
    p_reason_details: details || null,
    p_snapshot: snapshot,
  });

  if (error) {
    console.error("[issueCreditNote]", error);
    return fail(rpcError(error, "Impossible d'émettre l'avoir."));
  }

  const note = (Array.isArray(data) ? data[0] : data) as { id: string; credit_note_number: string } | null;
  revalidateAll([
    `/admin/factures/${invoiceId}`,
    `/admin/reservations/${inv.reservation_id}`,
    "/admin/avoirs",
  ]);

  return { ok: true, creditNoteId: note?.id, creditNoteNumber: note?.credit_note_number, savedAt: Date.now() };
}

/**
 * Régularisation d'un dossier annulé encaissé mais jamais facturé : émet la
 * facture (seul cas autorisé sur un dossier annulé) puis l'avoir total, pour
 * que le client encaissé ne reste pas sans document de crédit.
 */
export async function regularizeCancelledReservation(
  reservationId: string,
  _prev: CreditNoteActionState,
  formData: FormData,
): Promise<CreditNoteActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Session expirée — reconnectez-vous.");

  const { data: reservation } = await supabase
    .from("reservations")
    .select(
      "id, reference, status, departure_date, adults, children, total_amount_mad, paid_amount_mad, customer_id, " +
        "circuits(title, category, duration_days, duration_hours), " +
        "customers(id, full_name, email, phone, address_line, city, country)",
    )
    .eq("id", reservationId)
    .single();
  if (!reservation) return fail("Réservation introuvable.");
  const r = reservation as any;
  if (r.status !== "cancelled") return fail("Ce dossier n'est pas annulé — utilisez l'émission de facture normale.");

  const paid = Number(r.paid_amount_mad);
  if (paid <= 0) return fail("Aucun encaissement à régulariser sur ce dossier.");

  const { data: existing } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("reservation_id", reservationId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing) return fail(`La facture ${(existing as any).invoice_number} existe déjà — émettez l'avoir depuis celle-ci.`);

  const { data: companyRow } = await supabase.from("company_settings").select("*").limit(1).single();
  if (!companyRow) return fail("Paramètres société non configurés (Paramètres › Société).");
  const company = companyRow as CompanySettings;

  const { data: paymentsRows } = await supabase
    .from("payments")
    .select("paid_at, method, amount_mad, external_ref, transaction_ref")
    .eq("reservation_id", reservationId)
    .order("paid_at", { ascending: true });

  // La facture de régularisation porte le montant réellement encaissé.
  const tvaRate = Number(company.tva_default_rate);
  const totalTtc = paid;
  const totalHt = +(totalTtc / (1 + tvaRate)).toFixed(2);
  const tvaAmount = +(totalTtc - totalHt).toFixed(2);

  const circuit = Array.isArray(r.circuits) ? r.circuits[0] : r.circuits;
  const customerRow = Array.isArray(r.customers) ? r.customers[0] : r.customers;
  const payments = ((paymentsRows ?? []) as any[]).map((p) => ({
    paid_at: p.paid_at,
    method: p.method,
    amount_mad: Number(p.amount_mad),
    ref: p.external_ref ?? p.transaction_ref ?? null,
  }));

  const customerSnapshot = {
    id: customerRow?.id,
    full_name: customerRow?.full_name ?? "Client",
    email: customerRow?.email ?? null,
    phone: customerRow?.phone ?? null,
    address_line: customerRow?.address_line ?? null,
    city: customerRow?.city ?? null,
    country: customerRow?.country ?? null,
  };
  const reservationSnapshot = {
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

  const { data: invoice, error: invErr } = await supabase
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
      paid_at_issue_mad: paid,
      balance_at_issue_mad: 0,
      lines: [
        {
          description: circuit?.title || "Prestation touristique",
          details: `Dossier ${r.reference} annulé — régularisation des sommes encaissées`,
          quantity: 1,
          unit_price_ht_mad: totalHt,
          total_ht_mad: totalHt,
          total_ttc_mad: totalTtc,
        },
      ],
      total_ht_mad: totalHt,
      tva_rate: tvaRate,
      tva_amount_mad: tvaAmount,
      total_ttc_mad: totalTtc,
      notes: "Facture de régularisation d'un dossier annulé.",
      created_by: user.id,
    })
    .select("id, invoice_number, reservation_snapshot, customer_snapshot, issued_at, total_ttc_mad")
    .single();

  if (invErr) {
    console.error("[regularize] facture :", invErr);
    if (invErr.code === "23505") return fail("Une facture vient d'être émise pour ce dossier.");
    return fail("Impossible d'émettre la facture de régularisation.");
  }

  const newInv = invoice as any;
  const details = ((formData.get("reason_details") as string) || "").trim();
  const snapshot: CreditNoteSnapshot = {
    invoice_number: newInv.invoice_number,
    invoice_issued_at: newInv.issued_at,
    invoice_total_ttc_mad: Number(newInv.total_ttc_mad),
    reservation_reference: r.reference,
    reservation_departure_date: r.departure_date,
    circuit_title: circuit?.title ?? null,
    customer: customerSnapshot,
    company,
    amount_mad: paid,
    reason: "cancellation",
    reason_details: details || "Annulation du dossier — sommes encaissées à restituer ou à réutiliser.",
  };

  const { data: noteData, error: noteErr } = await supabase.rpc("issue_credit_note", {
    p_invoice_id: newInv.id,
    p_amount: paid,
    p_reason: "cancellation",
    p_reason_details: snapshot.reason_details,
    p_snapshot: snapshot,
  });

  if (noteErr) {
    console.error("[regularize] avoir :", noteErr);
    return fail(
      `La facture ${newInv.invoice_number} a été émise mais l'avoir a échoué : ${rpcError(noteErr, "erreur inconnue")}. Émettez l'avoir depuis la facture.`,
    );
  }

  const note = (Array.isArray(noteData) ? noteData[0] : noteData) as { id: string; credit_note_number: string } | null;
  revalidateAll([`/admin/reservations/${reservationId}`, `/admin/factures/${newInv.id}`, "/admin/avoirs"]);
  return { ok: true, creditNoteId: note?.id, creditNoteNumber: note?.credit_note_number, savedAt: Date.now() };
}

/** Utilisation d'un avoir sur un dossier du même client (encaissement + mouvement). */
export async function applyCreditNote(
  reservationId: string,
  _prev: CreditNoteActionState,
  formData: FormData,
): Promise<CreditNoteActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Session expirée — reconnectez-vous.");

  const creditNoteId = ((formData.get("credit_note_id") as string) || "").trim();
  const amount = parseFloat((formData.get("amount_mad") as string) ?? "");
  if (!creditNoteId) return fail("Sélectionnez un avoir à utiliser.");
  if (!Number.isFinite(amount) || amount <= 0) return fail("Le montant doit être supérieur à 0.");

  const { error } = await supabase.rpc("apply_credit_note", {
    p_credit_note_id: creditNoteId,
    p_reservation_id: reservationId,
    p_amount: amount,
  });
  if (error) {
    console.error("[applyCreditNote]", error);
    return fail(rpcError(error, "Impossible d'utiliser cet avoir."));
  }

  revalidateAll([`/admin/reservations/${reservationId}`, `/admin/avoirs/${creditNoteId}`, "/admin/avoirs"]);
  return { ok: true, savedAt: Date.now() };
}

/** Remboursement déclaré d'un avoir (aucun encaissement créé). */
export async function refundCreditNote(
  creditNoteId: string,
  _prev: CreditNoteActionState,
  formData: FormData,
): Promise<CreditNoteActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Session expirée — reconnectez-vous.");

  const amount = parseFloat((formData.get("amount_mad") as string) ?? "");
  const method = ((formData.get("method") as string) || "").trim();
  const reference = ((formData.get("reference") as string) || "").trim();
  const notes = ((formData.get("notes") as string) || "").trim();

  if (!Number.isFinite(amount) || amount <= 0) return fail("Le montant doit être supérieur à 0.");
  if (!isRefundMethod(method)) return fail("Choisissez un mode de remboursement.");
  if (method !== "cash" && !reference) return fail("La référence du remboursement est obligatoire pour ce mode.");

  const { error } = await supabase.rpc("refund_credit_note", {
    p_credit_note_id: creditNoteId,
    p_amount: amount,
    p_method: method,
    p_reference: reference || null,
    p_notes: notes || null,
  });
  if (error) {
    console.error("[refundCreditNote]", error);
    return fail(rpcError(error, "Impossible d'enregistrer le remboursement."));
  }

  revalidateAll([`/admin/avoirs/${creditNoteId}`, "/admin/avoirs"]);
  return { ok: true, savedAt: Date.now() };
}
