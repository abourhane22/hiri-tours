import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSaleUnit } from "@/lib/pricing";
import { BookingTunnel } from "@/components/public/booking-tunnel";

export const dynamic = "force-dynamic";

// Les 7 types sont mappés dès le déploiement, même si aucun produit n'utilise
// encore les trois derniers : pas de libellé brut côté client.
const CATEGORY_LABEL: Record<string, string> = {
  circuit: "Circuit",
  excursion: "Excursion",
  transfert: "Transfert",
  sejour: "Séjour",
  hebergement: "Hébergement",
  billetterie: "Billetterie",
  prestation: "Prestation",
};

const TICKET_KIND_LABEL: Record<string, string> = {
  vol: "Vol",
  bus: "Bus",
  train: "Train",
  ferry: "Ferry",
  evenement: "Spectacle / événement",
  entree_site: "Entrée de site",
};

const ROOM_TYPE_LABEL: Record<string, string> = {
  simple: "Chambre simple",
  double: "Chambre double",
  twin: "Chambre twin",
  triple: "Chambre triple",
  familiale: "Chambre familiale",
  suite: "Suite",
};

const BOARD_LABEL: Record<string, string> = {
  sans: "Sans repas",
  petit_dejeuner: "Petit-déjeuner",
  demi_pension: "Demi-pension",
  pension_complete: "Pension complète",
};

/** Quelques infos lisibles tirées de category_fields pour l'étape Prestation. */
function buildInfoItems(category: string, fields: Record<string, any>, meetingPoint: string | null) {
  const items: { label: string; value: string }[] = [];
  const f = fields || {};

  if (category === "excursion" && f.duration_hours) {
    items.push({ label: "Durée", value: `${f.duration_hours} h` });
  }
  if (category === "sejour" && f.nights) {
    items.push({ label: "Nuitées", value: `${f.nights} nuit${Number(f.nights) > 1 ? "s" : ""}` });
  }
  if (category === "transfert" && f.trip_duration_min) {
    items.push({ label: "Trajet estimé", value: `${f.trip_duration_min} min` });
  }
  if (category === "hebergement") {
    if (f.property_name) items.push({ label: "Établissement", value: String(f.property_name) });
    if (f.room_type && ROOM_TYPE_LABEL[f.room_type]) {
      items.push({ label: "Chambre", value: ROOM_TYPE_LABEL[f.room_type] });
    }
    if (f.hebergement_board_type && BOARD_LABEL[f.hebergement_board_type]) {
      items.push({ label: "Pension", value: BOARD_LABEL[f.hebergement_board_type] });
    }
    if (f.check_in_time) items.push({ label: "Arrivée à partir de", value: String(f.check_in_time) });
  }
  if (category === "billetterie") {
    if (f.ticket_kind && TICKET_KIND_LABEL[f.ticket_kind]) {
      items.push({ label: "Nature", value: TICKET_KIND_LABEL[f.ticket_kind] });
    }
    if (f.carrier_or_organizer) items.push({ label: "Compagnie", value: String(f.carrier_or_organizer) });
    if (f.origin && f.destination) {
      items.push({ label: "Trajet", value: `${f.origin} → ${f.destination}${f.is_round_trip ? " (aller-retour)" : ""}` });
    }
    if (f.fixed_date) items.push({ label: "Date du billet", value: String(f.fixed_date) });
  }
  if (category === "prestation" && f.prestation_duration_min) {
    items.push({ label: "Durée", value: `${f.prestation_duration_min} min` });
  }
  if (f.departure_time) {
    items.push({ label: "Heure de départ", value: String(f.departure_time) });
  }
  const rdv = meetingPoint || f.meeting_point || f.pickup_location || f.property_address || f.venue;
  if (rdv) items.push({ label: "Point de rendez-vous", value: String(rdv) });

  return items;
}

export default async function ReserverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Le segment peut être un UUID (cartes catalogue) ou un slug (liens vitrine).
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const { data: circuit } = await supabase
    .from("circuits")
    .select(
      "id, title, category, description, short_description, hero_image_url, base_price_mad, child_price_mad, max_participants, meeting_point, category_fields, sale_unit, is_active, circuit_seasons(starts_on, ends_on, price_multiplier)",
    )
    .eq(isUuid ? "id" : "slug", id)
    .maybeSingle();

  if (!circuit || !(circuit as any).is_active) notFound();
  const c = circuit as any;

  const infoItems = buildInfoItems(c.category, c.category_fields ?? {}, c.meeting_point ?? null);

  const seasons = ((c.circuit_seasons ?? []) as any[]).map((s) => ({
    starts_on: s.starts_on,
    ends_on: s.ends_on,
    price_multiplier: Number(s.price_multiplier),
  }));

  const { data: company } = await supabase
    .from("company_settings")
    .select("bank_rib, bank_name, bank_account_holder")
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-[640px] mx-auto px-4 py-6">
      <BookingTunnel
        circuit={{
          id: c.id,
          title: c.title,
          categoryLabel: CATEGORY_LABEL[c.category] ?? c.category,
          description: c.description ?? c.short_description ?? "",
          heroImageUrl: c.hero_image_url ?? null,
          basePrice: Number(c.base_price_mad),
          childPrice: c.child_price_mad === null ? null : Number(c.child_price_mad),
          maxParticipants: Number(c.max_participants) || 0,
          saleUnit: isSaleUnit(c.sale_unit) ? c.sale_unit : "per_person",
          infoItems,
          seasons,
        }}
        bank={{
          rib: (company as any)?.bank_rib ?? null,
          name: (company as any)?.bank_name ?? null,
          holder: (company as any)?.bank_account_holder ?? null,
        }}
      />
    </div>
  );
}
