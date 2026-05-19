"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/permissions";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Accès réservé aux administrateurs");
  return { supabase, adminClient: createAdminClient(), user };
}

export async function inviteUser(formData: FormData) {
  const { adminClient } = await requireAdmin();
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  const role = (formData.get("role") as UserRole) || "commercial";
  if (!email) throw new Error("L'email est obligatoire");

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || "https://hiri-tours.vercel.app"}/auth/callback?type=invite`;
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { role },
    redirectTo,
  });
  if (error) throw new Error(error.message);

  if (data?.user?.id) {
    await adminClient.from("profiles").upsert({ id: data.user.id, role, is_active: true });
  }

  revalidatePath("/admin/parametres/utilisateurs");
  redirect("/admin/parametres/utilisateurs?invited=1");
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
