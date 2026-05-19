import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { ArrowLeft, Plus, AlertTriangle, Bell } from "lucide-react";
import { getVehicleAlertStatus } from "@/lib/vehicle-alerts";
import type { Vehicle } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  sedan: "Berline", van: "Van", "4x4": "4x4", minibus: "Minibus", bus: "Bus",
};

export default async function VehiculesPage() {
  const supabase = await createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("*").order("registration");

  return (
    <div className="p-8 max-w-6xl mx-auto">
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
              <th className="text-left px-5 py-3 font-medium text-sand-800">Échéances</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {vehicles && vehicles.length > 0 ? (vehicles as Vehicle[]).map((v) => {
              const alert = getVehicleAlertStatus(v);
              return (
                <tr key={v.id} className="hover:bg-sand-50">
                  <td className="px-5 py-4">
                    <Link href={`/admin/logistique/vehicules/${v.id}`} className="font-mono text-sm text-terracotta-600 hover:text-terracotta-700 hover:underline">{v.registration}</Link>
                  </td>
                  <td className="px-5 py-4 text-ink">
                    {[v.make, v.model].filter(Boolean).join(" ") || "—"}
                    {v.color && <span className="text-xs text-sand-600 ml-2">({v.color})</span>}
                  </td>
                  <td className="px-5 py-4 text-sand-800">{TYPE_LABELS[v.type] ?? v.type}</td>
                  <td className="px-5 py-4 text-right tabular-nums">{v.capacity} pax</td>
                  <td className="px-5 py-4 text-xs">
                    {alert.status === "expired" && (
                      <div className="text-red-700 font-medium flex items-center gap-1"><AlertTriangle className="size-3.5" />Expiré</div>
                    )}
                    {alert.status === "soon" && (
                      <div className="text-amber-700 font-medium flex items-center gap-1"><Bell className="size-3.5" />Bientôt</div>
                    )}
                    {alert.status === "ok" && <div className="text-emerald-700">À jour</div>}
                    {alert.status === "none" && <span className="text-sand-500">—</span>}
                    {(alert.status === "expired" || alert.status === "soon") && (
                      <div className="text-[10px] text-sand-700 mt-0.5">
                        {alert.deadlines.filter((d) => d.status !== "ok").map((d) => d.label).join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
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
