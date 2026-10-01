// Établissements = fournisseurs de type hôtel (sélecteur du formulaire produit).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HotelOption } from "@/components/hotel-picker";

export async function loadHotels(supabase: SupabaseClient): Promise<HotelOption[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, address_line, city, country, is_active")
    .eq("supplier_type", "hotel")
    .order("name");
  if (error) console.error("[loadHotels]", error);
  return (data ?? []) as HotelOption[];
}
