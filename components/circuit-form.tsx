"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Info, ShieldCheck, Image as ImageIcon } from "lucide-react";
import { formatMAD } from "@/lib/utils";
import { AlertBanner } from "@/components/ui/alert-banner";
import { ImageUpload } from "@/components/image-upload";
import { GalleryEditor } from "@/components/gallery-editor";
import { CategorySpecificFields } from "@/components/category-fields-section";
import type { CircuitActionState } from "@/app/admin/circuits/actions";
import type { AnyCategoryFields } from "@/lib/category-fields";
import type { CircuitCategory } from "@/lib/types";

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

const TYPE_LABEL: Record<string, string> = {
  circuit: "Multi-jours",
  excursion: "Journée",
  transfert: "Point à point",
  sejour: "Nuitées",
};

export type CircuitFormDefaults = {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  basePrice: string;
  childPrice: string;
  maxParticipants: string;
  category: CircuitCategory;
  categoryFields: AnyCategoryFields;
  heroImageUrl: string;
  galleryUrls: string[] | null;
  isActive: boolean;
  dayCount: number;
};

type Action = (prev: CircuitActionState, formData: FormData) => Promise<CircuitActionState>;

export function CircuitForm({
  mode,
  action,
  defaults,
}: {
  mode: "create" | "edit";
  action: Action;
  defaults: CircuitFormDefaults;
}) {
  const [state, formAction, isPending] = useActionState<CircuitActionState, FormData>(
    action,
    { ok: true },
  );

  const [category, setCategory] = useState<CircuitCategory>(defaults.category);
  const [title, setTitle] = useState(defaults.title);
  const [basePrice, setBasePrice] = useState(defaults.basePrice);
  const [maxParticipants, setMaxParticipants] = useState(defaults.maxParticipants);
  const [isActive, setIsActive] = useState(defaults.isActive);
  const [dayCount, setDayCount] = useState(defaults.dayCount || 1);
  const [imageUrl, setImageUrl] = useState(defaults.heroImageUrl);

  const categoryChanged = category !== defaults.category;
  const seedFields: AnyCategoryFields = categoryChanged ? {} : defaults.categoryFields;

  const priceNum = Number(basePrice) || 0;
  const maxNum = Number(maxParticipants) || 0;
  const durationLabel =
    category === "circuit"
      ? `${dayCount || 1} jour${(dayCount || 1) > 1 ? "s" : ""}`
      : TYPE_LABEL[category] ?? "—";

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-[1fr_250px] items-start">
      <div className="space-y-4">
        {/* Section 1 — Informations générales */}
        <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <SectionHeader n={1} title="Informations générales" />
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="sm:col-span-2">
              <label htmlFor="category" className={labelCls}>
                Catégorie <span className="text-red-600">*</span>
              </label>
              <select
                id="category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CircuitCategory)}
                required
                className={fieldCls}
              >
                <option value="circuit">Circuit</option>
                <option value="excursion">Excursion</option>
                <option value="transfert">Transfert</option>
                <option value="sejour">Séjour</option>
              </select>
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[#968F84]">
                <Info className="size-3.5 shrink-0 mt-px" />
                Changer de catégorie réinitialise les champs spécifiques.
                {categoryChanged && (
                  <span className="text-[#B25F0B] font-medium"> Champs réinitialisés.</span>
                )}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="title" className={labelCls}>
                Titre <span className="text-red-600">*</span>
              </label>
              <input
                id="title"
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Paradise Valley & Tafraout"
                className={fieldCls}
              />
            </div>
            <div>
              <label htmlFor="slug" className={labelCls}>
                Slug (URL) <span className="text-red-600">*</span>
              </label>
              <input
                id="slug"
                name="slug"
                required
                pattern="[a-z0-9\-]+"
                defaultValue={defaults.slug}
                placeholder="paradise-valley-tafraout"
                className={fieldCls}
              />
            </div>
            <div>
              <label htmlFor="short_description" className={labelCls}>
                Description courte
              </label>
              <input
                id="short_description"
                name="short_description"
                defaultValue={defaults.shortDescription}
                placeholder="Une phrase qui donne envie."
                className={fieldCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="description" className={labelCls}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={defaults.description}
                placeholder="Ce que le client vivra, en 2 phrases."
                className={`${fieldCls} h-auto py-2`}
              />
            </div>
          </div>
        </section>

        {/* Section 2 — Tarification & capacité */}
        <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <SectionHeader n={2} title="Tarification & capacité" />
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="base_price_mad" className={labelCls}>
                Prix adulte (MAD) <span className="text-red-600">*</span>
              </label>
              <input
                id="base_price_mad"
                name="base_price_mad"
                type="number"
                min="0"
                step="0.01"
                required
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className={fieldCls}
              />
            </div>
            <div>
              <label htmlFor="child_price_mad" className={labelCls}>
                Prix enfant (MAD)
              </label>
              <input
                id="child_price_mad"
                name="child_price_mad"
                type="number"
                min="0"
                step="0.01"
                defaultValue={defaults.childPrice}
                placeholder="= prix adulte si vide"
                className={fieldCls}
              />
            </div>
            <div>
              <label htmlFor="max_participants" className={labelCls}>
                Capacité max (pax) <span className="text-red-600">*</span>
              </label>
              <input
                id="max_participants"
                name="max_participants"
                type="number"
                min="1"
                required
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className={fieldCls}
              />
            </div>
            <div className="flex items-end">
              {mode === "edit" ? (
                <a href="#seasons" className="text-[12px] text-[#0C6B8A] hover:underline pb-2.5">
                  Saisons tarifaires — gérées ci-dessous →
                </a>
              ) : (
                <p className="text-[12px] text-[#968F84] pb-2.5">
                  Saisons tarifaires — gérées après création
                </p>
              )}
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-[#968F84]">
            <ShieldCheck className="size-3.5 shrink-0 mt-px text-[#0F6E56]" />
            Le total d&apos;une réservation est recalculé côté serveur : prix × passagers × saison.
          </p>
        </section>

        {/* Section 3 — catégorie : champs spécifiques */}
        <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <CategorySpecificFields
            category={category}
            seedFields={seedFields}
            sectionNumber={3}
            onDayCountChange={setDayCount}
          />
        </section>

        {/* Médias */}
        <section className="bg-white border border-[#E5E0D7] rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-4 text-[#968F84]" />
            <h2 className="font-display text-base text-[#1A1F2E] m-0">Médias</h2>
          </div>
          <ImageUpload
            name="hero_image_url"
            label="Image principale"
            defaultValue={defaults.heroImageUrl}
            onChange={setImageUrl}
          />
          <GalleryEditor name="gallery_urls" defaultValue={defaults.galleryUrls} />
        </section>

        {state && !state.ok && (
          <AlertBanner tone="error" message={state.error} />
        )}
      </div>

      {/* Panneau latéral */}
      <div className="space-y-3 lg:sticky lg:top-4">
        <div className="bg-white border border-[#E5E0D7] rounded-xl overflow-hidden">
          <div className="h-[84px] w-full">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundImage: "linear-gradient(135deg,#2A4A5C,#C26B3D)" }}
              >
                <ImageIcon className="size-6 text-white/70" />
              </div>
            )}
          </div>
          <div className="p-4">
            <p className="text-[10px] tracking-[1.5px] uppercase text-[#968F84] font-medium">
              Aperçu catalogue
            </p>
            <p className="font-medium text-[13.5px] text-[#1A1F2E] mt-1.5 line-clamp-2">
              {title.trim() || "Titre du produit"}
            </p>
            <p className="text-[11.5px] text-[#968F84] mt-0.5">
              {durationLabel} · max {maxNum} pax
            </p>
            <p className="mt-2">
              <span className="font-display text-xl text-[#1A1F2E] tabular-nums">
                {formatMAD(priceNum)}
              </span>
              <span className="text-[11px] text-[#968F84]"> / pers.</span>
            </p>
          </div>
          <div className="px-4 py-3 border-t border-[#EBE6DC] flex items-center justify-between">
            <span className="text-[12px] text-[#58524A]">Visible à la vente</span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                name="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="peer sr-only"
              />
              <span
                className="h-[19px] w-[34px] rounded-full bg-[#D6D0C4] transition-colors peer-checked:bg-[#0F6E56] after:absolute after:left-[2px] after:top-[2px] after:size-[15px] after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-[15px]"
                aria-hidden
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1A1F2E] py-2.5 text-white text-sm font-medium hover:bg-[#2A3142] transition-colors disabled:opacity-60"
        >
          <Check className="size-4" />
          {isPending
            ? "Enregistrement…"
            : mode === "create"
              ? "Créer le produit"
              : "Enregistrer"}
        </button>
        <Link
          href="/admin/circuits"
          className="w-full inline-flex items-center justify-center rounded-lg border border-[#E0DACF] bg-white py-2.5 text-sm font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-5 rounded-md bg-[#1A1F2E] text-white text-[11px] font-medium flex items-center justify-center">
        {n}
      </span>
      <h2 className="font-display text-base text-[#1A1F2E] m-0">{title}</h2>
    </div>
  );
}
