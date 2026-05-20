import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Compass, Mountain, Car, Hotel, Image as ImageIcon } from "lucide-react";
import { formatMAD } from "@/lib/utils";

type Category = "circuit" | "excursion" | "transfert" | "sejour";

const CATEGORY_CONFIG: Record<Category, { label: string; subtitle: string; icon: any; bgIcon: string; textIcon: string }> = {
  circuit:   { label: "Circuits",   subtitle: "Voyages sur plusieurs jours",          icon: Compass,  bgIcon: "bg-atlantic-100", textIcon: "text-atlantic-700" },
  excursion: { label: "Excursions", subtitle: "Sorties à la journée ou demi-journée", icon: Mountain, bgIcon: "bg-emerald-100",  textIcon: "text-emerald-800" },
  transfert: { label: "Transferts", subtitle: "Trajets ponctuels",                    icon: Car,      bgIcon: "bg-sand-200",     textIcon: "text-sand-800" },
  sejour:    { label: "Séjours",    subtitle: "Hébergement + activités",              icon: Hotel,    bgIcon: "bg-amber-100",    textIcon: "text-amber-800" },
};
const CATEGORY_ORDER: Category[] = ["circuit", "excursion", "transfert", "sejour"];

export default async function CircuitsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: circuits } = await supabase
    .from("circuits")
    .select("id, slug, title, category, short_description, duration_days, duration_hours, base_price_mad, child_price_mad, max_participants, is_active, hero_image_url")
    .order("title", { ascending: true });

  const items = circuits || [];
  const groups: Record<Category, typeof items> = { circuit: [], excursion: [], transfert: [], sejour: [] };
  for (const c of items) {
    const cat = (c.category || "circuit") as Category;
    if (groups[cat]) groups[cat].push(c);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">Catalogue</p>
          <h1 className="font-display text-3xl text-ink">Circuits & excursions</h1>
          <p className="text-sm text-sand-700 mt-1">{items.length} produit{items.length > 1 ? "s" : ""} regroupé{items.length > 1 ? "s" : ""} par catégorie</p>
        </div>
        <Link href="/admin/circuits/new"><Button><Plus className="size-4" />Nouveau produit</Button></Link>
      </div>

      {items.length === 0 ? (
        <Card><div className="p-8 text-center text-sand-700">Aucun circuit. Créez-en un pour commencer.</div></Card>
      ) : (
        <div className="space-y-8">
          {CATEGORY_ORDER.map(cat => {
            const list = groups[cat];
            if (list.length === 0) return null;
            const cfg = CATEGORY_CONFIG[cat];
            const Icon = cfg.icon;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className={`size-9 rounded-md flex items-center justify-center ${cfg.bgIcon} ${cfg.textIcon}`}><Icon className="size-5" /></span>
                  <div>
                    <h2 className="font-display text-xl text-ink m-0">{cfg.label}</h2>
                    <p className="text-xs text-sand-700 mt-0.5">{cfg.subtitle} · {list.length} produit{list.length > 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                  {list.map(c => (
                    <Link key={c.id} href={`/admin/circuits/${c.id}`} className="block">
                      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden hover:shadow-sm hover:border-sand-300 transition h-full">
                        {c.hero_image_url ? (
                          <div className="aspect-[16/9] bg-sand-100 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c.hero_image_url} alt={c.title} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="aspect-[16/9] bg-sand-100 flex items-center justify-center">
                            <ImageIcon className="size-8 text-sand-400" />
                          </div>
                        )}
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="font-medium text-sm text-ink line-clamp-1">{c.title}</div>
                            {!c.is_active && <span className="text-[10px] uppercase font-medium text-sand-600 bg-sand-100 px-1.5 py-0.5 rounded shrink-0">Inactif</span>}
                          </div>
                          <div className="text-[11px] text-sand-700 line-clamp-2 mb-2 min-h-[28px]">{c.short_description || "—"}</div>
                          <div className="flex justify-between items-end pt-2 border-t border-sand-100">
                            <div className="text-[11px] text-sand-600">
                              {c.duration_days && c.duration_days > 1 ? `${c.duration_days} jours` : c.duration_hours ? `${c.duration_hours} h` : "Durée à définir"}
                              {c.max_participants ? ` · max ${c.max_participants} pax` : ""}
                            </div>
                            <div className="font-medium text-sm tabular-nums">{formatMAD(c.base_price_mad)}</div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
