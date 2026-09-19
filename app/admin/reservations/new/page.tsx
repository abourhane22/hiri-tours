import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NewReservationForm, type BookingProduct } from "@/components/reservations/new-reservation-form";

// Nouveau dossier depuis le catalogue (backoffice). Les produits issus de la
// distribution aérienne (une offre = un produit inactif) ne sont pas proposés :
// leur porte d'entrée est /admin/billetterie.
export default async function NewReservationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data } = await supabase
    .from("circuits")
    .select(
      "id, title, category, base_price_mad, child_price_mad, max_participants, sale_unit, pricing_mode, duration_days, duration_hours, meeting_point, category_fields, circuit_seasons(name, starts_on, ends_on, price_multiplier)",
    )
    .eq("is_active", true)
    .order("title", { ascending: true });

  const products = ((data ?? []) as any[])
    .filter((p) => (p.category_fields as any)?.source !== "duffel")
    .map((p) => ({
      ...p,
      base_price_mad: Number(p.base_price_mad),
      child_price_mad: p.child_price_mad === null ? null : Number(p.child_price_mad),
      circuit_seasons: Array.isArray(p.circuit_seasons) ? p.circuit_seasons : [],
    })) as BookingProduct[];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin/reservations" className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4">
        <ArrowLeft className="size-4" /> Retour aux réservations
      </Link>
      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Ventes · Nouveau dossier</p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Nouvelle réservation</h1>
        <p className="text-[12px] text-[#6B6862] mt-1">Créer un dossier depuis le catalogue — téléphone, comptoir, WhatsApp, partenaire.</p>
      </div>
      <NewReservationForm products={products} />
    </div>
  );
}
