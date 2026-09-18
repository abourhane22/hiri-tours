import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Release automatique des allotements à J−release_days.
// Calqué sur /api/complete-departed : même contrôle du secret Vercel Cron,
// même client service-role, même forme de réponse. Une seule opération : la
// fonction release_due_allotments() porte la transaction et la logique.
//
// Canari : cette fonction n'est exécutable QUE par le service_role. Si la clé
// Vercel n'était pas la bonne, cet appel échouerait avec une erreur explicite
// dès le lendemain 07:00.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("release_due_allotments");

    if (error) {
      console.error("[release-allotments] Supabase error:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const n = typeof data === "number" ? data : Number(data) || 0;
    console.log(`[release-allotments] OK — ${n} jour(s) d'allotement libéré(s)`);
    return NextResponse.json({ ok: true, released: n });
  } catch (e: any) {
    console.error("[release-allotments] Unexpected error:", e?.message);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
