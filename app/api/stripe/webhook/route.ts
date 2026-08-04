import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordExternalPayment } from "@/lib/payments";

// Signature vérifiée via crypto Node → runtime nodejs obligatoire.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!stripe) {
    console.error("[stripe-webhook] Stripe non configuré (STRIPE_SECRET_KEY absente)");
    return NextResponse.json({ error: "stripe not configured" }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET absente — webhook non vérifiable");
    return NextResponse.json({ error: "webhook secret missing" }, { status: 400 });
  }

  const sig = request.headers.get("stripe-signature");
  const rawBody = await request.text(); // RAW obligatoire pour la signature

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig ?? "", secret);
  } catch (e: any) {
    console.error("[stripe-webhook] signature invalide:", e?.message);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const reservationId = session.metadata?.reservation_id;
  const amountMad = Number(session.metadata?.amount_mad);
  const paymentLinkId = session.metadata?.payment_link_id || null;

  if (!reservationId || !Number.isFinite(amountMad)) {
    console.error("[stripe-webhook] metadata manquante ou invalide", session.id);
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();
  try {
    const res = await recordExternalPayment(supabase, {
      reservationId,
      amountMad,
      method: "stripe",
      source: "stripe",
      externalRef: session.id,
    });

    if (!res.ok) {
      console.error("[stripe-webhook] échec enregistrement:", res.error);
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    if (res.skipped) {
      console.log("[stripe-webhook] déjà traité (idempotence):", session.id);
      return NextResponse.json({ received: true });
    }

    if (paymentLinkId) {
      await supabase
        .from("payment_links")
        .update({ used_at: new Date().toISOString() })
        .eq("id", paymentLinkId)
        .is("used_at", null);
    }

    console.log(`[stripe-webhook] paiement enregistré ${session.id} → réservation ${reservationId}`);
    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("[stripe-webhook] exception:", e?.message);
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
