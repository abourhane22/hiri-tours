"use server";

// Chargements à la demande du formulaire « Nouveau dossier » : synthèse client,
// disponibilités d'un mois (UN appel par mois affiché), détection de doublon.
// Lecture seule, session staff (RLS).

import { createClient } from "@/lib/supabase/server";
import { computeLoyaltyPoints, getLoyaltyTier, type LoyaltyTier } from "@/lib/loyalty";

// ---------------------------------------------------------------------------
// Synthèse client
// ---------------------------------------------------------------------------

export type CustomerSummary = {
  nbReservations: number;
  lastDeparture: { title: string | null; date: string } | null;
  tier: LoyaltyTier;
  creditNotes: { id: string; number: string; remaining: number }[];
  creditAvailable: number;
};

export async function loadCustomerSummary(customerId: string): Promise<CustomerSummary | null> {
  if (!customerId) return null;
  const supabase = await createClient();
  const [resRes, cnRes] = await Promise.all([
    supabase
      .from("reservations")
      .select("total_amount_mad, status, departure_date, circuits(title)")
      .eq("customer_id", customerId)
      .order("departure_date", { ascending: false }),
    supabase
      .from("credit_notes")
      .select("id, credit_note_number, remaining_mad")
      .eq("customer_id", customerId)
      .eq("status", "issued")
      .gt("remaining_mad", 0)
      .order("created_at", { ascending: true }),
  ]);
  const reservations = (resRes.data ?? []) as any[];
  const active = reservations.filter((r) => r.status !== "cancelled");
  const today = new Date().toISOString().slice(0, 10);
  const past = active.filter((r) => r.departure_date <= today);
  const last = past[0] ?? null;
  const creditNotes = ((cnRes.data ?? []) as any[]).map((c) => ({
    id: c.id as string,
    number: c.credit_note_number as string,
    remaining: Number(c.remaining_mad),
  }));
  return {
    nbReservations: active.length,
    lastDeparture: last
      ? { title: (Array.isArray(last.circuits) ? last.circuits[0] : last.circuits)?.title ?? null, date: last.departure_date }
      : null,
    tier: getLoyaltyTier(computeLoyaltyPoints(reservations)),
    creditNotes,
    creditAvailable: creditNotes.reduce((s, c) => s + c.remaining, 0),
  };
}

// ---------------------------------------------------------------------------
// Disponibilités d'un mois
// ---------------------------------------------------------------------------

export type MonthAvailability = {
  /** Jours d'allotement du mois, clé YYYY-MM-DD. */
  days: Record<string, { quota: number; sold: number; released: boolean }>;
  /** Allotements actifs recouvrant le mois : bornes + jours ouverts (dow 0-6). */
  allotments: { starts_on: string; ends_on: string; weekdays: number[] | null }[];
};

const pad = (n: number) => String(n).padStart(2, "0");

export async function loadMonthAvailability(productId: string, year: number, month: number): Promise<MonthAvailability> {
  const empty: MonthAvailability = { days: {}, allotments: [] };
  if (!productId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return empty;
  const first = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const last = `${year}-${pad(month)}-${pad(lastDay)}`;

  const supabase = await createClient();
  const [daysRes, allotRes] = await Promise.all([
    supabase.from("allotment_days").select("day, quota, sold, released").eq("product_id", productId).gte("day", first).lte("day", last),
    supabase
      .from("allotments")
      .select("starts_on, ends_on, weekdays")
      .eq("product_id", productId)
      .eq("is_active", true)
      .lte("starts_on", last)
      .gte("ends_on", first),
  ]);
  const days: MonthAvailability["days"] = {};
  for (const d of (daysRes.data ?? []) as any[]) {
    days[d.day] = { quota: Number(d.quota), sold: Number(d.sold), released: Boolean(d.released) };
  }
  return {
    days,
    allotments: ((allotRes.data ?? []) as any[]).map((a) => ({
      starts_on: a.starts_on,
      ends_on: a.ends_on,
      weekdays: Array.isArray(a.weekdays) ? a.weekdays.map(Number) : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Doublon : même client, même produit, même date, non annulé
// ---------------------------------------------------------------------------

export type DuplicateDossier = { id: string; reference: string; status: string } | null;

export async function checkDuplicateDossier(customerId: string, productId: string, date: string): Promise<DuplicateDossier> {
  if (!customerId || !productId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select("id, reference, status")
    .eq("customer_id", customerId)
    .eq("circuit_id", productId)
    .eq("departure_date", date)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DuplicateDossier) ?? null;
}
