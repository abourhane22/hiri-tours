"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  paid: "Payée",
  cancelled: "Annulée",
  completed: "Terminée",
};

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? {} : T))
  | { ok: false; error: string };

export async function updateStatus(
  id: string,
  _prev: ActionResult<{ status: string; label: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ status: string; label: string }>> {
  const status = formData.get("status") as string;
  if (!status || !(status in STATUS_LABEL)) {
    return { ok: false, error: "Statut invalide" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("[updateStatus] Supabase error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/reservations/[id]", "page");
  revalidatePath(`/admin/reservations/${id}`);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");

  return { ok: true, status, label: STATUS_LABEL[status] };
}

export async function addPayment(
  reservationId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const method = formData.get("method") as string;
  const amount = parseFloat(formData.get("amount_mad") as string);
  const transactionRef =
    (formData.get("transaction_ref") as string)?.trim() || null;

  if (!method || isNaN(amount) || amount <= 0) {
    return { ok: false, error: "Montant invalide" };
  }

  const supabase = await createClient();

  const { data: reservation, error: readError } = await supabase
    .from("reservations")
    .select("total_amount_mad, paid_amount_mad")
    .eq("id", reservationId)
    .single();

  if (readError || !reservation) {
    console.error("[addPayment] Impossible de recharger la réservation:", readError);
    return { ok: false, error: "Réservation introuvable" };
  }

  const total = Number((reservation as any).total_amount_mad);
  const alreadyPaid = Number((reservation as any).paid_amount_mad);
  const remaining = Math.max(0, total - alreadyPaid);

  if (remaining <= 0) {
    return { ok: false, error: "Réservation déjà soldée" };
  }

  // Tolérance 1 centime pour arrondis
  if (amount - remaining > 0.01) {
    return {
      ok: false,
      error: `Le montant dépasse le restant dû (${remaining.toFixed(2)} MAD)`,
    };
  }

  const { error } = await supabase.from("payments").insert({
    reservation_id: reservationId,
    method,
    amount_mad: amount,
    transaction_ref: transactionRef,
  });

  if (error) {
    console.error("[addPayment] Supabase insert error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/reservations/${reservationId}`);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");

  return { ok: true };
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
