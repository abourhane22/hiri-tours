import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Compass, Car, Phone, Mail, ArrowLeft } from "lucide-react";

type Role = "guide" | "driver" | "both";

const ROLE_CONFIG: Record<Role, { label: string; subtitle: string; icon: any; bgIcon: string; textIcon: string }> = {
  guide:  { label: "Guides",      subtitle: "Accompagnement et animation", icon: Compass, bgIcon: "bg-atlantic-100", textIcon: "text-atlantic-700" },
  both:   { label: "Polyvalents", subtitle: "Guide + chauffeur",           icon: Users,   bgIcon: "bg-emerald-100",  textIcon: "text-emerald-800" },
  driver: { label: "Chauffeurs",  subtitle: "Conduite et logistique",      icon: Car,     bgIcon: "bg-sand-200",     textIcon: "text-sand-800" },
};
const ROLE_ORDER: Role[] = ["guide", "both", "driver"];

function getInitials(name: string): string {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

export default async function EquipePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: staff } = await supabase
    .from("staff_members")
    .select("id, full_name, role, phone, email, languages, is_active, notes")
    .order("full_name", { ascending: true });

  const items = staff || [];
  const groups: Record<Role, typeof items> = { guide: [], driver: [], both: [] };
  for (const s of items) {
    const r = (s.role || "guide") as Role;
    if (groups[r]) groups[r].push(s);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/admin/logistique" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour à Logistique
      </Link>

      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">Logistique</p>
          <h1 className="font-display text-3xl text-ink">Équipe</h1>
          <p className="text-sm text-sand-700 mt-1">{items.length} membre{items.length > 1 ? "s" : ""} regroupé{items.length > 1 ? "s" : ""} par rôle</p>
        </div>
        <Link href="/admin/logistique/equipe/new"><Button><Plus className="size-4" />Ajouter un membre</Button></Link>
      </div>

      {items.length === 0 ? (
        <Card><div className="p-8 text-center text-sand-700">Aucun membre. Ajoutez-en un avec le bouton ci-dessus.</div></Card>
      ) : (
        <div className="space-y-8">
          {ROLE_ORDER.map(role => {
            const list = groups[role];
            if (list.length === 0) return null;
            const cfg = ROLE_CONFIG[role];
            const Icon = cfg.icon;
            return (
              <div key={role}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className={`size-9 rounded-md flex items-center justify-center ${cfg.bgIcon} ${cfg.textIcon}`}><Icon className="size-5" /></span>
                  <div>
                    <h2 className="font-display text-xl text-ink m-0">{cfg.label}</h2>
                    <p className="text-xs text-sand-700 mt-0.5">{cfg.subtitle} · {list.length} membre{list.length > 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                  {list.map(s => {
                    const langs = (s.languages as string[] | null) || [];
                    return (
                      <Link key={s.id} href={`/admin/logistique/equipe/${s.id}`} className="block">
                        <div className={`bg-white border border-sand-200 rounded-lg p-3 hover:shadow-sm hover:border-sand-300 transition h-full ${!s.is_active ? "opacity-60" : ""}`}>
                          <div className="flex gap-3 items-center mb-3">
                            <div className={`size-10 rounded-full flex items-center justify-center font-medium text-sm flex-shrink-0 ${cfg.bgIcon} ${cfg.textIcon}`}>
                              {getInitials(s.full_name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-ink truncate">{s.full_name}</div>
                              <div className="text-[11px] text-sand-700">{cfg.label.replace(/s$/, "")}{!s.is_active && " · Inactif"}</div>
                            </div>
                          </div>
                          {langs.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2.5">
                              {langs.slice(0, 5).map(l => (
                                <span key={l} className="text-[10px] bg-sand-100 text-sand-800 px-1.5 py-0.5 rounded">{l}</span>
                              ))}
                            </div>
                          )}
                          <div className="space-y-1 pt-2 border-t border-sand-100">
                            {s.phone && (
                              <div className="flex items-center gap-1.5 text-[11px] text-sand-700">
                                <Phone className="size-3" />{s.phone}
                              </div>
                            )}
                            {s.email && (
                              <div className="flex items-center gap-1.5 text-[11px] text-sand-700 truncate">
                                <Mail className="size-3 flex-shrink-0" /><span className="truncate">{s.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
