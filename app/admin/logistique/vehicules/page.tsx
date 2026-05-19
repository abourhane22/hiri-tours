import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { ArrowLeft, Plus } from "lucide-react";
import { getVehicleAlertStatus, type DeadlineEntry } from "@/lib/vehicle-alerts";
import { formatDateShort } from "@/lib/utils";
import type { Vehicle } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  sedan: "Berline", van: "Van", "4x4": "4x4", minibus: "Minibus", bus: "Bus",
};

function DeadlineCard({ d }: { d: DeadlineEntry }) {
  const classes =
    d.status === "expired" ? "bg-red-50 border-red-200 text-red-800" :
    d.status === "soon" ? "bg-amber-50 border-amber-200 text-amber-900" :
    d.status === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
    "bg-sand-50 border-sand-200 text-sand-500";
  return (
    <div className={`text-[10px] px-2 py-1 rounded border ${classes}`}>
      <div className="font-medium leading-tight">{d.label}</div>
      <div className="text-[9px] opacity-80 leading-tight mt-0.5">
        {d.date ? formatDateShort(d.date) : "non renseignée"}
      </div>
    </div>
  );
}

export default async function VehiculesPage() {
  const supabase = await createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("*").order("registration");

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin/logistique" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour à la logistique
      </Link>

      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Module 5 — Logistique</p>
          <h1 className="font-display text-3xl text-ink">Véhicules</h1>
        </div>
        <Link href="/admin/logistique/vehicules/new"><Button><Plus className="size-4" />Nouveau véhicule</Button></Link>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Immatriculation</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Modèle</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Type</th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">Capacité</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800 min-w-[280px]">Échéances</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {vehicles && vehicles.length > 0 ? (vehicles as Vehicle[]).map((v) => {
              const alert = getVehicleAlertStatus(v);
              return (
                <tr key={v.id} className="hover:bg-sand-50">
                  <td className="px-5 py-4 align-top">
                    <Link href={`/admin/logistique/vehicules/${v.id}`} className="font-mono text-sm text-terracotta-600 hover:text-terracotta-700 hover:underline">{v.registration}</Link>
                  </td>
                  <td className="px-5 py-4 text-ink align-top">
                    {[v.make, v.model].filter(Boolean).join(" ") || "—"}
                    {v.color && <span className="text-xs text-sand-600 ml-2">({v.color})</span>}
                  </td>
                  <td className="px-5 py-4 text-sand-800 align-top">{TYPE_LABELS[v.type] ?? v.type}</td>
                  <td className="px-5 py-4 text-right tabular-nums align-top">{v.capacity} pax</td>
                  <td className="px-5 py-4 align-top">
                    <div className="grid grid-cols-2 gap-1.5">
                      {alert.deadlines.map((d) => <DeadlineCard key={d.label} d={d} />)}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <Badge tone={v.is_active ? "success" : "neutral"}>{v.is_active ? "Actif" : "Inactif"}</Badge>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-sand-700">Aucun véhicule. Ajoutez-en un avec le bouton ci-dessus.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
