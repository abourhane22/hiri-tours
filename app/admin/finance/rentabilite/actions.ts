"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeAndStoreExpectedCost } from "@/lib/cost-snapshot";
import { EXPECTED_COST_REASON_LABEL, type ExpectedCostReasonCode } from "@/lib/margin";

export type ComputeMissingResult =
  | { ok: true; candidates: number; computed: number; missing: { reason: string; count: number }[] }
  | { ok: false; error: string };

/**
 * Action EXPLICITE : fige le coût prévisionnel des dossiers de la période qui
 * n'en ont pas encore. Ne touche jamais un dossier déjà renseigné. Rend compte
 * de ce qui a été calculé et de ce qui reste non renseigné, et pourquoi.
 */
export async function computeMissingCosts(period: { start?: string; end?: string }): Promise<ComputeMissingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée — reconnectez-vous." };

  let q = supabase.from("reservations").select("id").is("cost_snapshot", null).neq("status", "cancelled").order("departure_date", { ascending: false }).limit(500);
  if (period.start) q = q.gte("departure_date", period.start);
  if (period.end) q = q.lte("departure_date", period.end);
  const { data } = await q;
  const ids = ((data ?? []) as { id: string }[]).map((x) => x.id);

  let computed = 0;
  const reasons: Record<string, number> = {};
  for (const id of ids) {
    const res = await computeAndStoreExpectedCost(supabase, id, { actorId: user.id, reason: "calcul des coûts manquants (Rentabilité)" });
    if (res.ok) computed += 1;
    else {
      const label = (EXPECTED_COST_REASON_LABEL as Record<string, string>)[res.code as ExpectedCostReasonCode] ?? res.reason;
      reasons[label] = (reasons[label] ?? 0) + 1;
    }
  }

  revalidatePath("/admin/finance/rentabilite");
  revalidatePath("/admin/rapports");
  return {
    ok: true,
    candidates: ids.length,
    computed,
    missing: Object.entries(reasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
