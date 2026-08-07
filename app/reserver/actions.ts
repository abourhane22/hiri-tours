"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, normalizeEmail } from "@/lib/customers";
import { seasonMultiplier, computeReservationTotal } from "@/lib/pricing";
import { sendBookingConfirmation } from "@/lib/email";

export type PaymentChannel = "carte" | "virement" | "agence";

export type PublicReservationInput = {
  circuitId: string;
  date: string; // YYYY-MM-DD
  pax: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  channel: PaymentChannel;
  website?: string; // honeypot — doit rester vide
};

export type PublicReservationResult =
  | { ok: true; id: string | null; reference: string; emailSent: boolean }
  | { ok: false; error: string };

const MAX_PER_HOUR = 5;
const CHANNELS: PaymentChannel[] = ["carte", "virement", "agence"];

/** IP de la requête (best-effort derrière proxy Vercel). */
async function requestIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") || "unknown";
}

export async function createPublicReservation(
  input: PublicReservationInput,
): Promise<PublicReservationResult> {
  // (a) Honeypot : un bot remplit le champ caché → succès factice, zéro écriture.
  if (input.website && input.website.trim() !== "") {
    return { ok: true, id: null, reference: "AG-DEMO", emailSent: false };
  }

  // (c) Validation stricte des entrées.
  const firstName = (input.firstName || "").trim();
  const lastName = (input.lastName || "").trim();
  const phone = (input.phone || "").trim();
  const email = (input.email || "").trim();
  const date = (input.date || "").trim();
  const pax = Math.trunc(Number(input.pax));
  const channel = input.channel;

  if (!input.circuitId) return { ok: false, error: "Prestation manquante." };
  if (!firstName || !lastName) return { ok: false, error: "Nom et prénom obligatoires." };
  if (!phone) return { ok: false, error: "Téléphone obligatoire." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Email invalide." };
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Date de départ invalide." };
  }
  if (!CHANNELS.includes(channel)) return { ok: false, error: "Canal de paiement invalide." };
  if (!Number.isFinite(pax) || pax < 1) return { ok: false, error: "Nombre de passagers invalide." };

  // La date doit être strictement future.
  const todayStr = new Date().toISOString().slice(0, 10);
  if (date <= todayStr) return { ok: false, error: "La date de départ doit être future." };

  const supabase = createAdminClient();

  // (b) Rate-limit : max 5 créations / heure / IP.
  const ip = await requestIp();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("public_request_log")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_HOUR) {
    return { ok: false, error: "Trop de demandes, réessayez plus tard." };
  }

  // Recharge le circuit (prix + saisons + capacité) — jamais confiance au client.
  const { data: circuit, error: circuitError } = await supabase
    .from("circuits")
    .select(
      "id, is_active, base_price_mad, child_price_mad, max_participants, circuit_seasons(starts_on, ends_on, price_multiplier)",
    )
    .eq("id", input.circuitId)
    .maybeSingle();

  if (circuitError) return { ok: false, error: "Erreur de chargement de la prestation." };
  if (!circuit || !(circuit as any).is_active) {
    return { ok: false, error: "Cette prestation n'est plus disponible." };
  }
  const c = circuit as any;

  // Capacité (règle existante) — tunnel public = adultes uniquement.
  const maxPax = Number(c.max_participants) || 0;
  if (maxPax > 0 && pax > maxPax) {
    return { ok: false, error: `Cette prestation accepte au maximum ${maxPax} passagers.` };
  }

  // Total recalculé serveur (multiplicateur de saison inclus).
  const multiplier = seasonMultiplier(date, c.circuit_seasons);
  const serverTotal = computeReservationTotal({
    basePriceMad: c.base_price_mad,
    childPriceMad: c.child_price_mad,
    adults: pax,
    children: 0,
    multiplier,
  });

  // --- Rattachement client silencieux (service-role) ---
  const normPhone = normalizePhone(phone);
  const normEmail = normalizeEmail(email);
  let customerId: string | null = null;

  if (normPhone) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("phone_normalized", normPhone)
      .limit(1)
      .maybeSingle();
    if (data) customerId = (data as any).id;
  }
  if (!customerId && normEmail) {
    const { data } = await supabase
      .from("customers")
      .select("id, email")
      .ilike("email", normEmail)
      .limit(5);
    const match = ((data ?? []) as any[]).find((r) => normalizeEmail(r.email) === normEmail);
    if (match) customerId = match.id;
  }

  if (!customerId) {
    const fullName = `${firstName} ${lastName}`.trim();
    const { data: created, error: custErr } = await supabase
      .from("customers")
      .insert({
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        phone,
        phone_normalized: normPhone,
        email: email || null,
        country: null,
        acquisition_source: "website",
      })
      .select("id")
      .single();

    if (custErr) {
      // Collision d'index unique (créé entre-temps) → on retrouve la fiche.
      if ((custErr as any).code === "23505" && (normPhone || normEmail)) {
        const { data: again } = await supabase
          .from("customers")
          .select("id")
          .or(
            [
              normPhone ? `phone_normalized.eq.${normPhone}` : null,
              normEmail ? `email.ilike.${normEmail}` : null,
            ]
              .filter(Boolean)
              .join(","),
          )
          .limit(1)
          .maybeSingle();
        if (again) customerId = (again as any).id;
      }
      if (!customerId) {
        console.error("[createPublicReservation] customer insert:", custErr);
        return { ok: false, error: "Impossible d'enregistrer vos coordonnées." };
      }
    } else {
      customerId = (created as any).id;
    }
  }

  // --- Création de la réservation (status pending, total serveur) ---
  const { data: resa, error: resaErr } = await supabase
    .from("reservations")
    .insert({
      circuit_id: input.circuitId,
      customer_id: customerId,
      departure_date: date,
      adults: pax,
      children: 0,
      total_amount_mad: serverTotal,
      status: "pending",
      intended_payment_channel: channel,
      notes: `Réservation en ligne (tunnel public) · canal annoncé : ${channel}`,
    })
    .select("id, reference")
    .single();

  if (resaErr || !resa) {
    console.error("[createPublicReservation] reservation insert:", resaErr);
    return { ok: false, error: "Impossible de créer la réservation." };
  }

  const id = (resa as any).id as string;
  const reference = (resa as any).reference as string;

  // Journalise pour le rate-limit (best-effort).
  await supabase.from("public_request_log").insert({ ip, kind: "reservation" });

  // Récapitulatif par email (service-role pour lire malgré l'absence de session).
  let emailSent = false;
  try {
    const res = await sendBookingConfirmation(id, supabase);
    emailSent = res.success === true;
  } catch (e) {
    console.error("[createPublicReservation] email:", e);
  }

  return { ok: true, id, reference, emailSent };
}
