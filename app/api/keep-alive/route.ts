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
    // Client service-role : bypass RLS pour écrire dans keep_alive sans policy dédiée.
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("keep_alive")
      .upsert({ id: 1, last_ping: new Date().toISOString() });

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
