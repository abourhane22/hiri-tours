import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import BookingConfirmationEmail from "@/emails/booking-confirmation";
import VoucherDeliveryEmail from "@/emails/voucher-delivery";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.EMAIL_FROM || "Hiri Tours <onboarding@resend.dev>";

type EmailResult = { success: boolean; id?: string; error?: string; skipped?: string };

export async function sendBookingConfirmation(reservationId: string): Promise<EmailResult> {
  if (!resend) return { success: false, skipped: "RESEND_API_KEY non configurée" };

  const supabase = await createClient();
  const { data: reservation } = await supabase
    .from("reservations")
    .select("*, customers(full_name, email), circuits(title)")
    .eq("id", reservationId)
    .single();

  if (!reservation) return { success: false, error: "Réservation introuvable" };
  const r = reservation as any;
  if (!r.customers?.email) return { success: false, skipped: "Client sans email" };

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: r.customers.email,
      subject: `Confirmation de réservation ${r.reference}`,
      react: BookingConfirmationEmail({
        customerName: r.customers.full_name,
        reference: r.reference,
        circuitTitle: r.circuits?.title || "Excursion",
        departureDate: r.departure_date,
        adults: r.adults,
        children: r.children,
        totalAmount: Number(r.total_amount_mad),
        pickupLocation: r.pickup_location,
      }),
    });
    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur d'envoi" };
  }
}

export async function sendVoucherEmail(reservationId: string): Promise<EmailResult> {
  if (!resend) {
    return { success: false, skipped: "Service email non configuré (RESEND_API_KEY absente)" };
  }

  try {
    const supabase = await createClient();
    const { data: reservation, error: readError } = await supabase
      .from("reservations")
      .select("*, customers(full_name, email), circuits(title)")
      .eq("id", reservationId)
      .single();

    if (readError || !reservation) {
      console.error("[sendVoucherEmail] Réservation introuvable:", readError);
      return { success: false, error: "Réservation introuvable" };
    }
    const r = reservation as any;
    if (!r.customers?.email) return { success: false, skipped: "Client sans email" };

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: r.customers.email,
      subject: `Votre voucher Hiri Tours — ${r.reference}`,
      react: VoucherDeliveryEmail({
        customerName: r.customers.full_name,
        reference: r.reference,
        circuitTitle: r.circuits?.title || "Excursion",
        departureDate: r.departure_date,
        adults: r.adults,
        children: r.children,
        totalAmount: Number(r.total_amount_mad),
        paidAmount: Number(r.paid_amount_mad),
        pickupLocation: r.pickup_location,
      }),
    });
    if (error) {
      console.error("[sendVoucherEmail] Resend API error:", error);
      return { success: false, error: error.message };
    }
    return { success: true, id: data?.id };
  } catch (e: any) {
    console.error("[sendVoucherEmail] Exception:", e);
    return { success: false, error: e?.message || "Erreur d'envoi" };
  }
}
