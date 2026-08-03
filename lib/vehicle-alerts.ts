import type { Vehicle } from "@/lib/types";

export type DeadlineStatus = "expired" | "soon" | "ok";
export type VehicleAlertStatus = "expired" | "soon" | "ok";

export type DeadlineEntry = {
  label: string;
  date: string | null;
  status: DeadlineStatus;
  daysLeft: number | null;
};

export type VehicleAlert = {
  status: VehicleAlertStatus;
  deadlines: DeadlineEntry[];
  /** Timestamp de l'échéance la plus proche (ou Infinity si aucune date). */
  nextDeadline: number;
};

/**
 * Statut par échéance :
 *  - 'expired' si date passée OU non renseignée (null),
 *  - 'soon'    si date ≤ aujourd'hui + 30 jours,
 *  - 'ok'      sinon.
 * Urgence du véhicule = pire statut (expired > soon > ok).
 */
export function getVehicleAlertStatus(
  v: Pick<Vehicle, "next_maintenance_date" | "insurance_expires_on" | "inspection_expires_on" | "vignette_expires_on">,
): VehicleAlert {
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

  const deadlines: DeadlineEntry[] = checks.map((c) => {
    if (!c.date) {
      // Non renseignée = à traiter en priorité (expiré).
      return { label: c.label, date: null, status: "expired", daysLeft: null };
    }
    const d = new Date(c.date);
    d.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((d.getTime() - today.getTime()) / 86400000);
    let status: DeadlineStatus = "ok";
    if (d < today) status = "expired";
    else if (d <= in30) status = "soon";
    return { label: c.label, date: c.date, status, daysLeft };
  });

  const status: VehicleAlertStatus = deadlines.some((d) => d.status === "expired")
    ? "expired"
    : deadlines.some((d) => d.status === "soon")
      ? "soon"
      : "ok";

  const times = deadlines
    .map((d) => (d.date ? new Date(d.date).getTime() : null))
    .filter((t): t is number => t !== null);
  const nextDeadline = times.length ? Math.min(...times) : Infinity;

  return { status, deadlines, nextDeadline };
}
