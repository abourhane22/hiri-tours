import type { Vehicle } from "@/lib/types";

export type DeadlineStatus = "expired" | "soon" | "ok";
export type VehicleAlertStatus = "expired" | "soon" | "ok" | "none";

export type DeadlineEntry = {
  label: string;
  date: string;
  status: DeadlineStatus;
};

export type VehicleAlert = {
  status: VehicleAlertStatus;
  deadlines: DeadlineEntry[];
};

export function getVehicleAlertStatus(v: Pick<Vehicle, "next_maintenance_date" | "insurance_expires_on" | "inspection_expires_on" | "vignette_expires_on">): VehicleAlert {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  const checks: { label: string; date: string | null }[] = [
    { label: "Vidange", date: v.next_maintenance_date },
    { label: "Assurance", date: v.insurance_expires_on },
    { label: "Visite technique", date: v.inspection_expires_on },
    { label: "Vignette", date: v.vignette_expires_on },
  ];

  const deadlines: DeadlineEntry[] = checks
    .filter((c): c is { label: string; date: string } => !!c.date)
    .map((c) => {
      const d = new Date(c.date);
      d.setHours(0, 0, 0, 0);
      let status: DeadlineStatus = "ok";
      if (d < today) status = "expired";
      else if (d < in30) status = "soon";
      return { label: c.label, date: c.date, status };
    });

  let status: VehicleAlertStatus = "none";
  if (deadlines.some((d) => d.status === "expired")) status = "expired";
  else if (deadlines.some((d) => d.status === "soon")) status = "soon";
  else if (deadlines.length > 0) status = "ok";

  return { status, deadlines };
}
