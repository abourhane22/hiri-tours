import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // "/" est la vitrine publique → la déconnexion backoffice renvoie au login.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
