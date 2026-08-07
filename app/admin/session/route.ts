import { NextResponse } from "next/server";

// Ping léger « Rester connecté ». Étant sous /admin, la requête traverse le
// middleware qui rafraîchit le cookie last_activity (source de vérité).
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true });
}
