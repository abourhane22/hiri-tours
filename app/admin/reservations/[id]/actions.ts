"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { autoConfirmOnPayment } from "@/lib/payments";

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

  // État courant + encaissements pour les règles de cohérence.
  const { data: current } = await supabase
    .from("reservations")
    .select("status, paid_amount_mad, total_amount_mad, confirmed_at")
    .eq("id", id)
    .single();

  if (!current) {
    return { ok: false, error: "Réservation introuvable" };
  }

  const cur = current as any;
  const paid = Number(cur.paid_amount_mad);
  const total = Number(cur.total_amount_mad);
  const isSettled = total > 0 && paid >= total;
  const hasPartial = paid > 0;
  const paidLabel = `${Math.round(paid).toLocaleString("fr-FR")} MAD`;

  // Annulation terminale : aucune transition depuis 'cancelled'.
  if (cur.status === "cancelled") {
    return {
      ok: false,
      error: "Ce dossier est annulé, son statut ne peut plus être modifié.",
    };
  }

  // "Terminée" est attribué automatiquement par le cron (payé + départ passé).
  // Interdit toute transition manuelle VERS 'completed', sauf si le dossier
  // est déjà 'completed' (pour permettre une correction en sortie).
  if (status === "completed" && cur.status !== "completed") {
    return {
      ok: false,
      error: "Le statut Terminée est attribué automatiquement après le départ.",
    };
  }

  // "Payée" est attribué automatiquement à l'encaissement du solde.
  if (status === "paid" && cur.status !== "paid") {
    return {
      ok: false,
      error:
        "Le statut Payée s'applique automatiquement quand le solde est encaissé. Enregistrez le paiement dans la carte Paiements.",
    };
  }

  // Pas de rétrogradation d'un dossier SOLDÉ vers 'pending' / 'confirmed'.
  if (isSettled && (status === "pending" || status === "confirmed")) {
    return {
      ok: false,
      error: `Impossible de rétrograder : la réservation est soldée (${paidLabel} encaissés). Annulez ou corrigez les paiements d'abord.`,
    };
  }

  // Paiement partiel : pas de retour à 'pending'.
  if (!isSettled && hasPartial && status === "pending") {
    return {
      ok: false,
      error: `Impossible de revenir à « En attente » : ${paidLabel} déjà encaissés. Annulez ou corrigez les paiements d'abord.`,
    };
  }

  // Horodatage de la transition (sans écraser un timestamp déjà posé,
  // sauf cancelled_at qui peut se re-remplir après re-annulation).
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "confirmed" && !cur.confirmed_at) patch.confirmed_at = nowIso;
  if (status === "cancelled") patch.cancelled_at = nowIso;

  const { error } = await supabase.from("reservations").update(patch).eq("id", id);

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
  _prev: ActionResult<{ warning?: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ warning?: string }>> {
  const method = formData.get("method") as string;
  const amount = parseFloat(formData.get("amount_mad") as string);
  const externalRef = ((formData.get("external_ref") as string) || "").trim();

  if (!method || isNaN(amount) || amount <= 0) {
    return { ok: false, error: "Montant invalide" };
  }

  // Le numéro de virement est obligatoire pour un paiement par virement.
  if (method === "transfer" && !externalRef) {
    return { ok: false, error: "Le numéro de virement est obligatoire." };
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

  // Unicité souple : un même numéro déjà saisi sur CE dossier est suspect,
  // mais on avertit sans bloquer (une réf tronquée peut être partagée).
  let warning: string | undefined;
  if (externalRef) {
    const { data: dup } = await supabase
      .from("payments")
      .select("id")
      .eq("reservation_id", reservationId)
      .eq("external_ref", externalRef)
      .limit(1);
    if (dup && dup.length > 0) {
      warning = "Ce numéro de virement a déjà été saisi sur ce dossier.";
    }
  }

  const { error } = await supabase.from("payments").insert({
    reservation_id: reservationId,
    method,
    amount_mad: amount,
    external_ref: externalRef || null,
  });

  if (error) {
    console.error("[addPayment] Supabase insert error:", error);
    return { ok: false, error: error.message };
  }

  // Demande → Confirmée au premier encaissement.
  await autoConfirmOnPayment(supabase, reservationId);

  revalidatePath(`/admin/reservations/${reservationId}`);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");

  return warning ? { ok: true, warning } : { ok: true };
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
