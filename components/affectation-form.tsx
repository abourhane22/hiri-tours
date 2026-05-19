"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { updateAffectation } from "@/app/admin/reservations/[id]/affectation-actions";
import { AlertTriangle, Truck, User, Edit } from "lucide-react";

type Vehicle = { id: string; registration: string; make: string | null; model: string | null; capacity: number };
type Staff = { id: string; full_name: string; role: string };

type Props = {
  reservationId: string;
  totalPax: number;
  current: { vehicle_id: string | null; guide_id: string | null; driver_id: string | null };
  currentNames: { vehicle: string | null; guide: string | null; driver: string | null };
  vehicles: Vehicle[];
  staff: Staff[];
  conflictedVehicleIds: string[];
  conflictedStaffIds: string[];
};

export function AffectationForm(props: Props) {
  const [open, setOpen] = useState(false);
  const action = updateAffectation.bind(null, props.reservationId);
  const guides = props.staff.filter((s) => s.role === "guide" || s.role === "both");
  const drivers = props.staff.filter((s) => s.role === "driver" || s.role === "both");

  if (!open) {
    return (
      <div className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Truck className="size-4 text-sand-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-sand-600">Véhicule</div>
              <div className="text-ink">{props.currentNames.vehicle ?? <span className="text-sand-500 italic">Non affecté</span>}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User className="size-4 text-sand-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-sand-600">Guide</div>
              <div className="text-ink">{props.currentNames.guide ?? <span className="text-sand-500 italic">Non affecté</span>}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User className="size-4 text-sand-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-sand-600">Chauffeur</div>
              <div className="text-ink">{props.currentNames.driver ?? <span className="text-sand-500 italic">Non affecté</span>}</div>
            </div>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} variant="secondary" size="sm" className="w-full">
          <Edit className="size-3.5" /> Modifier l&apos;affectation
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="vehicle_id">Véhicule</Label>
        <Select id="vehicle_id" name="vehicle_id" defaultValue={props.current.vehicle_id ?? ""}>
          <option value="">— Aucun —</option>
          {props.vehicles.map((v) => {
            const conflict = props.conflictedVehicleIds.includes(v.id);
            const tooSmall = v.capacity < props.totalPax;
            const label = `${v.registration}${v.make ? ` · ${v.make} ${v.model || ""}` : ""} (${v.capacity} pax)${conflict ? " ⚠ conflit" : ""}${tooSmall ? " — capacité insuffisante" : ""}`;
            return <option key={v.id} value={v.id}>{label}</option>;
          })}
        </Select>
      </div>

      <div>
        <Label htmlFor="guide_id">Guide</Label>
        <Select id="guide_id" name="guide_id" defaultValue={props.current.guide_id ?? ""}>
          <option value="">— Aucun —</option>
          {guides.map((g) => {
            const conflict = props.conflictedStaffIds.includes(g.id);
            return <option key={g.id} value={g.id}>{g.full_name}{conflict ? " ⚠ conflit" : ""}</option>;
          })}
        </Select>
      </div>

      <div>
        <Label htmlFor="driver_id">Chauffeur</Label>
        <Select id="driver_id" name="driver_id" defaultValue={props.current.driver_id ?? ""}>
          <option value="">— Aucun —</option>
          {drivers.map((d) => {
            const conflict = props.conflictedStaffIds.includes(d.id);
            return <option key={d.id} value={d.id}>{d.full_name}{conflict ? " ⚠ conflit" : ""}</option>;
          })}
        </Select>
      </div>

      {(props.conflictedVehicleIds.length > 0 || props.conflictedStaffIds.length > 0) && (
        <div className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <p>Certaines ressources sont déjà affectées à un autre départ le même jour. L&apos;affectation est possible mais à vérifier.</p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm" onClick={() => setOpen(false)}>Enregistrer</Button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-sand-700 hover:text-ink">Annuler</button>
      </div>
    </form>
  );
}
