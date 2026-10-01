"use client";

import { useActionState, useRef, useState } from "react";
import { useActionFeedback } from "@/components/ui/toaster";
import Link from "next/link";
import { Check, Info, ShieldCheck, Image as ImageIcon } from "lucide-react";
import { formatMAD } from "@/lib/utils";
import { AlertBanner } from "@/components/ui/alert-banner";
import { ImageUpload } from "@/components/image-upload";
import { GalleryEditor } from "@/components/gallery-editor";
import { CategorySpecificFields } from "@/components/category-fields-section";
import type { CircuitActionState } from "@/app/admin/produits/actions";
import {
  CATEGORY_META,
  DEFAULT_SALE_UNIT,
  SALE_UNITS_BY_CATEGORY,
  allowedSaleUnits,
  categoryFieldFormName,
  type AnyCategoryFields,
} from "@/lib/category-fields";
import { SALE_UNIT_LABEL } from "@/lib/pricing";
import { HotelPicker, type HotelOption } from "@/components/hotel-picker";
import type { CircuitCategory, SaleUnit } from "@/lib/types";

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

const TYPE_ORDER: CircuitCategory[] = [
  "circuit",
  "excursion",
  "transfert",
  "sejour",
  "hebergement",
  "billetterie",
  "prestation",
];

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
  saleUnit: SaleUnit;
  pricingMode: "fixed" | "on_request";
  /** Pièce d'identité exigée des voyageurs quel que soit le type. */
  identityDocumentsRequired: boolean;
  /** Capacité propre : coût de revient estimé (même unité que le prix). */
  internalUnitCost: string;
  internalChildCost: string;
  /** Hébergement : établissement = fournisseur de type hôtel (circuits.supplier_id). */
  supplierId: string | null;
};

/** « par personne », « par nuit et par chambre »… — pour la phrase de confirmation. */
const UNIT_PHRASE: Record<SaleUnit, string> = {
  per_person: "par personne",
  per_night_room: "par nuit et par chambre",
  per_trip: "par trajet",
  per_unit: "à l'unité",
};

type Action = (prev: CircuitActionState, formData: FormData) => Promise<CircuitActionState>;

export function CircuitForm({
  mode,
  action,
  defaults,
  hotels = [],
  reservationCount = 0,
}: {
  mode: "create" | "edit";
  action: Action;
  defaults: CircuitFormDefaults;
  /** Fournisseurs de type hôtel (sélecteur d'établissement d'un hébergement). */
  hotels?: HotelOption[];
  /** Dossiers déjà vendus sur ce produit : changer le type ou l'unité demande confirmation. */
  reservationCount?: number;
}) {
  const [state, formAction, isPending] = useActionState<CircuitActionState, FormData>(
    action,
    { ok: true },
  );
  // Erreur → toast + champ en évidence ; succès → flash « Produit créé / enregistré » après redirection.
  useActionFeedback(state, null);

  const [category, setCategory] = useState<CircuitCategory>(defaults.category);
  const [title, setTitle] = useState(defaults.title);
  const [basePrice, setBasePrice] = useState(defaults.basePrice);
  const [maxParticipants, setMaxParticipants] = useState(defaults.maxParticipants);
  const [isActive, setIsActive] = useState(defaults.isActive);
  const [dayCount, setDayCount] = useState(defaults.dayCount || 1);
  const [imageUrl, setImageUrl] = useState(defaults.heroImageUrl);
  const [saleUnit, setSaleUnit] = useState<SaleUnit>(defaults.saleUnit);
  // Pré-remplissage de l'adresse depuis l'établissement choisi (jamais par-dessus une saisie).
  const [locationSeed, setLocationSeed] = useState<{ key: number; address: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const categoryChanged = category !== defaults.category;
  const seedFields: AnyCategoryFields = categoryChanged ? {} : defaults.categoryFields;

  /**
   * Produit déjà vendu : tout changement qui modifie l'unité de vente effective (ou le
   * type) est confirmé. Les dossiers existants gardent leur montant (prix stocké).
   */
  function confirmChange(nextUnit: SaleUnit, typeChanged: boolean): boolean {
    if (mode !== "edit" || reservationCount <= 0) return true;
    if (!typeChanged && nextUnit === defaults.saleUnit) return true;
    return window.confirm(
      `Ce produit est déjà vendu (${reservationCount} dossier${reservationCount > 1 ? "s" : ""}).\n\n` +
        `Les nouvelles ventes et le prix affiché sur le site seront calculés ${UNIT_PHRASE[nextUnit]}. ` +
        `Les dossiers existants gardent leur montant.\n\n` +
        `Vérifiez ses tarifs d'achat : ils sont exprimés dans l'unité de vente.`,
    );
  }

  // Changer de type pose l'unité : celle en cours si le nouveau type l'autorise, sinon son unité par défaut.
  function onCategoryChange(next: CircuitCategory) {
    const nextUnit = allowedSaleUnits(next).includes(saleUnit) ? saleUnit : DEFAULT_SALE_UNIT[next];
    if (!confirmChange(nextUnit, next !== defaults.category && next !== category)) return;
    setCategory(next);
    setSaleUnit(nextUnit);
  }

  function onSaleUnitChange(next: SaleUnit) {
    if (!confirmChange(next, category !== defaults.category)) return;
    setSaleUnit(next);
  }

  function onHotelSelect(h: HotelOption) {
    const input = formRef.current?.querySelector<HTMLInputElement>(`[name="${categoryFieldFormName("property_address")}"]`);
    if (input && input.value.trim()) return; // l'agent a déjà saisi une adresse : on n'y touche pas
    const address = [h.address_line, h.city, h.country].filter(Boolean).join(", ");
    if (address) setLocationSeed((s) => ({ key: (s?.key ?? 0) + 1, address }));
  }

  const priceNum = Number(basePrice) || 0;
  const maxNum = Number(maxParticipants) || 0;
  const meta = CATEGORY_META[category];
  const unitsForType = allowedSaleUnits(category);
  const unitHelp = SALE_UNITS_BY_CATEGORY[category]?.help[saleUnit] ?? null;
  const durationLabel =
    category === "circuit"
      ? `${dayCount || 1} jour${(dayCount || 1) > 1 ? "s" : ""}`
      : meta?.sectionSuffix ?? "—";

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 lg:grid-cols-[1fr_250px] items-start">
      <div className="space-y-4">
        {/* Section 1 — Informations générales */}
        <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <SectionHeader n={1} title="Informations générales" />
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="sm:col-span-2">
              <label htmlFor="category" className={labelCls}>
                Type de produit <span className="text-red-600">*</span>
              </label>
              <select
                id="category"
                name="category"
                value={category}
                onChange={(e) => onCategoryChange(e.target.value as CircuitCategory)}
                required
                className={fieldCls}
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {CATEGORY_META[t].label}
                  </option>
                ))}
              </select>
              {meta?.hint && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[#58524A]">
                  <Info className="size-3.5 shrink-0 mt-px text-[#968F84]" />
                  {meta.hint}
                </p>
              )}
              <p className="mt-1 flex items-start gap-1.5 text-[11px] text-[#968F84]">
                <Info className="size-3.5 shrink-0 mt-px" />
                Changer de type réinitialise les champs spécifiques.
                {categoryChanged && (
                  <span className="text-[#B25F0B] font-medium"> Champs réinitialisés.</span>
                )}
              </p>
            </div>

            <div>
              <label htmlFor="sale_unit" className={labelCls}>
                Unité de vente <span className="text-red-600">*</span>
              </label>
              <select
                id="sale_unit"
                name="sale_unit"
                value={saleUnit}
                onChange={(e) => onSaleUnitChange(e.target.value as SaleUnit)}
                required
                disabled={unitsForType.length === 1}
                className={fieldCls}
              >
                {unitsForType.map((u) => (
                  <option key={u} value={u}>
                    {SALE_UNIT_LABEL[u]}
                    {u === DEFAULT_SALE_UNIT[category] && unitsForType.length > 1 ? " (par défaut)" : ""}
                  </option>
                ))}
              </select>
              {/* Un select désactivé n'est pas envoyé : l'unité unique part en champ caché. */}
              {unitsForType.length === 1 && <input type="hidden" name="sale_unit" value={saleUnit} />}
              {unitHelp && <p className="mt-1.5 text-[11px] text-[#968F84]">{unitHelp}</p>}
              {unitsForType.length === 1 && (
                <p className="mt-0.5 text-[11px] text-[#968F84]">Seule unité possible pour ce type de produit.</p>
              )}
            </div>

            <div>
              <label htmlFor="pricing_mode" className={labelCls}>
                Mode de tarification <span className="text-red-600">*</span>
              </label>
              <select
                id="pricing_mode"
                name="pricing_mode"
                defaultValue={defaults.pricingMode}
                required
                className={fieldCls}
              >
                <option value="fixed">Prix catalogue — réservable en ligne</option>
                <option value="on_request">Sur demande — devis, hors tunnel</option>
              </select>
              <p className="mt-1.5 text-[11px] text-[#968F84]">
                « Sur demande » retire le produit du paiement en ligne.
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

          {/* Coût interne (capacité propre) — utilisé par lib/margin uniquement si aucun tarif d'achat ne se résout */}
          <div className="mt-4 pt-4 border-t border-[#EEE9E0]">
            <div className="text-[13px] font-medium text-[#1A1F2E]">Coût de revient interne <span className="text-[#968F84] font-normal">(capacité propre)</span></div>
            <p className="text-[11.5px] text-[#968F84] mt-0.5 mb-3">
              Coût de revient estimé pour la capacité propre (carburant, chauffeur, guide…), dans la même unité que le prix de vente.
              Utilisé pour la marge prévisionnelle seulement si aucun tarif d&apos;achat fournisseur ne s&apos;applique.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="internal_unit_cost_mad" className={labelCls}>Coût unitaire (MAD)</label>
                <input id="internal_unit_cost_mad" name="internal_unit_cost_mad" type="number" min="0" step="0.01" defaultValue={defaults.internalUnitCost} placeholder="—" className={fieldCls} />
              </div>
              <div>
                <label htmlFor="internal_child_cost_mad" className={labelCls}>Coût enfant (MAD)</label>
                <input id="internal_child_cost_mad" name="internal_child_cost_mad" type="number" min="0" step="0.01" defaultValue={defaults.internalChildCost} placeholder="= coût unitaire si vide" className={fieldCls} />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — catégorie : champs spécifiques */}
        <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <CategorySpecificFields
            category={category}
            seedFields={seedFields}
            sectionNumber={3}
            onDayCountChange={setDayCount}
            locationSeed={category === "hebergement" ? locationSeed : null}
            replace={
              category === "hebergement"
                ? {
                    property_name: (
                      <HotelPicker
                        hotels={hotels}
                        defaultSupplierId={categoryChanged ? null : defaults.supplierId}
                        onSelect={onHotelSelect}
                      />
                    ),
                  }
                : undefined
            }
          />
          {/* Profil de dossier : force la pièce d'identité des voyageurs (lib/dossier-profile) */}
          <div className="mt-4 pt-4 border-t border-[#EEE9E0] flex items-start justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium text-[#1A1F2E]">Pièce d&apos;identité exigée des voyageurs</div>
              <p className="text-[11.5px] text-[#968F84] mt-0.5">
                Exigé par un fournisseur ou une autorité (bivouac avec contrôle, frontière…). Ajoute date de naissance, pièce
                (CIN / passeport) et nationalité aux champs requis, quel que soit le type de produit.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center shrink-0 mt-1">
              <input
                type="checkbox"
                name="identity_documents_required"
                defaultChecked={defaults.identityDocumentsRequired}
                className="peer sr-only"
              />
              <span
                className="h-[19px] w-[34px] rounded-full bg-[#D6D0C4] transition-colors peer-checked:bg-[#0F6E56] after:absolute after:left-[2px] after:top-[2px] after:size-[15px] after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-[15px]"
                aria-hidden
              />
            </label>
          </div>
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
          href="/admin/produits"
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
