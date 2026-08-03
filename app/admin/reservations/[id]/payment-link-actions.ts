"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentLinkEmail } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://hiri-tours.vercel.app";
const LINK_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

export type CreateLinkResult =
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; error: string };

export type SimpleResult = { ok: true } | { ok: false; error: string };

function linkUrl(token: string) {
  return `${APP_URL}/payer/t/${token}`;
}

/**
 * Crée un lien de paiement tokenisé (7 j), révoque les liens actifs précédents.
 * Écritures via service-role. Le token n'est jamais journalisé.
 */
export async function createPaymentLink(reservationId: string): Promise<CreateLinkResult> {
  const supabase = createAdminClient();

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("status, total_amount_mad, paid_amount_mad")
    .eq("id", reservationId)
    .single();

  if (error || !reservation) return { ok: false, error: "Réservation introuvable." };
  const r = reservation as any;
  if (r.status === "cancelled") return { ok: false, error: "Cette réservation est annulée." };
  const remaining = Number(r.total_amount_mad) - Number(r.paid_amount_mad);
  if (remaining <= 0) return { ok: false, error: "Cette réservation est déjà soldée." };

  // Un seul lien valide à la fois : révoque les liens actifs non utilisés.
  await supabase
    .from("payment_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("reservation_id", reservationId)
    .is("revoked_at", null)
    .is("used_at", null);

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();

  const { error: insertError } = await supabase.from("payment_links").insert({
    reservation_id: reservationId,
    token,
    amount_mad: null,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("[createPaymentLink] insert error:", insertError.message);
    return { ok: false, error: "Impossible de créer le lien de paiement." };
  }

  revalidatePath(`/admin/reservations/${reservationId}`);
  return { ok: true, url: linkUrl(token), expiresAt };
}

/** Révoque le lien actif de la réservation (le rend invalide immédiatement). */
export async function revokePaymentLink(reservationId: string): Promise<SimpleResult> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("payment_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("reservation_id", reservationId)
    .is("revoked_at", null)
    .is("used_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/reservations/${reservationId}`);
  return { ok: true };
}

/** Envoie le lien actif par email (Resend). */
export async function sendPaymentLinkEmailAction(reservationId: string): Promise<SimpleResult> {
  const supabase = createAdminClient();
  const { data: link } = await supabase
    .from("payment_links")
    .select("token, expires_at")
    .eq("reservation_id", reservationId)
    .is("revoked_at", null)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!link) {
    return { ok: false, error: "Aucun lien actif. Générez un lien d'abord." };
  }

  const l = link as any;
  const result = await sendPaymentLinkEmail(reservationId, linkUrl(l.token), l.expires_at);
  if (!result.success) {
    return { ok: false, error: result.skipped || result.error || "Erreur d'envoi." };
  }
  return { ok: true };
}
