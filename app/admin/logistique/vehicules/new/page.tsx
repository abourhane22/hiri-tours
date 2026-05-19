import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { createVehicle } from "../actions";

export default function NewVehiculePage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/admin/logistique/vehicules" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour aux véhicules
      </Link>
      <div className="mb-8">
        <p className="eyebrow mb-2">Module 5 — Logistique</p>
        <h1 className="font-display text-3xl text-ink">Nouveau véhicule</h1>
      </div>

      <form action={createVehicle} className="bg-white border border-sand-200 rounded-lg p-6 space-y-5">
        <div>
          <Label htmlFor="registration">Immatriculation *</Label>
          <Input id="registration" name="registration" required placeholder="12345 - A - 6" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label htmlFor="make">Marque</Label><Input id="make" name="make" placeholder="Toyota" /></div>
          <div><Label htmlFor="model">Modèle</Label><Input id="model" name="model" placeholder="Hiace" /></div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="type">Type</Label>
            <Select id="type" name="type" defaultValue="van">
              <option value="sedan">Berline</option>
              <option value="van">Van</option>
              <option value="4x4">4x4</option>
              <option value="minibus">Minibus</option>
              <option value="bus">Bus</option>
            </Select>
          </div>
          <div><Label htmlFor="capacity">Capacité (pax)</Label><Input id="capacity" name="capacity" type="number" min="1" defaultValue="4" required /></div>
          <div><Label htmlFor="color">Couleur</Label><Input id="color" name="color" placeholder="Blanc" /></div>
        </div>
        <div><Label htmlFor="notes">Notes (entretien, assurance...)</Label><Textarea id="notes" name="notes" rows={3} /></div>
        <label className="flex items-center gap-2 pt-3 border-t border-sand-200">
          <input type="checkbox" name="is_active" defaultChecked className="size-4 rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500" />
          <span className="text-sm text-ink">Actif (disponible pour affectation)</span>
        </label>
        <div className="flex justify-end gap-3 pt-3 border-t border-sand-200">
          <Link href="/admin/logistique/vehicules"><Button type="button" variant="secondary">Annuler</Button></Link>
          <Button type="submit">Créer le véhicule</Button>
        </div>
      </form>
    </div>
  );
}
