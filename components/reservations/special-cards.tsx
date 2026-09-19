"use client";

import { useActionState } from "react";
import { Check, Plane, BedDouble, Loader2 } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/input";
import { formatDateShort } from "@/lib/utils";
import { MEAL_PLANS, MEAL_PLAN_LABEL, stayDates } from "@/lib/dossier-profile";
import { updateArrivalInfo, updateStayInfo, type SpecialActionState } from "@/app/admin/reservations/[id]/special-actions";

const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[12px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-60 transition-colors";

function localParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const p = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}

/** Transfert : vol et heure d'arrivée attendus par le chauffeur. */
export function ArrivalCard({
  reservationId,
  departureDate,
  flightNumber,
  arrivalAt,
  readOnly,
}: {
  reservationId: string;
  departureDate: string;
  flightNumber: string | null;
  arrivalAt: string | null;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState<SpecialActionState, FormData>(updateArrivalInfo.bind(null, reservationId), { ok: true });
  const parts = localParts(arrivalAt);

  if (readOnly) {
    return (
      <div className="text-[13px] text-[#1A1F2E] space-y-1">
        <div className="flex items-center gap-2">
          <Plane className="size-4 text-[#968F84]" />
          <span className="font-mono">{flightNumber ?? "—"}</span>
          {arrivalAt && <span className="text-[#6B6862]">· arrivée le {formatDateShort(parts.date)} à {parts.time}</span>}
        </div>
        {!flightNumber && !arrivalAt && <p className="text-[12px] text-[#968F84] italic">Aucune information d&apos;arrivée.</p>}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2.5">
      {state.ok === false && <p className="text-[12px] text-[#791F1F] bg-[#FCEBEB] border border-[#F7C1C1] rounded-lg px-3 py-2">{state.error}</p>}
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <Label htmlFor="arrival_flight_number">N° de vol</Label>
          <Input id="arrival_flight_number" name="arrival_flight_number" defaultValue={flightNumber ?? ""} placeholder="AT 1234" className="font-mono uppercase" />
        </div>
        <div>
          <Label htmlFor="arrival_date">Date d&apos;arrivée</Label>
          <Input id="arrival_date" name="arrival_date" type="date" defaultValue={parts.date || departureDate} />
        </div>
        <div>
          <Label htmlFor="arrival_time">Heure</Label>
          <Input id="arrival_time" name="arrival_time" type="time" defaultValue={parts.time} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#968F84]">Repris sur le manifeste du chauffeur.</p>
        <button type="submit" disabled={pending} className={btn}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Enregistrer
        </button>
      </div>
      {state.ok && state.savedAt && <p className="text-[11.5px]" style={{ color: "#085041" }}>Arrivée enregistrée.</p>}
    </form>
  );
}

/** Hébergement : check-in / check-out (dérivés), nuits, chambres, régime. */
export function StayCard({
  reservationId,
  departureDate,
  nights,
  rooms,
  mealPlan,
  readOnly,
}: {
  reservationId: string;
  departureDate: string;
  nights: number | null;
  rooms: number | null;
  mealPlan: string | null;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState<SpecialActionState, FormData>(updateStayInfo.bind(null, reservationId), { ok: true });
  const s = stayDates(departureDate, nights);
  const r = Math.max(1, Number(rooms) || 1);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-[13px]">
        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}>
          <div className="text-[10.5px] uppercase tracking-wide text-[#968F84]">Check-in</div>
          <div className="text-[#1A1F2E] font-medium">{formatDateShort(s.checkIn)}</div>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}>
          <div className="text-[10.5px] uppercase tracking-wide text-[#968F84]">Check-out</div>
          <div className="text-[#1A1F2E] font-medium">{formatDateShort(s.checkOut)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[12.5px] text-[#6B6862]">
        <BedDouble className="size-4 text-[#968F84]" />
        {s.nights} nuit{s.nights > 1 ? "s" : ""} · {r} chambre{r > 1 ? "s" : ""}
        {readOnly && <> · {mealPlan ? MEAL_PLAN_LABEL[mealPlan] ?? mealPlan : "régime non précisé"}</>}
      </div>
      {!readOnly && (
        <form action={action} className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="meal_plan">Régime</Label>
            <Select id="meal_plan" name="meal_plan" defaultValue={mealPlan ?? ""}>
              <option value="">— Non précisé —</option>
              {MEAL_PLANS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </div>
          <button type="submit" disabled={pending} className={`${btn} h-10`}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Enregistrer
          </button>
        </form>
      )}
      {state.ok === false && <p className="text-[12px] text-[#791F1F]">{state.error}</p>}
      {state.ok && state.savedAt && <p className="text-[11.5px]" style={{ color: "#085041" }}>Séjour enregistré.</p>}
    </div>
  );
}
