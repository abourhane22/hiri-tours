import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Sécurité : vérifier le secret passé par Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    // Requête la plus légère possible — juste de quoi marquer la base "active"
    const { error } = await supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      console.error("[keep-alive] Supabase error:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    console.log("[keep-alive] OK", new Date().toISOString());
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (e: any) {
    console.error("[keep-alive] Unexpected error:", e?.message);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
