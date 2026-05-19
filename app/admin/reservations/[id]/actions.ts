"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateStatus(id: string, formData: FormData) {
  const status = formData.get("status") as string;
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/reservations/${id}`);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");
}

export async function addPayment(reservationId: string, formData: FormData) {
  const method = formData.get("method") as string;
  const amount = parseFloat(formData.get("amount_mad") as string);
  const transactionRef = (formData.get("transaction_ref") as string)?.trim() || null;

  if (!method || isNaN(amount) || amount <= 0) {
    throw new Error("Données invalides");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    reservation_id: reservationId,
    method,
    amount_mad: amount,
    transaction_ref: transactionRef,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/reservations/${reservationId}`);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");
}

export async function updateNotes(id: string, formData: FormData) {
  const notes = ((formData.get("notes") as string) || "").trim() || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ notes })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/reservations/${id}`);
}

export async function cancelReservation(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/reservations/${id}`);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");
}
