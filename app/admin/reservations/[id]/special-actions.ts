"use server";

// Cartes spéciales de la fiche dossier : « Arrivée » (transfert) et « Séjour »
// (hébergement). Session staff, dossier non annulé.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MEAL_PLAN_LABEL } from "@/lib/dossier-profile";

export type SpecialActionState = { ok: true; savedAt?: number } | { ok: false; error: string };

async function ctx(reservationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Session expirée — reconnectez-vous." };
  const { data } = await supabase.from("reservations").select("id, status").eq("id", reservationId).single();
  if (!data) return { ok: false as const, error: "Réservation introuvable." };
  if ((data as any).status === "cancelled") return { ok: false as const, error: "Dossier annulé." };
  return { ok: true as const, supabase };
}

/** Transfert : n° de vol + heure d'arrivée (date + heure locales → timestamptz). */
export async function updateArrivalInfo(reservationId: string, _prev: SpecialActionState, formData: FormData): Promise<SpecialActionState> {
  const c = await ctx(reservationId);
  if (!c.ok) return c;
  const flight = ((formData.get("arrival_flight_number") as string) || "").trim().toUpperCase().replace(/\s+/g, " ");
  const date = ((formData.get("arrival_date") as string) || "").trim();
  const time = ((formData.get("arrival_time") as string) || "").trim();
  let at: string | null = null;
  if (date || time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: "Indiquez la date ET l'heure d'arrivée." };
    const d = new Date(`${date}T${time}:00`);
    if (isNaN(d.getTime())) return { ok: false, error: "Heure d'arrivée invalide." };
    at = d.toISOString();
  }
  if (flight && !/^[A-Z0-9]{2,3} ?\d{1,4}[A-Z]?$/.test(flight)) return { ok: false, error: "N° de vol invalide (ex. AT 1234, RAM123)." };
  const { error } = await c.supabase.from("reservations").update({ arrival_flight_number: flight || null, arrival_flight_at: at }).eq("id", reservationId);
  if (error) return { ok: false, error: "Impossible d'enregistrer l'arrivée." };
  revalidatePath(`/admin/reservations/${reservationId}`);
  revalidatePath("/admin/manifestes", "layout");
  return { ok: true, savedAt: Date.now() };
}

/** Hébergement : régime. Check-in/out dérivent de la date de départ et des nuits (non modifiables ici). */
export async function updateStayInfo(reservationId: string, _prev: SpecialActionState, formData: FormData): Promise<SpecialActionState> {
  const c = await ctx(reservationId);
  if (!c.ok) return c;
  const meal = ((formData.get("meal_plan") as string) || "").trim();
  if (meal && !(meal in MEAL_PLAN_LABEL)) return { ok: false, error: "Régime invalide." };
  const { error } = await c.supabase.from("reservations").update({ meal_plan: meal || null }).eq("id", reservationId);
  if (error) return { ok: false, error: "Impossible d'enregistrer le séjour." };
  revalidatePath(`/admin/reservations/${reservationId}`);
  return { ok: true, savedAt: Date.now() };
}
