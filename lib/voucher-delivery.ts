// Remise du voucher : dernière date + canal, sur le dossier (étape « Voucher »
// du stepper billetterie). La dernière remise l'emporte.

import type { SupabaseClient } from "@supabase/supabase-js";

export const VOUCHER_CHANNELS = ["email", "comptoir", "whatsapp", "autre"] as const;
export type VoucherChannel = (typeof VOUCHER_CHANNELS)[number];

export function isVoucherChannel(v: unknown): v is VoucherChannel {
  return typeof v === "string" && (VOUCHER_CHANNELS as readonly string[]).includes(v);
}

/**
 * Enregistre une remise. Tolère l'absence de la colonne voucher_delivery_channel
 * (bloc 3b de 20260927_lot_retours_test.sql pas encore passé) : seule la date est
 * alors écrite.
 */
export async function recordVoucherDelivery(
  supabase: SupabaseClient,
  reservationId: string,
  channel: VoucherChannel,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const at = new Date().toISOString();
  const { error } = await supabase
    .from("reservations")
    .update({ voucher_sent_at: at, voucher_delivery_channel: channel })
    .eq("id", reservationId);
  if (!error) return { ok: true };
  const missingColumn = error.code === "42703" || error.code === "PGRST204" || /voucher_delivery_channel/.test(error.message ?? "");
  if (missingColumn) {
    const { error: e2 } = await supabase.from("reservations").update({ voucher_sent_at: at }).eq("id", reservationId);
    if (!e2) return { ok: true };
    return { ok: false, error: e2.message };
  }
  return { ok: false, error: error.message };
}
