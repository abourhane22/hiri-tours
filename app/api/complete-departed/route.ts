import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Sécurité : vérifier le secret passé par Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Client service-role : bypass RLS pour mettre à jour les réservations.
    const supabase = createAdminClient();

    // Règle métier : une réservation PAYÉE dont le départ est passé devient
    // 'completed'. Les 'confirmed'/'pending' avec départ passé ne sont PAS
    // touchées (créance ouverte = décision humaine).
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("reservations")
      .update({ status: "completed" })
      .eq("status", "paid")
      .lt("departure_date", today)
      .select("id");

    if (error) {
      console.error("[complete-departed] Supabase error:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const n = data?.length ?? 0;
    console.log(`[complete-departed] OK — ${n} réservation(s) passée(s) à completed`);
    return NextResponse.json({ ok: true, completed: n });
  } catch (e: any) {
    console.error("[complete-departed] Unexpected error:", e?.message);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
