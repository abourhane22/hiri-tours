import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LAST_ACTIVITY_COOKIE } from "@/lib/auth-timeout";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // "/" est la vitrine publique → la déconnexion backoffice renvoie au login.
  const res = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  res.cookies.delete(LAST_ACTIVITY_COOKIE);
  return res;
}
