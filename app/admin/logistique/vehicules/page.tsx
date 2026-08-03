import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, Plus, Pencil, AlertTriangle } from "lucide-react";
import { getVehicleAlertStatus, type DeadlineEntry } from "@/lib/vehicle-alerts";
import { formatDateShort } from "@/lib/utils";
import type { Vehicle } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  sedan: "Berline",
  van: "Van",
  "4x4": "4x4",
  minibus: "Minibus",
  bus: "Bus",
};

const SHORT_LABEL: Record<string, string> = {
  Vidange: "Vidange",
  Assurance: "Assurance",
  "Visite technique": "Visite tech.",
  Vignette: "Vignette",
};

const URGENCY_BORDER: Record<string, string | null> = {
  expired: "#A32D2D",
  soon: "#D98324",
  ok: null,
};

const RANK: Record<string, number> = { expired: 0, soon: 1, ok: 2 };

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function VehiculesPage() {
  const supabase = await createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("*").order("registration");
  const fleet = (vehicles as Vehicle[]) || [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = ymd(today);

  // Prochain départ par véhicule — une seule requête groupée pour toute la flotte.
  const nextByVehicle = new Map<string, { date: string; time: string | null }>();
  const fleetIds = fleet.map((v) => v.id);
  if (fleetIds.length > 0) {
    const { data: deps } = await supabase
      .from("reservations")
      .select("vehicle_id, departure_date, circuit:circuits(category_fields)")
      .in("vehicle_id", fleetIds)
      .neq("status", "cancelled")
      .gte("departure_date", todayStr)
      .order("departure_date", { ascending: true });
    for (const r of (deps as any[]) || []) {
      if (!r.vehicle_id || nextByVehicle.has(r.vehicle_id)) continue;
      nextByVehicle.set(r.vehicle_id, {
        date: r.departure_date,
        time: r.circuit?.category_fields?.departure_time ?? null,
      });
    }
  }

  const rows = fleet
    .map((v) => ({ v, alert: getVehicleAlertStatus(v), next: nextByVehicle.get(v.id) ?? null }))
    .sort(
      (a, b) =>
        RANK[a.alert.status] - RANK[b.alert.status] ||
        a.alert.nextDeadline - b.alert.nextDeadline,
    );

  // Synthèse globale
  const totalPlaces = fleet.reduce((s, v) => s + (v.capacity || 0), 0);
  let expiredDocs = 0;
  let soonDocs = 0;
  for (const { alert } of rows) {
    for (const d of alert.deadlines) {
      if (d.status === "expired") expiredDocs++;
      else if (d.status === "soon") soonDocs++;
    }
  }

  function nextDepartureLabel(next: { date: string; time: string | null } | null): string {
    if (!next) return "aucun départ planifié";
    const isToday = next.date === todayStr;
    const base = isToday ? "aujourd'hui" : formatDateShort(next.date);
    if (next.time) return `${base}${isToday ? " " : " · "}${next.time}`;
    return base;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link
        href="/admin/logistique"
        className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4"
      >
        <ArrowLeft className="size-4" /> Retour à la logistique
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">
            Logistique · Flotte
          </p>
          <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Véhicules · {fleet.length}</h1>
        </div>
        <Link
          href="/admin/logistique/vehicules/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A1F2E] text-white text-sm font-medium px-3.5 py-2 hover:bg-[#2A3142] transition-colors"
        >
          <Plus className="size-4" /> Nouveau véhicule
        </Link>
      </div>

      <p className="text-[12px] text-[#6B6862] mb-5">
        {totalPlaces} place{totalPlaces > 1 ? "s" : ""} au total
        {expiredDocs > 0 && (
          <span style={{ color: "#791F1F" }} className="font-medium">
            {" "}· {expiredDocs} document{expiredDocs > 1 ? "s" : ""} expiré{expiredDocs > 1 ? "s" : ""}
          </span>
        )}
        {soonDocs > 0 && (
          <span style={{ color: "#B25F0B" }}>
            {" "}· {soonDocs} échéance{soonDocs > 1 ? "s" : ""} sous 30 jours
          </span>
        )}
      </p>

      {rows.length === 0 ? (
        <div className="bg-white border border-[#E5E0D7] rounded-xl p-8 text-center text-[#6B6862]">
          Aucun véhicule. Ajoutez-en un avec le bouton ci-dessus.
        </div>
      ) : (
        rows.map(({ v, alert, next }) => {
          const border = URGENCY_BORDER[alert.status];
          return (
            <div
              key={v.id}
              className="bg-white border border-[#E5E0D7] px-4 py-3 mb-2.5 flex gap-3.5 items-center flex-wrap"
              style={
                border
                  ? { borderLeft: `3px solid ${border}`, borderRadius: "0 12px 12px 0" }
                  : { borderRadius: "12px" }
              }
            >
              {/* Plaque */}
              <span className="shrink-0 font-mono text-[12px] bg-[#1A1F2E] text-white rounded-md px-2.5 py-1 tracking-wider">
                {v.registration}
              </span>

              {/* Bloc principal */}
              <div className="flex-1 min-w-[150px]">
                <div className="text-[#1A1F2E]">
                  <span className="font-medium">
                    {[v.make, v.model].filter(Boolean).join(" ") || "—"}
                  </span>
                  {v.color && <span className="text-[#968F84]"> · {v.color}</span>}
                </div>
                <div className="text-[11px] text-[#968F84]">
                  {TYPE_LABELS[v.type] ?? v.type} · {v.capacity} pax · prochain départ :{" "}
                  {nextDepartureLabel(next)}
                </div>
              </div>

              {/* Tuiles d'échéance */}
              <div className="grid grid-cols-2 gap-1.5 w-full order-last mt-1 md:mt-0 md:w-auto md:order-none md:flex md:gap-2">
                {alert.deadlines.map((d) => (
                  <DeadlineTile key={d.label} d={d} />
                ))}
              </div>

              {/* Édition */}
              <Link
                href={`/admin/logistique/vehicules/${v.id}`}
                aria-label={`Modifier ${v.registration}`}
                className="shrink-0 size-[30px] rounded-lg border border-[#E0DACF] bg-white flex items-center justify-center text-[#6B6862] hover:text-[#1A1F2E] hover:border-[#1A1F2E] transition-colors"
              >
                <Pencil className="size-4" />
              </Link>
            </div>
          );
        })
      )}

      {/* Légende */}
      {rows.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#6B6862]">
          <LegendSquare color="#0F6E56" label="À jour" />
          <LegendSquare color="#D98324" label="Sous 30 jours" />
          <LegendSquare color="#A32D2D" label="Expiré / manquant" />
          <span className="ml-auto text-[#968F84]">
            Bordure de carte = échéance la plus urgente du véhicule
          </span>
        </div>
      )}
    </div>
  );
}

function DeadlineTile({ d }: { d: DeadlineEntry }) {
  const palette =
    d.status === "ok"
      ? { bg: "#E1F5EE", label: "#5A9A88", date: "#085041" }
      : d.status === "soon"
        ? { bg: "#FAEEDA", label: "#A9834A", date: "#633806" }
        : { bg: "#FCEBEB", label: "#A96A6A", date: "#791F1F" };

  const dateText = d.date ? formatDateShort(d.date) : "Non rens.";

  return (
    <div className="rounded-lg px-2 py-1 min-w-[88px]" style={{ backgroundColor: palette.bg }}>
      <div
        className="text-[9px] tracking-wide uppercase font-medium flex items-center gap-1"
        style={{ color: palette.label }}
      >
        {d.status === "expired" && <AlertTriangle className="size-3" />}
        {SHORT_LABEL[d.label] ?? d.label}
      </div>
      <div className="text-[11px] font-medium" style={{ color: palette.date }}>
        {dateText}
        {d.status === "soon" && d.daysLeft != null ? ` · ${d.daysLeft} j` : ""}
      </div>
    </div>
  );
}

function LegendSquare({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
