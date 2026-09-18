// Allotements : appels aux fonctions plpgsql AVEC FILET, et libellés partagés.
//
// RÈGLE : le tunnel public ne tombe JAMAIS pour une raison d'infrastructure.
// Les deux fonctions ci-dessous distinguent strictement :
//   - une ISSUE MÉTIER (no_allotment / consumed / on_request / blocked /
//     released), renvoyée par la base et traitée normalement par l'appelant ;
//   - une EXCEPTION (clé mal configurée, fonction absente, base injoignable),
//     transformée en `kind: "unavailable"` : l'appelant crée le dossier quand
//     même, journalise, et la notification de réconciliation le fait remonter.
// Elles ne lèvent donc jamais.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AllotmentCommitment, AllotmentOnExhausted, AllotmentOutcome } from "@/lib/types";

const OUTCOMES: readonly AllotmentOutcome[] = ["no_allotment", "consumed", "on_request", "blocked", "released"];

export function isAllotmentOutcome(v: unknown): v is AllotmentOutcome {
  return typeof v === "string" && (OUTCOMES as readonly string[]).includes(v);
}

export type ConsumeResult =
  | { kind: "outcome"; outcome: AllotmentOutcome; remaining: number | null }
  | { kind: "unavailable"; error: string };

/**
 * Décompte `qty` places pour (produit, jour). Ne lève jamais.
 * Un produit sans allotement renvoie `no_allotment` sans aucune écriture —
 * c'est ce qui garantit la non-régression tant qu'aucun allotement n'existe.
 */
export async function consumeAllotment(
  supabase: SupabaseClient,
  params: { productId: string; day: string; qty: number; reservationId: string | null; reason?: string },
): Promise<ConsumeResult> {
  try {
    const { data, error } = await supabase.rpc("consume_allotment", {
      p_product_id: params.productId,
      p_day: params.day,
      p_qty: params.qty,
      p_reservation_id: params.reservationId,
      p_reason: params.reason ?? "booking",
    });
    if (error) {
      console.error("[allotment] consume_allotment indisponible :", error.message);
      return { kind: "unavailable", error: error.message };
    }
    const row = (Array.isArray(data) ? data[0] : data) as { outcome?: unknown; remaining?: unknown } | null;
    if (!row || !isAllotmentOutcome(row.outcome)) {
      console.error("[allotment] réponse inattendue de consume_allotment :", data);
      return { kind: "unavailable", error: "réponse inattendue" };
    }
    const remaining = typeof row.remaining === "number" ? row.remaining : null;
    return { kind: "outcome", outcome: row.outcome, remaining };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[allotment] consume_allotment exception :", msg);
    return { kind: "unavailable", error: msg };
  }
}

export type ReleaseResult = { ok: true; released: number } | { ok: false; error: string };

/** Libère tout ce qu'un dossier a consommé. Idempotente côté base. Ne lève jamais. */
export async function releaseAllotment(
  supabase: SupabaseClient,
  reservationId: string,
  reason: "cancellation" | "pax_change" | "manual" = "cancellation",
): Promise<ReleaseResult> {
  try {
    const { data, error } = await supabase.rpc("release_allotment", {
      p_reservation_id: reservationId,
      p_reason: reason,
    });
    if (error) {
      console.error("[allotment] release_allotment indisponible :", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, released: typeof data === "number" ? data : Number(data) || 0 };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[allotment] release_allotment exception :", msg);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Messages utilisateur
// ---------------------------------------------------------------------------

/** Message affiché quand la réservation est refusée faute de places. */
export function blockedMessage(remaining: number | null): string {
  if (remaining === null || remaining <= 0) return "Ce départ est complet.";
  if (remaining === 1) return "Il ne reste qu'une place pour ce départ.";
  return `Il ne reste que ${remaining} places pour ce départ.`;
}

export const RELEASED_MESSAGE = "Ce départ n'est plus ouvert à la vente.";

/** Mention portée par un dossier créé au-delà du quota (mode « sur demande »). */
export const ON_REQUEST_NOTICE =
  "Sous réserve de confirmation : le départ est très demandé, notre équipe valide votre place auprès du prestataire.";

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

export const COMMITMENT_LABEL: Record<AllotmentCommitment, string> = {
  guaranteed: "Garanti",
  on_request: "Sur demande",
  free_sale: "Vente libre",
};

export const COMMITMENT_HINT: Record<AllotmentCommitment, string> = {
  guaranteed: "Les places sont acquises : le fournisseur (ou l'agence) les bloque pour vous.",
  on_request: "Chaque vente doit être confirmée par le fournisseur.",
  free_sale: "Le fournisseur vend aussi ces places ailleurs ; le quota est indicatif.",
};

export const ON_EXHAUSTED_LABEL: Record<AllotmentOnExhausted, string> = {
  request: "Laisser passer sur demande",
  block: "Bloquer la vente",
};

export const ON_EXHAUSTED_HINT: Record<AllotmentOnExhausted, string> = {
  request: "Quota atteint : la réservation est acceptée « sous réserve » et remonte dans les notifications. Ne bloque rien.",
  block: "Quota atteint : la réservation est refusée avec le nombre de places restantes.",
};

export const WEEKDAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"] as const; // index = extract(dow)
export const WEEKDAY_LONG = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;

/** Ordre d'affichage français : lundi → dimanche, exprimé en indices dow. */
export const WEEKDAYS_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

export function formatWeekdays(weekdays: number[] | null | undefined): string {
  if (!weekdays || weekdays.length === 0 || weekdays.length === 7) return "Tous les jours";
  const set = new Set(weekdays);
  return WEEKDAYS_MONDAY_FIRST.filter((d) => set.has(d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(" · ");
}

export function isAllotmentCommitment(v: unknown): v is AllotmentCommitment {
  return v === "guaranteed" || v === "on_request" || v === "free_sale";
}
export function isAllotmentOnExhausted(v: unknown): v is AllotmentOnExhausted {
  return v === "block" || v === "request";
}

/** État d'un jour pour le calendrier. */
export type DayState = "released" | "full" | "low" | "ok";

export function dayState(d: { quota: number; sold: number; released: boolean }): DayState {
  if (d.released) return "released";
  if (d.sold >= d.quota) return "full";
  const remaining = d.quota - d.sold;
  if (d.quota > 0 && remaining / d.quota <= 0.3) return "low";
  return "ok";
}

export const DAY_STATE_STYLE: Record<DayState, { bg: string; color: string; label: string }> = {
  ok: { bg: "#E1F5EE", color: "#085041", label: "Disponible" },
  low: { bg: "#FAEEDA", color: "#633806", label: "Presque complet" },
  full: { bg: "#FCEBEB", color: "#791F1F", label: "Complet" },
  released: { bg: "#F1EFE8", color: "#968F84", label: "Libéré (release)" },
};
