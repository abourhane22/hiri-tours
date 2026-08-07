"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, normalizeEmail } from "@/lib/customers";
import { seasonMultiplier, computeReservationTotal } from "@/lib/pricing";
import { sendBookingConfirmation } from "@/lib/email";
import { ensureAccessToken, suiviUrl } from "@/lib/access-token";

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
  | { ok: true; id: string | null; reference: string; emailSent: boolean; suiviUrl: string | null }
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

/** True si l'IP a dépassé MAX_PER_HOUR requêtes de ce type sur la dernière heure. */
async function rateLimited(
  supabase: ReturnType<typeof createAdminClient>,
  ip: string,
  kind: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("public_request_log")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("kind", kind)
    .gte("created_at", since);
  return (count ?? 0) >= MAX_PER_HOUR;
}

export async function createPublicReservation(
  input: PublicReservationInput,
): Promise<PublicReservationResult> {
  // (a) Honeypot : un bot remplit le champ caché → succès factice, zéro écriture.
  if (input.website && input.website.trim() !== "") {
    return { ok: true, id: null, reference: "AG-DEMO", emailSent: false, suiviUrl: null };
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
  if (await rateLimited(supabase, ip, "reservation")) {
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

  // Jeton de suivi (lien de consultation longue durée).
  let suivi: string | null = null;
  try {
    suivi = suiviUrl(await ensureAccessToken(supabase, id));
  } catch (e) {
    console.error("[createPublicReservation] token:", e);
  }

  // Récapitulatif par email (service-role pour lire malgré l'absence de session).
  let emailSent = false;
  try {
    const res = await sendBookingConfirmation(id, supabase);
    emailSent = res.success === true;
  } catch (e) {
    console.error("[createPublicReservation] email:", e);
  }

  return { ok: true, id, reference, emailSent, suiviUrl: suivi };
}

// ---------------------------------------------------------------------------
// Suivi en libre-service : retrouver un dossier par référence + contact
// ---------------------------------------------------------------------------

export type TrackingState = { error: string } | null;

const TRACKING_FAIL =
  "Aucun dossier ne correspond à ces informations. Vérifiez votre référence et vos coordonnées.";

/**
 * Retrouve une réservation par (référence + email OU téléphone du client),
 * puis redirige vers sa page de suivi tokenisée. Message d'échec identique
 * que la référence soit inconnue ou le contact différent (ne rien révéler).
 */
export async function findReservationForTracking(
  _prev: TrackingState,
  formData: FormData,
): Promise<TrackingState> {
  // Honeypot : on ne révèle rien, on renvoie l'échec générique.
  if (((formData.get("website") as string) || "").trim() !== "") {
    return { error: TRACKING_FAIL };
  }

  const reference = ((formData.get("reference") as string) || "").trim().toUpperCase();
  const contactRaw = ((formData.get("contact") as string) || "").trim();
  if (!reference || !contactRaw) return { error: TRACKING_FAIL };

  const isEmail = contactRaw.includes("@");
  const normContact = isEmail ? normalizeEmail(contactRaw) : normalizePhone(contactRaw);
  if (!normContact) return { error: TRACKING_FAIL };

  const supabase = createAdminClient();

  // Rate-limit dédié à cette action.
  const ip = await requestIp();
  if (await rateLimited(supabase, ip, "tracking")) {
    return { error: "Trop de tentatives, réessayez plus tard." };
  }
  await supabase.from("public_request_log").insert({ ip, kind: "tracking" });

  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, customers(email, phone_normalized)")
    .eq("reference", reference)
    .maybeSingle();

  if (!reservation) return { error: TRACKING_FAIL };
  const cust = (reservation as any).customers;

  const matches = isEmail
    ? normalizeEmail(cust?.email) === normContact
    : (cust?.phone_normalized ?? null) === normContact;

  if (!matches) return { error: TRACKING_FAIL };

  const token = await ensureAccessToken(supabase, (reservation as any).id);
  redirect(`/reserver/suivi/${token}`);
}
