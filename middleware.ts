import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - payer (parcours de paiement PUBLIC — pas de session, lecture service-role)
     * - image files
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|payer|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
