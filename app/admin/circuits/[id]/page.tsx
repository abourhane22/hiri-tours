import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { ImageUpload } from "@/components/image-upload";
import { GalleryEditor } from "@/components/gallery-editor";
import { SeasonsEditor } from "@/components/seasons-editor";
import { CategoryFieldsSection } from "@/components/category-fields-section";
import { CategoryFieldsSummary } from "@/components/category-fields-summary";
import { CircuitDangerZone } from "@/components/circuit-danger-zone";
import { CircuitPreviewPanel } from "@/components/circuit-preview-panel";
import { ArrowLeft, ShieldCheck, Image as ImageIcon } from "lucide-react";
import type { Circuit, CircuitSeason, CircuitCategory } from "@/lib/types";
import {
  parseCategoryFieldsFromForm,
  deriveLegacyColumns,
  normalizeItinerary,
  type AnyCategoryFields,
} from "@/lib/category-fields";

const VALID_CATEGORIES: readonly CircuitCategory[] = ["circuit", "excursion", "transfert", "sejour"];

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

export default async function EditCircuitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: circuit } = await supabase.from("circuits").select("*").eq("id", id).single();
  if (!circuit) notFound();

  const { data: seasons } = await supabase.from("circuit_seasons").select("*").eq("circuit_id", id).order("starts_on", { ascending: true });

  const { count: reservationCount } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("circuit_id", id);

  const c = circuit as Circuit;
  const seasonsList = (seasons as CircuitSeason[]) || [];

  // Migration douce : les anciens circuits peuvent avoir category_fields vide,
  // ou (pour un circuit) un category_fields sans itinéraire alors que la colonne
  // legacy `itinerary` en contient. On pré-remplit le répéteur depuis le legacy
  // sans jamais réécrire la colonne (désormais en lecture seule).
  const legacyItineraryDays: string[] = Array.isArray(c.itinerary)
    ? (c.itinerary as { title?: string; description?: string }[])
        .map((d) => [d?.title, d?.description].filter(Boolean).join(" — "))
        .filter(Boolean)
    : [];

  const stored = (c.category_fields ?? {}) as AnyCategoryFields;
  const currentCategoryFields: AnyCategoryFields = (() => {
    const hasStored = Object.keys(stored).length > 0;

    if (c.category === "circuit") {
      const base: AnyCategoryFields = hasStored ? { ...stored } : {};
      if (normalizeItinerary(base.itinerary).length === 0 && legacyItineraryDays.length > 0) {
        base.itinerary = legacyItineraryDays;
      }
      if (!base.duration_days) base.duration_days = c.duration_days || 1;
      return base;
    }

    if (hasStored) return stored;

    if (c.category === "excursion") {
      return {
        duration_hours: c.duration_hours ?? undefined,
        meeting_point: c.meeting_point ?? undefined,
      };
    }
    if (c.category === "sejour") {
      return { nights: c.duration_days || 1 };
    }
    return {};
  })();

  async function updateCircuit(formData: FormData) {
    "use server";
    const supabase = await createClient();

    let galleryUrls: string[] = [];
    try {
      const raw = formData.get("gallery_urls") as string;
      if (raw) galleryUrls = JSON.parse(raw);
    } catch {}

    const category = formData.get("category") as CircuitCategory;
    if (!VALID_CATEGORIES.includes(category)) {
      throw new Error("Catégorie invalide");
    }

    // Validations de base (serveur)
    const title = ((formData.get("title") as string) || "").trim();
    if (!title) throw new Error("Le titre est obligatoire.");
    const basePrice = parseFloat(formData.get("base_price_mad") as string);
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      throw new Error("Le prix adulte doit être un nombre supérieur à 0.");
    }
    const maxParticipants = parseInt(formData.get("max_participants") as string, 10);
    if (!Number.isInteger(maxParticipants) || maxParticipants <= 0) {
      throw new Error("Le nombre maximum de participants doit être un entier supérieur à 0.");
    }

    const parsed = parseCategoryFieldsFromForm(category, formData);
    if (!parsed.ok) throw new Error(parsed.error);

    const legacy = deriveLegacyColumns(category, parsed.fields as AnyCategoryFields);

    const payload = {
      title,
      slug: (formData.get("slug") as string).trim().toLowerCase(),
      category,
      short_description: formData.get("short_description") as string,
      description: formData.get("description") as string,
      base_price_mad: basePrice,
      child_price_mad: formData.get("child_price_mad") ? parseFloat(formData.get("child_price_mad") as string) : null,
      max_participants: maxParticipants,
      hero_image_url: formData.get("hero_image_url") as string,
      gallery_urls: galleryUrls.length > 0 ? galleryUrls : null,
      // Colonne legacy `itinerary` volontairement non écrite (lecture seule).
      is_active: formData.get("is_active") === "on",
      category_fields: parsed.fields,
      duration_days: legacy.duration_days,
      duration_hours: legacy.duration_hours,
      meeting_point: legacy.meeting_point,
    };

    const { error } = await supabase.from("circuits").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    redirect("/admin/circuits");
  }

  const initialDayCount =
    normalizeItinerary(currentCategoryFields.itinerary).length || c.duration_days || 1;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/admin/circuits" className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4">
        <ArrowLeft className="size-4" /> Retour au catalogue
      </Link>
      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">
          Catalogue · Édition
        </p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">{c.title}</h1>
      </div>

      {/* Aperçu détaillé de la fiche (résumé des champs spécifiques) */}
      <Card className="mb-4">
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Aperçu de la fiche</h2>
          {c.description && (
            <p className="text-sm text-sand-700 mt-1 whitespace-pre-line">{c.description}</p>
          )}
        </div>
        <CardBody>
          <CategoryFieldsSummary
            category={c.category}
            fields={(c.category_fields as AnyCategoryFields | null) ?? null}
          />
        </CardBody>
      </Card>

      <form action={updateCircuit} className="grid gap-4 lg:grid-cols-[1fr_250px] items-start">
        <div className="space-y-4">
          {/* Section 1 */}
          <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
            <SectionHeader n={1} title="Informations générales" />
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="sm:col-span-2">
                <label htmlFor="title" className={labelCls}>Titre <span className="text-red-600">*</span></label>
                <input id="title" name="title" required defaultValue={c.title} className={fieldCls} />
              </div>
              <div>
                <label htmlFor="slug" className={labelCls}>Slug (URL) <span className="text-red-600">*</span></label>
                <input id="slug" name="slug" required pattern="[a-z0-9\-]+" defaultValue={c.slug} className={fieldCls} />
              </div>
              <div>
                <label htmlFor="short_description" className={labelCls}>Description courte</label>
                <input id="short_description" name="short_description" defaultValue={c.short_description || ""} className={fieldCls} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="description" className={labelCls}>Description</label>
                <textarea id="description" name="description" rows={2} defaultValue={c.description || ""} placeholder="Ce que le client vivra, en 2 phrases." className={`${fieldCls} h-auto py-2`} />
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
            <SectionHeader n={2} title="Tarification & capacité" />
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="base_price_mad" className={labelCls}>Prix adulte (MAD) <span className="text-red-600">*</span></label>
                <input id="base_price_mad" name="base_price_mad" type="number" min="0" step="0.01" defaultValue={c.base_price_mad} required className={fieldCls} />
              </div>
              <div>
                <label htmlFor="child_price_mad" className={labelCls}>Prix enfant (MAD)</label>
                <input id="child_price_mad" name="child_price_mad" type="number" min="0" step="0.01" defaultValue={c.child_price_mad ?? ""} placeholder="= prix adulte si vide" className={fieldCls} />
              </div>
              <div>
                <label htmlFor="max_participants" className={labelCls}>Capacité max (pax) <span className="text-red-600">*</span></label>
                <input id="max_participants" name="max_participants" type="number" min="1" defaultValue={c.max_participants} required className={fieldCls} />
              </div>
              <div className="flex items-end">
                <a href="#seasons" className="text-[12px] text-[#0C6B8A] hover:underline pb-2.5">
                  Saisons tarifaires — gérées ci-dessous →
                </a>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-[#968F84]">
              <ShieldCheck className="size-3.5 shrink-0 mt-px text-[#0F6E56]" />
              Le total d&apos;une réservation est recalculé côté serveur : prix × passagers × saison.
            </p>
          </section>

          {/* Section 3 — catégorie + champs spécifiques */}
          <section className="bg-white border border-[#E5E0D7] rounded-xl p-4 space-y-4">
            <CategoryFieldsSection defaultCategory={c.category} defaultFields={currentCategoryFields} sectionNumber={3} />
          </section>

          {/* Médias */}
          <section className="bg-white border border-[#E5E0D7] rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-[#968F84]" />
              <h2 className="font-display text-base text-[#1A1F2E] m-0">Médias</h2>
            </div>
            <ImageUpload name="hero_image_url" label="Image principale" defaultValue={c.hero_image_url} />
            <GalleryEditor name="gallery_urls" defaultValue={c.gallery_urls} />
          </section>
        </div>

        {/* Panneau latéral */}
        <CircuitPreviewPanel
          mode="edit"
          initial={{
            title: c.title,
            price: Number(c.base_price_mad),
            max: c.max_participants,
            category: c.category,
            dayCount: initialDayCount,
            imageUrl: c.hero_image_url ?? "",
          }}
          initialActive={c.is_active}
        />
      </form>

      <Card id="seasons" className="mt-6">
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Tarification saisonnière</h2>
          <p className="text-xs text-sand-700 mt-1">Définissez des périodes avec un multiplicateur de prix. Le bon tarif s&apos;applique automatiquement à la création d&apos;une réservation selon la date de départ.</p>
        </div>
        <CardBody>
          <SeasonsEditor circuitId={id} seasons={seasonsList} />
        </CardBody>
      </Card>

      <CircuitDangerZone
        circuitId={id}
        reservationCount={reservationCount ?? 0}
        isActive={c.is_active}
      />
    </div>
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
