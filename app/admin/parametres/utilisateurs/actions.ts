"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type UserRole, BACKOFFICE_ROLES } from "@/lib/permissions";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Accès réservé aux administrateurs");
  return { supabase, adminClient: createAdminClient(), user };
}

export async function inviteUser(formData: FormData) {
  const { supabase: callerSupabase } = await requireAdmin();
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  const fullName = ((formData.get("full_name") as string) || "").trim();
  const role = (formData.get("role") as string) as UserRole;

  if (!email) throw new Error("L'email est obligatoire");
  if (!fullName) throw new Error("Le nom complet est obligatoire");
  if (!BACKOFFICE_ROLES.includes(role)) throw new Error("Rôle invalide");

  const admin = createAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || "https://hiri-tours.vercel.app"}/auth/callback?type=invite`;

  let userId: string;
  let wasResent = false;

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });

  if (inviteError) {
    const msg = inviteError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      const { data: listData, error: listError } = await admin.auth.admin.listUsers();
      if (listError) throw new Error(`Recherche impossible : ${listError.message}`);
      const existing = listData.users.find(u => (u.email ?? "").toLowerCase() === email);
      if (!existing) throw new Error("Utilisateur introuvable malgré erreur 'déjà enregistré'");
      userId = existing.id;

      const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetError) throw new Error(`Renvoi du lien échoué : ${resetError.message}`);
      wasResent = true;
    } else {
      throw new Error(`Échec de l'invitation : ${inviteError.message}`);
    }
  } else {
    if (!inviteData.user) throw new Error("Utilisateur non créé");
    userId = inviteData.user.id;
  }

  const { error: profileErr } = await admin.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    role,
    is_active: true,
  }, { onConflict: "id" });
  if (profileErr) throw new Error(`Profil non mis à jour : ${profileErr.message}`);

  revalidatePath("/admin/parametres/utilisateurs");
  redirect(`/admin/parametres/utilisateurs?invited=1${wasResent ? "&resent=1" : ""}`);
}

export async function updateUserRole(userId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const role = formData.get("role") as UserRole;
  if (!role) throw new Error("Rôle invalide");
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/parametres/utilisateurs");
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const { supabase, user: caller } = await requireAdmin();
  if (caller.id === userId) throw new Error("Vous ne pouvez pas modifier votre propre statut.");

  if (isActive) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (profile?.role === "admin") {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true);
      if ((count ?? 0) <= 1) throw new Error("Impossible : dernier administrateur actif.");
    }
  }

  const { error } = await supabase.from("profiles").update({ is_active: !isActive }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/parametres/utilisateurs");
}
