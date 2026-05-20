import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { DocumentsManager } from "@/components/documents-manager";
import { DateWithStatusInput } from "@/components/date-with-status-input";
import { ArrowLeft, Trash2 } from "lucide-react";
import { updateVehicle, deleteVehicle } from "../actions";
import type { Vehicle } from "@/lib/types";

export default async function EditVehiculePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (!vehicle) notFound();
  const v = vehicle as Vehicle;
  const updateBound = updateVehicle.bind(null, id);
  const deleteBound = deleteVehicle.bind(null, id);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/admin/logistique/vehicules" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour aux véhicules
      </Link>
      <div className="mb-8">
        <p className="eyebrow mb-2">Module 5 — Logistique</p>
        <h1 className="font-display text-3xl text-ink">Modifier le véhicule</h1>
        <p className="text-sm text-sand-700 mt-1 font-mono">{v.registration}</p>
      </div>

      <form action={updateBound} className="bg-white border border-sand-200 rounded-lg p-6 space-y-5">
        <div><Label htmlFor="registration">Immatriculation *</Label><Input id="registration" name="registration" required defaultValue={v.registration} /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label htmlFor="make">Marque</Label><Input id="make" name="make" defaultValue={v.make ?? ""} /></div>
          <div><Label htmlFor="model">Modèle</Label><Input id="model" name="model" defaultValue={v.model ?? ""} /></div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="type">Type</Label>
            <Select id="type" name="type" defaultValue={v.type}>
              <option value="sedan">Berline</option>
              <option value="van">Van</option>
              <option value="4x4">4x4</option>
              <option value="minibus">Minibus</option>
              <option value="bus">Bus</option>
            </Select>
          </div>
          <div><Label htmlFor="capacity">Capacité (pax)</Label><Input id="capacity" name="capacity" type="number" min="1" defaultValue={v.capacity} required /></div>
          <div><Label htmlFor="color">Couleur</Label><Input id="color" name="color" defaultValue={v.color ?? ""} /></div>
        </div>

        <div className="pt-3 border-t border-sand-200 space-y-4">
          <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">Échéances</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <DateWithStatusInput id="next_maintenance_date" name="next_maintenance_date" label="Prochaine vidange (date)" defaultValue={v.next_maintenance_date} />
            <div><Label htmlFor="next_maintenance_km">Prochaine vidange (km)</Label><Input id="next_maintenance_km" name="next_maintenance_km" type="number" min="0" defaultValue={v.next_maintenance_km ?? ""} /></div>
            <DateWithStatusInput id="insurance_expires_on" name="insurance_expires_on" label="Expiration assurance" defaultValue={v.insurance_expires_on} />
            <DateWithStatusInput id="inspection_expires_on" name="inspection_expires_on" label="Expiration visite technique" defaultValue={v.inspection_expires_on} />
            <div className="sm:col-span-2"><DateWithStatusInput id="vignette_expires_on" name="vignette_expires_on" label="Expiration vignette" defaultValue={v.vignette_expires_on} /></div>
          </div>
        </div>

        <div className="pt-3 border-t border-sand-200">
          <DocumentsManager name="documents" bucket="vehicle-documents" defaultValue={v.documents} label="Documents (carte grise, assurance, visite technique, factures d'entretien...)" />
        </div>

        <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={3} defaultValue={v.notes ?? ""} /></div>

        <label className="flex items-center gap-2 pt-3 border-t border-sand-200">
          <input type="checkbox" name="is_active" defaultChecked={v.is_active} className="size-4 rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500" />
          <span className="text-sm text-ink">Actif</span>
        </label>

        <div className="flex justify-end gap-3 pt-3 border-t border-sand-200">
          <Link href="/admin/logistique/vehicules"><Button type="button" variant="secondary">Annuler</Button></Link>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>

      <form action={deleteBound} className="mt-6">
        <Card className="border-red-200">
          <div className="px-5 py-4 border-b border-red-200 bg-red-50">
            <h2 className="font-display text-lg text-red-900">Zone de danger</h2>
          </div>
          <CardBody>
            <p className="text-sm text-sand-800 mb-4">Suppression définitive. Impossible si le véhicule est lié à des réservations.</p>
            <Button type="submit" variant="danger" size="sm"><Trash2 className="size-3.5" />Supprimer</Button>
          </CardBody>
        </Card>
      </form>
    </div>
  );
}
