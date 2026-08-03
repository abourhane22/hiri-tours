import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { SeasonsEditor } from "@/components/seasons-editor";
import { CategoryFieldsSummary } from "@/components/category-fields-summary";
import { CircuitDangerZone } from "@/components/circuit-danger-zone";
import { CircuitForm } from "@/components/circuit-form";
import { updateCircuit } from "@/app/admin/circuits/actions";
import { ArrowLeft } from "lucide-react";
import type { Circuit, CircuitSeason } from "@/lib/types";
import { normalizeItinerary, type AnyCategoryFields } from "@/lib/category-fields";

export default async function EditCircuitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: circuit } = await supabase.from("circuits").select("*").eq("id", id).single();
  if (!circuit) notFound();

  const { data: seasons } = await supabase
    .from("circuit_seasons")
    .select("*")
    .eq("circuit_id", id)
    .order("starts_on", { ascending: true });

  const { count: reservationCount } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("circuit_id", id);

  const c = circuit as Circuit;
  const seasonsList = (seasons as CircuitSeason[]) || [];

  // Migration douce : pré-remplit l'itinéraire depuis la colonne legacy si
  // category_fields.itinerary est absent (sans jamais réécrire la colonne).
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
      return { duration_hours: c.duration_hours ?? undefined, meeting_point: c.meeting_point ?? undefined };
    }
    if (c.category === "sejour") {
      return { nights: c.duration_days || 1 };
    }
    return {};
  })();

  const initialDayCount =
    normalizeItinerary(currentCategoryFields.itinerary).length || c.duration_days || 1;

  const boundUpdate = updateCircuit.bind(null, id);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/admin/circuits"
        className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4"
      >
        <ArrowLeft className="size-4" /> Retour au catalogue
      </Link>
      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">
          Catalogue · Édition
        </p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">{c.title}</h1>
      </div>

      {/* Aperçu détaillé de la fiche */}
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

      <CircuitForm
        mode="edit"
        action={boundUpdate}
        defaults={{
          title: c.title,
          slug: c.slug,
          shortDescription: c.short_description || "",
          description: c.description || "",
          basePrice: String(c.base_price_mad),
          childPrice: c.child_price_mad != null ? String(c.child_price_mad) : "",
          maxParticipants: String(c.max_participants),
          category: c.category,
          categoryFields: currentCategoryFields,
          heroImageUrl: c.hero_image_url ?? "",
          galleryUrls: c.gallery_urls,
          isActive: c.is_active,
          dayCount: initialDayCount,
        }}
      />

      <Card id="seasons" className="mt-6">
        <div className="px-5 py-4 border-b border-sand-200">
          <h2 className="font-display text-lg text-ink">Tarification saisonnière</h2>
          <p className="text-xs text-sand-700 mt-1">
            Définissez des périodes avec un multiplicateur de prix. Le bon tarif s&apos;applique
            automatiquement à la création d&apos;une réservation selon la date de départ.
          </p>
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
