"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateAffectation(reservationId: string, formData: FormData) {
  const vehicleId = (formData.get("vehicle_id") as string) || null;
  const guideId = (formData.get("guide_id") as string) || null;
  const driverId = (formData.get("driver_id") as string) || null;

  const supabase = await createClient();
  const { error } = await supabase.from("reservations").update({
    vehicle_id: vehicleId || null,
    guide_id: guideId || null,
    driver_id: driverId || null,
  }).eq("id", reservationId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/reservations/${reservationId}`);
}
