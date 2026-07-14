import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const staffRoles = ["admin", "commercial", "comptable"];
  if (profile && staffRoles.includes(profile.role)) {
    redirect("/admin");
  }

  // Authentifié mais sans accès staff
  redirect(
    "/login?error=" +
      encodeURIComponent(
        "Votre compte n'a pas les droits d'accès à la plateforme. Contactez un administrateur."
      )
  );
}
