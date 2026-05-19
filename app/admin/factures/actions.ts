"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createInvoice(reservationId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("invoices").select("id").eq("reservation_id", reservationId)
    .eq("status", "issued").maybeSingle();
  if (existing) throw new Error("Une facture est déjà émise pour cette réservation.");

  const { data: reservation } = await supabase
    .from("reservations")
    .select("*, circuits(title, slug), customers(*)")
    .eq("id", reservationId).single();
  if (!reservation) throw new Error("Réservation introuvable.");
  if (!["paid", "completed"].includes(reservation.status)) {
    throw new Error("La réservation doit être payée pour émettre une facture.");
  }

  const { data: company } = await supabase.from("company_settings").select("*").limit(1).single();
  if (!company) throw new Error("Paramètres société non configurés.");

  const tvaRate = parseFloat(formData.get("tva_rate") as string) || Number(company.tva_default_rate);
  const totalTtc = Number((reservation as any).total_amount_mad);
  const totalHt = +(totalTtc / (1 + tvaRate)).toFixed(2);
  const tvaAmount = +(totalTtc - totalHt).toFixed(2);

  const r = reservation as any;
  const lines = [{
    description: r.circuits?.title || "Prestation",
    details: `Départ le ${r.departure_date} — ${r.adults} adulte${r.adults > 1 ? "s" : ""}${r.children > 0 ? `, ${r.children} enfant${r.children > 1 ? "s" : ""}` : ""}`,
    quantity: 1,
    unit_price_ht_mad: totalHt,
    total_ht_mad: totalHt,
    total_ttc_mad: totalTtc,
  }];

  const { data: numberData, error: numErr } = await supabase.rpc("next_invoice_number");
  if (numErr) throw new Error(numErr.message);

  const { data: invoice, error } = await supabase.from("invoices").insert({
    invoice_number: numberData as string,
    reservation_id: reservationId,
    customer_id: r.customer_id,
    company_snapshot: company,
    customer_snapshot: r.customers,
    lines,
    total_ht_mad: totalHt,
    tva_rate: tvaRate,
    tva_amount_mad: tvaAmount,
    total_ttc_mad: totalTtc,
    notes: (formData.get("notes") as string) || null,
  }).select("id").single();

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/reservations/${reservationId}`);
  revalidatePath("/admin/factures");
  redirect(`/admin/factures/${invoice.id}`);
}

export async function cancelInvoice(invoiceId: string, formData: FormData) {
  const reason = ((formData.get("reason") as string) || "").trim() || "Annulation administrative";
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason,
  }).eq("id", invoiceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/factures/${invoiceId}`);
  revalidatePath("/admin/factures");
}
