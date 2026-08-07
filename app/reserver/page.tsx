import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMAD } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  circuit: "Circuit",
  excursion: "Excursion",
  transfert: "Transfert",
  sejour: "Séjour",
};

export default async function ReserverCatalogPage() {
  const supabase = createAdminClient();
  const { data: circuits } = await supabase
    .from("circuits")
    .select("id, title, slug, category, short_description, hero_image_url, base_price_mad")
    .eq("is_active", true)
    .order("base_price_mad", { ascending: true });

  const list = (circuits ?? []) as any[];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[#C84B31] font-medium">
          Nos prestations
        </p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Réservez en ligne</h1>
        <p className="text-sm text-[#6B6862] mt-1.5">
          Choisissez votre excursion ou circuit, sélectionnez votre date et réglez en toute
          sécurité.
        </p>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-[#968F84] py-10 text-center">
          Aucune prestation disponible pour le moment.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/reserver/${c.id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-[#E5E0D7] bg-white transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#0C6B8A] to-[#1A1F2E]">
                {c.hero_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.hero_image_url}
                    alt={c.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                <span className="absolute top-2 left-2 inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-[#1A1F2E]">
                  {CATEGORY_LABEL[c.category] ?? c.category}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="font-display text-lg text-[#1A1F2E] leading-snug">{c.title}</h2>
                {c.short_description && (
                  <p className="mt-1 text-[13px] text-[#6B6862] line-clamp-2">
                    {c.short_description}
                  </p>
                )}
                <div className="mt-3 flex items-end justify-between pt-2">
                  <div>
                    <div className="text-[11px] text-[#968F84]">à partir de</div>
                    <div className="font-display text-lg text-[#0F6E56] tabular-nums">
                      {formatMAD(Number(c.base_price_mad))}
                      <span className="text-[11px] font-normal text-[#968F84]"> / pers.</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#1A1F2E] px-3 py-1.5 text-[13px] font-medium text-white transition-colors group-hover:bg-[#2A3142]">
                    Réserver
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
