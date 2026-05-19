import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { ArrowLeft, UserPlus, CheckCircle2, XCircle } from "lucide-react";
import { ROLE_LABELS, BACKOFFICE_ROLES, PERMISSIONS_MATRIX, userCan } from "@/lib/permissions";
import { updateUserRole, toggleUserActive } from "./actions";

export default async function UtilisateursPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string }>;
}) {
  const { invited } = await searchParams;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 100 });
  const { data: profiles } = await supabase.from("profiles").select("id, role, is_active, updated_at");

  const rows = (authUsers ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      profile: profiles?.find((p) => p.id === u.id),
    }))
    .filter((u) => u.profile && BACKOFFICE_ROLES.includes(u.profile.role))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/admin/parametres" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Paramètres
      </Link>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Paramètres</p>
          <h1 className="font-display text-3xl text-ink">Gestion des utilisateurs</h1>
          <p className="text-sm text-sand-700 mt-1">{rows.length} utilisateur(s) backoffice</p>
        </div>
        <Link href="/admin/parametres/utilisateurs/inviter">
          <Button><UserPlus className="size-4" />Inviter un utilisateur</Button>
        </Link>
      </div>

      {invited && (
        <div className="mb-6 p-4 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          Invitation envoyée. L&apos;utilisateur recevra un email pour créer son mot de passe.
        </div>
      )}

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Email</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Rôle</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Statut</th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {rows.map((u) => {
              const isCurrentUser = u.id === currentUser?.id;
              const isActive = u.profile?.is_active ?? true;
              const role = u.profile?.role ?? "commercial";
              const toggleBound = toggleUserActive.bind(null, u.id, isActive);
              const updateRoleBound = updateUserRole.bind(null, u.id);
              return (
                <tr key={u.id} className="hover:bg-sand-50">
                  <td className="px-5 py-3 text-ink">
                    {u.email}
                    {isCurrentUser && <span className="ml-2 text-xs text-sand-500">(vous)</span>}
                  </td>
                  <td className="px-5 py-3">
                    <form action={updateRoleBound} className="flex items-center gap-2">
                      <Select name="role" defaultValue={role} className="text-sm py-1">
                        {BACKOFFICE_ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </Select>
                      <Button type="submit" variant="secondary" size="sm">OK</Button>
                    </form>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={isActive ? "success" : "neutral"}>
                      {isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!isCurrentUser && (
                      <form action={toggleBound} className="inline">
                        <Button type="submit" variant="secondary" size="sm">
                          {isActive ? (
                            <><XCircle className="size-3.5" />Désactiver</>
                          ) : (
                            <><CheckCircle2 className="size-3.5" />Activer</>
                          )}
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Matrice des permissions</h2>
          <p className="text-xs text-sand-700 mt-1">Ce que chaque rôle peut consulter dans le backoffice.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-50 border-b border-sand-200">
              <tr>
                <th className="text-left px-5 py-2 font-medium text-sand-800">Fonctionnalité</th>
                {BACKOFFICE_ROLES.map((r) => (
                  <th key={r} className="text-center px-4 py-2 font-medium text-sand-800">{ROLE_LABELS[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {PERMISSIONS_MATRIX.map(({ permission, label }) => (
                <tr key={permission} className="hover:bg-sand-50">
                  <td className="px-5 py-2.5 text-ink">{label}</td>
                  {BACKOFFICE_ROLES.map((r) => (
                    <td key={r} className="text-center px-4 py-2.5">
                      {userCan(r, permission) ? (
                        <CheckCircle2 className="size-4 text-emerald-600 mx-auto" />
                      ) : (
                        <XCircle className="size-4 text-sand-300 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
