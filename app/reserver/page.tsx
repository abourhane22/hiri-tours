import Link from "next/link";
import { ShieldCheck, Zap, MapPin, Ticket } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { seasonMultiplier } from "@/lib/pricing";
import { CatalogGrid, type CatalogItem } from "@/components/public/catalog-grid";

export const dynamic = "force-dynamic";

export default async function ReserverCatalogPage() {
  const supabase = createAdminClient();
  const { data: circuits } = await supabase
    .from("circuits")
    .select(
      "id, title, category, hero_image_url, base_price_mad, max_participants, duration_days, duration_hours, category_fields, circuit_seasons(starts_on, ends_on, price_multiplier)",
    )
    .eq("is_active", true)
    .order("base_price_mad", { ascending: true });

  const today = new Date().toISOString().slice(0, 10);

  const items: CatalogItem[] = ((circuits ?? []) as any[]).map((c) => {
    const f = (c.category_fields ?? {}) as Record<string, any>;
    return {
      id: c.id,
      title: c.title,
      category: c.category,
      heroImageUrl: c.hero_image_url ?? null,
      price: Number(c.base_price_mad),
      durationDays: c.duration_days ?? null,
      durationHours: c.duration_hours ?? f.duration_hours ?? null,
      maxParticipants: Number(c.max_participants) || null,
      lodgingIncluded: !!f.lodging_included,
      departureTime: f.departure_time ?? null,
      vehicleType: f.vehicle_type ?? null,
      tripType: f.trip_type ?? null,
      nights: f.nights ?? null,
      boardType: f.board_type ?? null,
      highSeason: seasonMultiplier(today, c.circuit_seasons) > 1,
    };
  });

  return (
    <div>
      {/* HÉROS */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1A1F2E 55%, #2A3550)" }}
      >
        {/* Halo décoratif terracotta */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(200,75,49,0.35), transparent 70%)" }}
        />
        <div className="relative max-w-5xl mx-auto px-4 py-10 sm:py-14">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg text-white tracking-tight">Hiri Tours</span>
            <span className="text-[8px] tracking-[2px] uppercase text-[#FFB89A]">
              Agadir · Maroc
            </span>
          </div>
          <h1 className="mt-3 font-display text-2xl text-white max-w-lg leading-snug">
            Le Sud marocain, réservé en 2 minutes.
          </h1>
          <p className="mt-2 text-[#B8C0D4] text-sm max-w-lg">
            Circuits, excursions et transferts — confirmation immédiate, paiement 100 % sécurisé.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] text-[#9FE1CB]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Paiement 3D Secure
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-3.5" /> Confirmation immédiate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" /> Agence locale
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* BANDEAU SUIVI */}
        <div
          className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-[#E5E0D7] bg-white p-4"
          style={{ borderLeft: "3px solid #C84B31" }}
        >
          <Ticket className="size-5 shrink-0 text-[#C84B31]" />
          <p className="flex-1 text-[13px] text-[#1A1F2E]">
            Déjà réservé ? Consultez votre dossier et payez en ligne.
          </p>
          <Link
            href="/reserver/suivi"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1A1F2E] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2A3142]"
          >
            Suivre ma réservation
          </Link>
        </div>

        <CatalogGrid items={items} />
      </div>
    </div>
  );
}
