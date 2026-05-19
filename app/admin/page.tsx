import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMAD, formatDateShort } from "@/lib/utils";
import { Plus, ArrowRight, AlertTriangle } from "lucide-react";
import { getVehicleAlertStatus } from "@/lib/vehicle-alerts";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: reservationsCount },
    { count: circuitsCount },
    { data: recentReservations },
    { data: revenueData },
    { data: outstandingData },
  ] = await Promise.all([
    supabase.from("reservations").select("*", { count: "exact", head: true }),
    supabase
      .from("circuits")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("reservations")
      .select("*, circuits(title, slug), customers(full_name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("reservations")
      .select("paid_amount_mad")
      .in("status", ["paid", "completed"]),
    supabase
      .from("reservations")
      .select("total_amount_mad, paid_amount_mad")
      .not("status", "in", "(cancelled,completed)"),
  ]);

  const totalRevenue =
    revenueData?.reduce((sum, r) => sum + Number(r.paid_amount_mad), 0) ?? 0;
  const totalOutstanding =
    outstandingData?.reduce(
      (sum, r) =>
        sum + (Number(r.total_amount_mad) - Number(r.paid_amount_mad)),
      0
    ) ?? 0;

  const { data: vehiclesData } = await supabase.from("vehicles").select("*").eq("is_active", true);
  const vehiclesWithAlerts = (vehiclesData || [])
    .map((v: any) => ({ vehicle: v, alert: getVehicleAlertStatus(v) }))
    .filter((x) => x.alert.status === "expired" || x.alert.status === "soon")
    .sort((a, b) => {
      if (a.alert.status === "expired" && b.alert.status !== "expired") return -1;
      if (a.alert.status !== "expired" && b.alert.status === "expired") return 1;
      return 0;
    });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Vue d&apos;ensemble</p>
          <h1 className="font-display text-3xl text-ink">Tableau de bord</h1>
        </div>
        <Link href="/admin/reservations/new">
          <Button>
            <Plus className="size-4" />
            Nouvelle réservation
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Réservations"
          value={reservationsCount ?? 0}
          href="/admin/reservations"
        />
        <StatCard
          label="Circuits actifs"
          value={circuitsCount ?? 0}
          href="/admin/circuits"
        />
        <StatCard label="Encaissé" value={formatMAD(totalRevenue)} accent />
        <StatCard
          label="À encaisser"
          value={formatMAD(totalOutstanding)}
          warning
        />
      </div>

      {vehiclesWithAlerts.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <div className="px-5 py-4 border-b border-amber-200 bg-amber-50">
            <h2 className="font-display text-lg text-amber-900 flex items-center gap-2">
              <AlertTriangle className="size-5" />Alertes véhicules
            </h2>
            <p className="text-xs text-amber-800 mt-1">
              {vehiclesWithAlerts.filter((x) => x.alert.status === "expired").length > 0
                ? "Certains véhicules ont des échéances expirées."
                : "Certains véhicules ont des échéances qui arrivent à expiration dans 30 jours."}
            </p>
          </div>
          <div className="divide-y divide-sand-200">
            {vehiclesWithAlerts.map(({ vehicle, alert }) => (
              <Link key={vehicle.id} href={`/admin/logistique/vehicules/${vehicle.id}`} className="block px-5 py-3 hover:bg-sand-50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm text-terracotta-600">{vehicle.registration}</span>
                    {(vehicle.make || vehicle.model) && (
                      <span className="text-xs text-sand-600 ml-2">{[vehicle.make, vehicle.model].filter(Boolean).join(" ")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.status === "expired" && (
                      <span className="text-xs font-medium text-red-700 flex items-center gap-1">
                        <AlertTriangle className="size-3.5" />Expiré
                      </span>
                    )}
                    {alert.status === "soon" && (
                      <span className="text-xs font-medium text-amber-700">Bientôt</span>
                    )}
                    <span className="text-xs text-sand-600">
                      {alert.deadlines.filter((d) => d.status === "expired" || d.status === "soon").map((d) => d.label).join(", ")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="px-5 py-4 border-b border-sand-200 flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">
            Réservations récentes
          </h2>
          <Link
            href="/admin/reservations"
            className="text-sm text-terracotta-600 hover:text-terracotta-700 inline-flex items-center gap-1"
          >
            Tout voir <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {recentReservations && recentReservations.length > 0 ? (
          <div className="divide-y divide-sand-200">
            {recentReservations.map((r) => (
              <Link
                key={r.id}
                href={`/admin/reservations/${r.id}`}
                className="block px-5 py-4 hover:bg-sand-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-terracotta-600">
                        {r.reference}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="text-sm text-ink truncate">
                      {(r as any).circuits?.title ?? "—"}
                    </div>
                    <div className="text-xs text-sand-600">
                      {(r as any).customers?.full_name ?? "Client introuvable"} ·{" "}
                      {formatDateShort(r.departure_date)} · {r.adults} adulte
                      {r.adults > 1 ? "s" : ""}
                      {r.children > 0 ? `, ${r.children}E` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="font-display text-lg text-terracotta-600 tabular-nums">
                      {formatMAD(r.total_amount_mad)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <CardBody>
            <p className="text-sm text-sand-700">
              Pas encore de réservation. Créez-en une via le bouton{" "}
              <span className="font-medium">Nouvelle réservation</span>.
            </p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  accent,
  warning,
}: {
  label: string;
  value: string | number;
  href?: string;
  accent?: boolean;
  warning?: boolean;
}) {
  const valueClass = accent
    ? "font-display text-3xl text-terracotta-600 tabular-nums"
    : warning
      ? "font-display text-3xl text-atlantic-700 tabular-nums"
      : "font-display text-3xl text-ink tabular-nums";

  const content = (
    <>
      <div className="text-xs uppercase tracking-wide text-sand-600 mb-2">
        {label}
      </div>
      <div className={valueClass}>{value}</div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block bg-white border border-sand-200 rounded-lg p-5 hover:border-terracotta-300 transition-colors"
      >
        {content}
      </Link>
    );
  }
  return (
    <div className="bg-white border border-sand-200 rounded-lg p-5">
      {content}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { tone: "warning" | "info" | "success" | "danger" | "neutral"; label: string }
  > = {
    pending: { tone: "warning", label: "En attente" },
    confirmed: { tone: "info", label: "Confirmée" },
    paid: { tone: "success", label: "Payée" },
    cancelled: { tone: "danger", label: "Annulée" },
    completed: { tone: "neutral", label: "Terminée" },
  };
  const c = config[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={c.tone}>{c.label}</Badge>;
}
