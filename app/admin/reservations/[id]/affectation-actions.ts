"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateAffectation(reservationId: string, formData: FormData) {
  const vehicleId = (formData.get("vehicle_id") as string) || null;
  const guideId = (formData.get("guide_id") as string) || null;
  const driverId = (formData.get("driver_id") as string) || null;

  const supabase = await createClient();

  // Capacité : le véhicule doit pouvoir transporter tous les passagers du dossier.
  if (vehicleId) {
    const [{ data: resa }, { data: veh }] = await Promise.all([
      supabase.from("reservations").select("adults, children").eq("id", reservationId).single(),
      supabase.from("vehicles").select("capacity, make, model, registration").eq("id", vehicleId).single(),
    ]);
    if (resa && veh) {
      const pax = (resa as any).adults + (resa as any).children;
      const capacity = Number((veh as any).capacity) || 0;
      if (capacity < pax) {
        const modele =
          [(veh as any).make, (veh as any).model].filter(Boolean).join(" ") ||
          (veh as any).registration;
        throw new Error(
          `Le ${modele} ne peut transporter que ${capacity} passagers (${pax} sur ce dossier).`,
        );
      }
    }
  }

  const { error } = await supabase.from("reservations").update({
    vehicle_id: vehicleId || null,
    guide_id: guideId || null,
    driver_id: driverId || null,
  }).eq("id", reservationId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/reservations/${reservationId}`);
}
