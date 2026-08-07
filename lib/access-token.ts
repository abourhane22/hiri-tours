import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://hiri-tours.vercel.app";

export function suiviUrl(token: string): string {
  return `${APP_URL}/reserver/suivi/${token}`;
}

/**
 * Retourne le jeton de suivi actif de la réservation, en le créant si absent.
 * Écritures via un client service-role (RLS sans policy sur la table).
 * Le jeton n'est jamais journalisé.
 */
export async function ensureAccessToken(
  supabase: SupabaseClient,
  reservationId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("reservation_access_tokens")
    .select("token")
    .eq("reservation_id", reservationId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return (existing as any).token as string;

  const token = crypto.randomBytes(24).toString("base64url");
  const { error } = await supabase
    .from("reservation_access_tokens")
    .insert({ reservation_id: reservationId, token });

  // Course possible (insert concurrent) → on relit le jeton actif.
  if (error) {
    const { data: again } = await supabase
      .from("reservation_access_tokens")
      .select("token")
      .eq("reservation_id", reservationId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (again) return (again as any).token as string;
    throw new Error(error.message);
  }

  return token;
}
