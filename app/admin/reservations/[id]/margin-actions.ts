"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeAndStoreExpectedCost } from "@/lib/cost-snapshot";

export type RefreshCostResult = { ok: true; cost: number; source: string } | { ok: false; error: string };

/** Recalcul EXPLICITE du coût prévisionnel (l'ancien snapshot est conservé dans previous[]). */
export async function refreshExpectedCost(reservationId: string): Promise<RefreshCostResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée — reconnectez-vous." };

  // Billetterie : le coût prévisionnel EST l'offre figée (source « distribution ») — jamais
  // recalculé par les tarifs d'achat, qui l'écraseraient ou échoueraient.
  const [{ data: resa }, { count: distCount }] = await Promise.all([
    supabase.from("reservations").select("cost_snapshot").eq("id", reservationId).maybeSingle(),
    supabase.from("distribution_bookings").select("id", { count: "exact", head: true }).eq("reservation_id", reservationId),
  ]);
  const source = ((resa as { cost_snapshot?: { source?: string } | null } | null)?.cost_snapshot ?? null)?.source;
  if (source === "distribution" || (distCount ?? 0) > 0) {
    return { ok: false, error: "Dossier billetterie : le coût prévisionnel est celui de l'offre figée et ne se recalcule pas." };
  }

  const res = await computeAndStoreExpectedCost(supabase, reservationId, { actorId: user.id, force: true, reason: "recalcul explicite depuis la fiche" });
  if (!res.ok) return { ok: false, error: `Coût non renseigné : ${res.reason}.` };
  revalidatePath(`/admin/reservations/${reservationId}`);
  revalidatePath("/admin/finance/rentabilite");
  revalidatePath("/admin/rapports");
  return { ok: true, cost: res.cost, source: res.source };
}
