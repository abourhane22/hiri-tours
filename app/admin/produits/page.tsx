import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Compass, Mountain, Car, Hotel, BedDouble, Plane, Wrench, Image as ImageIcon } from "lucide-react";
import { formatMAD } from "@/lib/utils";
import type { CircuitCategory } from "@/lib/types";

const CATEGORY_CONFIG: Record<CircuitCategory, { label: string; subtitle: string; icon: any; bgIcon: string; textIcon: string }> = {
  circuit:     { label: "Circuits",     subtitle: "Voyages sur plusieurs jours",          icon: Compass,   bgIcon: "bg-atlantic-100", textIcon: "text-atlantic-700" },
  excursion:   { label: "Excursions",   subtitle: "Sorties à la journée ou demi-journée", icon: Mountain,  bgIcon: "bg-emerald-100",  textIcon: "text-emerald-800" },
  transfert:   { label: "Transferts",   subtitle: "Trajets ponctuels",                    icon: Car,       bgIcon: "bg-sand-200",     textIcon: "text-sand-800" },
  sejour:      { label: "Séjours",      subtitle: "Forfaits packagés, par personne",      icon: Hotel,     bgIcon: "bg-amber-100",    textIcon: "text-amber-800" },
  hebergement: { label: "Hébergements", subtitle: "Nuitées sèches, par chambre",          icon: BedDouble, bgIcon: "bg-purple-100",   textIcon: "text-purple-800" },
  billetterie: { label: "Billetterie",  subtitle: "Titres de transport ou d'entrée",      icon: Plane,     bgIcon: "bg-sky-100",      textIcon: "text-sky-800" },
  prestation:  { label: "Prestations",  subtitle: "Services à l'unité",                   icon: Wrench,    bgIcon: "bg-stone-200",    textIcon: "text-stone-800" },
};
const CATEGORY_ORDER: CircuitCategory[] = ["circuit", "excursion", "transfert", "sejour", "hebergement", "billetterie", "prestation"];

type Row = {
  id: string;
  slug: string;
  title: string;
  category: CircuitCategory;
  short_description: string | null;
  duration_days: number | null;
  duration_hours: number | null;
  base_price_mad: number;
  child_price_mad: number | null;
  max_participants: number | null;
  is_active: boolean;
  hero_image_url: string | null;
  category_fields: Record<string, unknown> | null;
};

export default async function CircuitsPage({ searchParams }: { searchParams: Promise<{ distribution?: string }> }) {
  const { distribution } = await searchParams;
  const showDistribution = distribution === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: circuits } = await supabase
    .from("circuits")
    .select("id, slug, title, category, short_description, duration_days, duration_hours, base_price_mad, child_price_mad, max_participants, is_active, hero_image_url, category_fields")
    .order("title", { ascending: true });

  const all = (circuits || []) as Row[];
  // Produits créés depuis la distribution aérienne (une offre = un produit,
  // inactif) : masqués par défaut pour ne pas polluer le catalogue.
  const isDistribution = (c: Row) => (c.category_fields as any)?.source === "duffel";
  const fromDistribution = all.filter(isDistribution);
  const items = showDistribution ? fromDistribution : all.filter((c) => !isDistribution(c));

  const groups = Object.fromEntries(CATEGORY_ORDER.map((k) => [k, [] as Row[]])) as Record<CircuitCategory, Row[]>;
  for (const c of items) {
    const cat = (c.category || "circuit") as CircuitCategory;
    if (groups[cat]) groups[cat].push(c);
  }

  const chip = (active: boolean) =>
    `inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition-colors ${
      active ? "bg-[#1A1F2E] text-white border-[#1A1F2E]" : "bg-white text-[#58524A] border-[#E0DACF] hover:bg-[#FBF9F5]"
    }`;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">Catalogue</p>
          <h1 className="font-display text-3xl text-ink">Produits</h1>
          <p className="text-sm text-sand-700 mt-1">
            {items.length} produit{items.length > 1 ? "s" : ""} {showDistribution ? "issu" : "regroupé"}{items.length > 1 ? "s" : ""}{" "}
            {showDistribution ? "de la distribution aérienne" : "par type"}
          </p>
        </div>
        <Link href="/admin/produits/new"><Button><Plus className="size-4" />Nouveau produit</Button></Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Link href="/admin/produits" className={chip(!showDistribution)}>Catalogue</Link>
        <Link href="/admin/produits?distribution=1" className={chip(showDistribution)}>
          Issus de la distribution ({fromDistribution.length})
        </Link>
        {showDistribution && (
          <span className="text-[11.5px] text-sand-600 ml-1">
            Un produit par offre réservée, inactif — jamais en vitrine. Ouvrez le dossier depuis la fiche.
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-sand-700">
            {showDistribution ? "Aucun produit issu de la distribution aérienne pour l'instant." : "Aucun produit. Créez-en un pour commencer."}
          </div>
        </Card>
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
                    <Link key={c.id} href={`/admin/produits/${c.id}`} className="block">
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
                            <div className="flex items-center gap-1 shrink-0">
                              {isDistribution(c) && <span className="text-[10px] uppercase font-medium text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded">Duffel</span>}
                              {!c.is_active && <span className="text-[10px] uppercase font-medium text-sand-600 bg-sand-100 px-1.5 py-0.5 rounded">Inactif</span>}
                            </div>
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
