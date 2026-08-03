import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImageUpload } from "@/components/image-upload";
import { GalleryEditor } from "@/components/gallery-editor";
import { CategoryFieldsSection } from "@/components/category-fields-section";
import { CircuitPreviewPanel } from "@/components/circuit-preview-panel";
import { ArrowLeft, ShieldCheck, Image as ImageIcon } from "lucide-react";
import {
  parseCategoryFieldsFromForm,
  deriveLegacyColumns,
  type AnyCategoryFields,
} from "@/lib/category-fields";
import type { CircuitCategory } from "@/lib/types";

const VALID_CATEGORIES: readonly CircuitCategory[] = ["circuit", "excursion", "transfert", "sejour"];

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

export default function NewCircuitPage() {
  async function createCircuit(formData: FormData) {
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

    const slug = (formData.get("slug") as string).trim().toLowerCase();
    const payload = {
      slug,
      title,
      category,
      short_description: formData.get("short_description") as string,
      description: formData.get("description") as string,
      base_price_mad: basePrice,
      child_price_mad: formData.get("child_price_mad") ? parseFloat(formData.get("child_price_mad") as string) : null,
      max_participants: maxParticipants,
      hero_image_url: formData.get("hero_image_url") as string,
      gallery_urls: galleryUrls.length > 0 ? galleryUrls : null,
      // Itinéraire : source de vérité = category_fields.itinerary (répéteur).
      is_active: formData.get("is_active") === "on",
      category_fields: parsed.fields,
      duration_days: legacy.duration_days,
      duration_hours: legacy.duration_hours,
      meeting_point: legacy.meeting_point,
    };

    const { data, error } = await supabase.from("circuits").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    redirect(`/admin/circuits/${data.id}`);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/admin/circuits" className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4">
        <ArrowLeft className="size-4" /> Retour au catalogue
      </Link>
      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">
          Catalogue · Nouveau produit
        </p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Nouveau circuit</h1>
      </div>

      <form action={createCircuit} className="grid gap-4 lg:grid-cols-[1fr_250px] items-start">
        <div className="space-y-4">
          {/* Section 1 */}
          <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
            <SectionHeader n={1} title="Informations générales" />
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="sm:col-span-2">
                <label htmlFor="title" className={labelCls}>Titre <span className="text-red-600">*</span></label>
                <input id="title" name="title" required placeholder="Paradise Valley & Tafraout" className={fieldCls} />
              </div>
              <div>
                <label htmlFor="slug" className={labelCls}>Slug (URL) <span className="text-red-600">*</span></label>
                <input id="slug" name="slug" required pattern="[a-z0-9\-]+" placeholder="paradise-valley-tafraout" className={fieldCls} />
              </div>
              <div>
                <label htmlFor="short_description" className={labelCls}>Description courte</label>
                <input id="short_description" name="short_description" placeholder="Une phrase qui donne envie." className={fieldCls} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="description" className={labelCls}>Description</label>
                <textarea id="description" name="description" rows={2} placeholder="Ce que le client vivra, en 2 phrases." className={`${fieldCls} h-auto py-2`} />
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
            <SectionHeader n={2} title="Tarification & capacité" />
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="base_price_mad" className={labelCls}>Prix adulte (MAD) <span className="text-red-600">*</span></label>
                <input id="base_price_mad" name="base_price_mad" type="number" min="0" step="0.01" required className={fieldCls} />
              </div>
              <div>
                <label htmlFor="child_price_mad" className={labelCls}>Prix enfant (MAD)</label>
                <input id="child_price_mad" name="child_price_mad" type="number" min="0" step="0.01" placeholder="= prix adulte si vide" className={fieldCls} />
              </div>
              <div>
                <label htmlFor="max_participants" className={labelCls}>Capacité max (pax) <span className="text-red-600">*</span></label>
                <input id="max_participants" name="max_participants" type="number" min="1" defaultValue="20" required className={fieldCls} />
              </div>
              <div className="flex items-end">
                <p className="text-[12px] text-[#968F84] pb-2.5">
                  Saisons tarifaires — gérées après création
                </p>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-[#968F84]">
              <ShieldCheck className="size-3.5 shrink-0 mt-px text-[#0F6E56]" />
              Le total d&apos;une réservation est recalculé côté serveur : prix × passagers × saison.
            </p>
          </section>

          {/* Section 3 — catégorie + champs spécifiques */}
          <section className="bg-white border border-[#E5E0D7] rounded-xl p-4 space-y-4">
            <CategoryFieldsSection defaultCategory="circuit" defaultFields={null} sectionNumber={3} />
          </section>

          {/* Médias */}
          <section className="bg-white border border-[#E5E0D7] rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-[#968F84]" />
              <h2 className="font-display text-base text-[#1A1F2E] m-0">Médias</h2>
            </div>
            <ImageUpload name="hero_image_url" label="Image principale" />
            <GalleryEditor name="gallery_urls" />
          </section>
        </div>

        {/* Panneau latéral */}
        <CircuitPreviewPanel
          mode="create"
          initial={{ title: "", price: 0, max: 20, category: "circuit", dayCount: 1, imageUrl: "" }}
          initialActive
        />
      </form>
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
