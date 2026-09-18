import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Home, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort, formatDate } from "@/lib/utils";
import { formatWeekdays, COMMITMENT_LABEL, ON_EXHAUSTED_LABEL, dayState, DAY_STATE_STYLE } from "@/lib/allotments";
import { KpiCard } from "@/components/kpi-card";
import { AllotmentCalendar, monthBounds, monthKey } from "@/components/allotment-calendar";
import { AllotmentForm, type ContractOption } from "@/components/allotment-form";
import { AllotmentDangerZone } from "@/components/allotment-danger-zone";
import { updateAllotment } from "../actions";
import type { Allotment, AllotmentDay, AllotmentMovement } from "@/lib/types";

type Row = Allotment & {
  circuits: { title: string; max_participants: number } | { title: string; max_participants: number }[] | null;
  supplier_contracts:
    | { label: string; suppliers: { name: string } | { name: string }[] | null }
    | { label: string; suppliers: { name: string } | { name: string }[] | null }[]
    | null;
};
type MovementRow = AllotmentMovement & {
  reservations: { reference: string; status: string } | { reference: string; status: string }[] | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : v ?? null);

export default async function AllotmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string; day?: string; created?: string }>;
}) {
  const { id } = await params;
  const { m, day: selectedDay, created } = await searchParams;
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("allotments")
    .select("*, circuits(title, max_participants), supplier_contracts(label, suppliers(name))")
    .eq("id", id)
    .single();
  if (!row) notFound();
  const a = row as unknown as Row;
  const product = one(a.circuits);
  const contract = one(a.supplier_contracts);
  const supplier = contract ? one(contract.suppliers) : null;

  const todayStr = new Date().toISOString().slice(0, 10);
  // Mois affiché : celui d'aujourd'hui s'il est dans la période, sinon le début.
  const defaultMonth =
    todayStr >= a.starts_on && todayStr <= a.ends_on ? todayStr.slice(0, 7) : a.starts_on.slice(0, 7);
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : defaultMonth;
  const { start, end } = monthBounds(month);

  const [{ data: monthDays }, { data: futureDays }, { data: contractRows }, { data: allDayIds }] = await Promise.all([
    supabase.from("allotment_days").select("*").eq("allotment_id", id).gte("day", start).lte("day", end).order("day"),
    supabase.from("allotment_days").select("quota, sold, released").eq("allotment_id", id).gte("day", todayStr),
    supabase.from("supplier_contracts").select("id, label, release_days_default, suppliers(name)").eq("status", "active").order("label"),
    supabase.from("allotment_days").select("id").eq("allotment_id", id),
  ]);

  // Mouvements rattachés (toutes dates) : conditionne la suppression.
  // Pas de sous-requête côté PostgREST → liste d'ids, et 0 si aucun jour.
  const dayIds = ((allDayIds ?? []) as { id: string }[]).map((d) => d.id);
  let movementCount = 0;
  if (dayIds.length > 0) {
    const { count } = await supabase
      .from("allotment_movements")
      .select("id", { count: "exact", head: true })
      .in("allotment_day_id", dayIds);
    movementCount = count ?? 0;
  }

  const days = (monthDays ?? []) as AllotmentDay[];
  const future = (futureDays ?? []) as Pick<AllotmentDay, "quota" | "sold" | "released">[];
  const open = future.filter((d) => !d.released);
  const kQuota = open.reduce((s, d) => s + d.quota, 0);
  const kSold = open.reduce((s, d) => s + d.sold, 0);
  const kFull = open.filter((d) => d.sold >= d.quota).length;
  const kReleased = future.length - open.length;

  // Jour sélectionné : son compteur + ses mouvements.
  let selected: AllotmentDay | null = null;
  let movements: MovementRow[] = [];
  if (selectedDay && /^\d{4}-\d{2}-\d{2}$/.test(selectedDay)) {
    selected = days.find((d) => d.day === selectedDay) ?? null;
    if (!selected) {
      const { data } = await supabase.from("allotment_days").select("*").eq("allotment_id", id).eq("day", selectedDay).maybeSingle();
      selected = (data as AllotmentDay | null) ?? null;
    }
    if (selected) {
      const { data } = await supabase
        .from("allotment_movements")
        .select("*, reservations(reference, status)")
        .eq("allotment_day_id", selected.id)
        .order("created_at", { ascending: false });
      movements = (data ?? []) as unknown as MovementRow[];
    }
  }

  const contracts: ContractOption[] = ((contractRows ?? []) as any[]).map((c) => ({
    id: c.id,
    label: c.label,
    supplierName: one<{ name: string }>(c.suppliers)?.name ?? "Fournisseur",
    releaseDaysDefault: Number(c.release_days_default) || 0,
  }));

  const cardLabel = "flex items-center gap-1.5 text-[10.5px] tracking-[1.4px] uppercase text-[#968F84] font-medium";
  const baseHref = `/admin/allotements/${id}`;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/admin/allotements" className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4">
        <ArrowLeft className="size-4" /> Retour aux allotements
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Ressources · Allotement</p>
          <div className="flex items-center gap-3 flex-wrap mt-1.5">
            <h1 className="font-display text-[26px] text-[#1A1F2E] leading-none">{a.label}</h1>
            {!a.is_active && (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: "#FAEEDA", color: "#633806" }}>
                Désactivé
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#6B6862] mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-[#1A1F2E]">{product?.title ?? "Produit"}</span>
            <span>·</span>
            {a.contract_id ? (
              <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5" />{supplier?.name} · {contract?.label}</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><Home className="size-3.5" />Capacité propre</span>
            )}
            <span>·</span>
            <span>{formatDate(a.starts_on)} → {formatDate(a.ends_on)}</span>
            <span>·</span>
            <span>{formatWeekdays(a.weekdays)}</span>
          </p>
        </div>
      </div>

      {created && (
        <div className="mb-6 rounded-lg px-3 py-2.5 text-[13px]" style={{ backgroundColor: "#E1F5EE", border: "1px solid #A9DFCC", color: "#085041" }}>
          Allotement créé — les compteurs sont matérialisés. Le produit est désormais piloté sur cette période.
        </div>
      )}

      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <KpiCard label="Quota par jour" value={String(a.quota_per_day)} sub={`${COMMITMENT_LABEL[a.commitment]} · ${ON_EXHAUSTED_LABEL[a.on_exhausted].toLowerCase()}`} />
        <KpiCard label="Places restantes" value={String(Math.max(0, kQuota - kSold))} accent="ocean" sub={`${kSold} vendues sur ${kQuota} · jours à venir`} />
        <KpiCard label="Départs complets" value={String(kFull)} accent={kFull > 0 ? "amber" : undefined} sub={`sur ${open.length} jour${open.length > 1 ? "s" : ""} ouvert${open.length > 1 ? "s" : ""}`} />
        <KpiCard label="Release" value={a.release_days > 0 ? `J−${a.release_days}` : "aucun"} sub={kReleased > 0 ? `${kReleased} jour${kReleased > 1 ? "s" : ""} déjà libéré${kReleased > 1 ? "s" : ""}` : "aucun jour libéré"} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start mb-6">
        <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <span className={cardLabel}>Calendrier — quota / vendu / restant</span>
          <div className="mt-3">
            <AllotmentCalendar
              month={month}
              days={days}
              periodStart={a.starts_on}
              periodEnd={a.ends_on}
              selectedDay={selected?.day ?? null}
              baseHref={baseHref}
              today={todayStr}
            />
          </div>
        </div>

        <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
          <span className={cardLabel}>Mouvements du jour</span>
          {!selected ? (
            <p className="text-[13px] text-[#968F84] mt-3">Cliquez sur un jour du calendrier pour voir ses mouvements.</p>
          ) : (
            <div className="mt-3">
              {(() => {
                const st = dayState(selected);
                const style = DAY_STATE_STYLE[st];
                return (
                  <div className="rounded-lg px-3 py-2.5 mb-3" style={{ backgroundColor: style.bg }}>
                    <div className="text-[13px] font-medium" style={{ color: style.color }}>{formatDate(selected.day)}</div>
                    <div className="text-[12px] tabular-nums" style={{ color: style.color }}>
                      {selected.sold} / {selected.quota} vendu{selected.sold > 1 ? "s" : ""} · {style.label}
                    </div>
                  </div>
                );
              })()}
              {movements.length === 0 ? (
                <p className="text-[12px] text-[#968F84] italic">Aucun mouvement ce jour.</p>
              ) : (
                <ul className="space-y-1.5">
                  {movements.map((mv) => {
                    const r = one(mv.reservations);
                    const isConsume = mv.kind === "consume";
                    return (
                      <li key={mv.id} className="flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-[12px]" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}>
                        <span className="min-w-0">
                          <span className="inline-flex items-center gap-1 font-medium" style={{ color: isConsume ? "#0C447C" : "#085041" }}>
                            {isConsume ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                            {isConsume ? "Consommé" : "Libéré"} · {mv.qty}
                          </span>
                          <span className="block text-[11px] text-[#6B6862]">
                            {mv.reservation_id && r ? (
                              <Link href={`/admin/reservations/${mv.reservation_id}`} className="font-mono hover:text-[#C84B31]">{r.reference}</Link>
                            ) : (
                              "manuel"
                            )}
                            {" · "}{mv.reason}
                          </span>
                        </span>
                        <span className="text-[11px] text-[#968F84] tabular-nums shrink-0">{formatDateShort(mv.created_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <AllotmentForm
          mode="edit"
          action={updateAllotment.bind(null, id)}
          cancelHref="/admin/allotements"
          products={[]}
          contracts={contracts}
          productTitle={product?.title}
          defaults={{
            productId: a.product_id,
            origin: a.contract_id ? "contract" : "own",
            contractId: a.contract_id ?? "",
            label: a.label,
            startsOn: a.starts_on,
            endsOn: a.ends_on,
            quotaPerDay: String(a.quota_per_day),
            weekdays: a.weekdays,
            releaseDays: String(a.release_days),
            commitment: a.commitment,
            onExhausted: a.on_exhausted,
            isActive: a.is_active,
            notes: a.notes ?? "",
          }}
        />
        <AllotmentDangerZone allotmentId={id} label={a.label} movementCount={movementCount ?? 0} />
      </div>
    </div>
  );
}
