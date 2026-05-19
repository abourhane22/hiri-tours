import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { ArrowLeft, Plus } from "lucide-react";
import type { StaffMember } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = { guide: "Guide", driver: "Chauffeur", both: "Guide + Chauffeur" };

export default async function EquipePage() {
  const supabase = await createClient();
  const { data: staff } = await supabase.from("staff_members").select("*").order("full_name");

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/admin/logistique" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour à la logistique
      </Link>

      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Module 5 — Logistique</p>
          <h1 className="font-display text-3xl text-ink">Équipe</h1>
        </div>
        <Link href="/admin/logistique/equipe/new"><Button><Plus className="size-4" />Nouveau membre</Button></Link>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Nom</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Rôle</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Contact</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Langues</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {staff && staff.length > 0 ? (staff as StaffMember[]).map((m) => (
              <tr key={m.id} className="hover:bg-sand-50">
                <td className="px-5 py-4">
                  <Link href={`/admin/logistique/equipe/${m.id}`} className="text-ink font-medium hover:text-terracotta-600">{m.full_name}</Link>
                </td>
                <td className="px-5 py-4 text-sand-800">{ROLE_LABELS[m.role] ?? m.role}</td>
                <td className="px-5 py-4 text-sand-800 text-xs">
                  {m.phone && <div>{m.phone}</div>}
                  {m.email && <div className="text-sand-600">{m.email}</div>}
                </td>
                <td className="px-5 py-4 text-sand-800 text-xs">{m.languages?.join(", ") ?? "—"}</td>
                <td className="px-5 py-4"><Badge tone={m.is_active ? "success" : "neutral"}>{m.is_active ? "Actif" : "Inactif"}</Badge></td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-sand-700">Aucun membre. Ajoutez-en un avec le bouton ci-dessus.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
