"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllotmentCommitment, isAllotmentOnExhausted } from "@/lib/allotments";

export type AllotmentActionState = { ok: true; savedAt?: number } | { ok: false; error: string };

const fail = (error: string): AllotmentActionState => ({ ok: false, error });
const str = (fd: FormData, k: string) => ((fd.get(k) as string) || "").trim();

async function staffClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Session expirée — reconnectez-vous." };
  return { ok: true as const, supabase, user };
}

/**
 * Les refus de sync_allotment_days (quota sous le vendu, période réduite sur
 * des ventes, chevauchement) arrivent ici en exception Postgres, rédigés pour
 * l'utilisateur. On garde la phrase métier, sans le préfixe technique.
 */
function dbError(error: { message?: string; code?: string }, fallback: string): string {
  const raw = (error.message ?? "").trim();
  if (!raw) return fallback;
  if (error.code === "23P01") {
    // EXCLUDE allotments_no_overlap
    return "Un allotement actif couvre déjà tout ou partie de cette période pour ce produit. Réduisez la période ou désactivez l'autre allotement.";
  }
  if (error.code === "23514") {
    // CHECK — le plus probable : capacité propre non garantie
    if (raw.includes("own_capacity")) return "Une capacité propre est nécessairement « Garanti ».";
    if (raw.includes("period")) return "La date de fin doit être postérieure à la date de début.";
  }
  return raw.replace(/^.*?(?:exception|error):\s*/i, "").trim() || fallback;
}

/**
 * Lecture commune des champs. `withProduct` = création uniquement : le produit
 * d'un allotement existant n'est JAMAIS réécrit (les compteurs matérialisés le
 * portent ; pour changer de produit, on supprime et on recrée).
 */
function readAllotment(
  fd: FormData,
  withProduct: boolean,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const label = str(fd, "label");
  if (!label) return { ok: false, error: "Le libellé est obligatoire." };

  const startsOn = str(fd, "starts_on");
  const endsOn = str(fd, "ends_on");
  if (!startsOn || !endsOn) return { ok: false, error: "La période est obligatoire." };
  if (startsOn > endsOn) return { ok: false, error: "La date de fin doit être postérieure à la date de début." };

  const quota = parseInt(str(fd, "quota_per_day"), 10);
  if (!Number.isInteger(quota) || quota <= 0) return { ok: false, error: "Le quota par jour doit être un entier supérieur à 0." };

  const releaseDays = parseInt(str(fd, "release_days") || "0", 10);
  if (!Number.isInteger(releaseDays) || releaseDays < 0) {
    return { ok: false, error: "Le préavis de release doit être un entier positif ou nul (0 = pas de release)." };
  }

  // Jours de la semaine : cases wd_0 … wd_6 (dow). Toutes cochées ⇒ NULL.
  const weekdays: number[] = [];
  for (let d = 0; d <= 6; d++) if (fd.get(`wd_${d}`) === "on") weekdays.push(d);
  if (weekdays.length === 0) return { ok: false, error: "Choisissez au moins un jour de la semaine." };
  const weekdaysValue = weekdays.length === 7 ? null : weekdays;

  // Origine : capacité propre (contract_id NULL) ou contrat fournisseur.
  const origin = str(fd, "origin");
  let contractId: string | null = null;
  if (origin === "contract") {
    contractId = str(fd, "contract_id") || null;
    if (!contractId) return { ok: false, error: "Choisissez le contrat fournisseur, ou passez en capacité propre." };
  } else if (origin !== "own") {
    return { ok: false, error: "Origine invalide." };
  }

  // Une capacité propre est nécessairement garantie (miroir de la contrainte SQL).
  const commitmentRaw = contractId ? str(fd, "commitment") : "guaranteed";
  if (!isAllotmentCommitment(commitmentRaw)) return { ok: false, error: "Type d'engagement invalide." };

  const onExhausted = str(fd, "on_exhausted") || "request";
  if (!isAllotmentOnExhausted(onExhausted)) return { ok: false, error: "Comportement à épuisement invalide." };

  const data: Record<string, unknown> = {
    contract_id: contractId,
    label,
    starts_on: startsOn,
    ends_on: endsOn,
    quota_per_day: quota,
    weekdays: weekdaysValue,
    release_days: releaseDays,
    commitment: commitmentRaw,
    on_exhausted: onExhausted,
    is_active: fd.get("is_active") === "on",
    notes: str(fd, "notes") || null,
  };

  if (withProduct) {
    const productId = str(fd, "product_id");
    if (!productId) return { ok: false, error: "Le produit est obligatoire." };
    data.product_id = productId;
  }

  return { ok: true, data };
}

export async function createAllotment(_prev: AllotmentActionState, fd: FormData): Promise<AllotmentActionState> {
  const ctx = await staffClient();
  if (!ctx.ok) return ctx;
  const fields = readAllotment(fd, true);
  if (!fields.ok) return fields;

  // Le trigger allotments_sync_days matérialise les compteurs dans la même
  // transaction ; ses refus remontent ici avec leur message.
  const { data, error } = await ctx.supabase
    .from("allotments")
    .insert({ ...fields.data, created_by: ctx.user.id })
    .select("id")
    .single();
  if (error) {
    console.error("[createAllotment]", error);
    return fail(dbError(error, "Impossible de créer l'allotement."));
  }

  revalidatePath("/admin/allotements");
  redirect(`/admin/allotements/${(data as any).id}?created=1`);
}

export async function updateAllotment(id: string, _prev: AllotmentActionState, fd: FormData): Promise<AllotmentActionState> {
  const ctx = await staffClient();
  if (!ctx.ok) return ctx;
  // withProduct = false : product_id n'est jamais dans le payload.
  const fields = readAllotment(fd, false);
  if (!fields.ok) return fields;

  const { error } = await ctx.supabase.from("allotments").update(fields.data).eq("id", id);
  if (error) {
    console.error("[updateAllotment]", error);
    return fail(dbError(error, "Impossible d'enregistrer l'allotement."));
  }

  revalidatePath("/admin/allotements");
  revalidatePath(`/admin/allotements/${id}`);
  return { ok: true, savedAt: Date.now() };
}

/**
 * Suppression — refusée si des mouvements existent (on ne perd pas
 * l'historique des ventes). La désactivation est la voie normale.
 */
export async function deleteAllotment(id: string): Promise<AllotmentActionState> {
  const ctx = await staffClient();
  if (!ctx.ok) return ctx;

  const { data: days } = await ctx.supabase.from("allotment_days").select("id, sold").eq("allotment_id", id);
  const dayIds = ((days ?? []) as { id: string; sold: number }[]).map((d) => d.id);
  if (dayIds.length > 0) {
    const { count } = await ctx.supabase
      .from("allotment_movements")
      .select("id", { count: "exact", head: true })
      .in("allotment_day_id", dayIds);
    if ((count ?? 0) > 0) {
      return fail(
        `Suppression impossible : ${count} mouvement(s) de stock sont rattachés à cet allotement. Désactivez-le pour conserver l'historique.`,
      );
    }
  }

  const { error } = await ctx.supabase.from("allotments").delete().eq("id", id);
  if (error) {
    console.error("[deleteAllotment]", error);
    return fail(dbError(error, "Impossible de supprimer l'allotement."));
  }

  revalidatePath("/admin/allotements");
  redirect("/admin/allotements");
}
