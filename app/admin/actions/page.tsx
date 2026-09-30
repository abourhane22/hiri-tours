import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getNotificationsForRequest, resolvedTasksToday } from "@/lib/notifications";
import { FAMILIES, FAMILY_META, PRIORITY_META, isUrgent, type TaskFamily } from "@/lib/tasks";
import { agencyTime } from "@/lib/tz";
import { KpiCard } from "@/components/kpi-card";
import { FamilyIcon, InfoIcon } from "@/components/actions/task-visuals";
import { AssignCell, MarkAllInfosReadButton, PrintSheetButton, SnoozeButton, type StaffOption } from "@/components/actions/action-controls";

type Tab = "todo" | "infos" | "resolved";
const STAFF_ROLES = ["admin", "commercial", "comptable"];

// Centre d'actions — même calcul que la cloche (un calcul serveur par chargement).
// Toutes les tâches ouvertes de l'équipe, y compris reportées par moi et assignées
// à un collègue (elles sortent seulement de MA pastille).
export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; domain?: string; mine?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab = params.tab === "infos" || params.tab === "resolved" ? params.tab : "todo";
  const domain = (FAMILIES as string[]).includes(params.domain ?? "") ? (params.domain as TaskFamily) : null;
  const mineOnly = params.mine === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (me as { role?: string } | null)?.role ?? null;

  const [data, resolved, staffRes] = await Promise.all([
    getNotificationsForRequest(user.id, role),
    resolvedTasksToday(supabase),
    supabase.from("profiles").select("id, full_name, role, is_active").in("role", STAFF_ROLES).order("full_name"),
  ]);
  const staff: StaffOption[] = ((staffRes.data ?? []) as any[])
    .filter((p) => p.is_active !== false)
    .map((p) => ({ id: p.id, name: p.full_name || "Membre de l'équipe" }));
  const staffName = new Map(staff.map((s) => [s.id, s.name]));

  const tasks = data.tasks;
  const overdue = tasks.filter((t) => t.priority === "overdue").length;
  const todayTasks = tasks.filter((t) => t.priority === "urgent" || t.priority === "today");
  const urgentToday = todayTasks.filter((t) => t.priority === "urgent").length;
  const week = tasks.filter((t) => t.priority === "week").length;
  const assignedToMe = tasks.filter((t) => t.assignee?.id === user.id).length;

  const scoped = tasks.filter((t) => (!mineOnly || t.assignee?.id === user.id) && (!domain || t.family === domain));
  const dateLabel = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Casablanca", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(data.computedAt));

  const href = (o: Partial<{ tab: Tab; domain: string | null; mine: boolean }>) => {
    const m = { tab, domain, mine: mineOnly, ...o };
    const sp = new URLSearchParams();
    if (m.tab !== "todo") sp.set("tab", m.tab);
    if (m.domain) sp.set("domain", m.domain);
    if (m.mine) sp.set("mine", "1");
    const q = sp.toString();
    return `/admin/actions${q ? `?${q}` : ""}`;
  };
  const chip = (active: boolean) =>
    `inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
      active ? "border-[#1A1F2E] bg-[#1A1F2E] text-white" : "border-[#E0DACF] bg-white text-[#58524A] hover:border-[#C9C4BA]"
    }`;
  const th = "px-3 py-2.5 text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A] text-left";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Exploitation · suivi du jour</p>
          <h1 className="font-display text-3xl tracking-[-0.02em] text-[#1A1F2E] mt-1">Centre d&apos;actions</h1>
          <p className="text-[13px] text-[#6B6862] mt-1">
            {tasks.length} action{tasks.length > 1 ? "s" : ""} ouverte{tasks.length > 1 ? "s" : ""} · {overdue} en retard · au {dateLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link href={href({ mine: !mineOnly, tab: "todo" })} className={chip(mineOnly)} aria-pressed={mineOnly}>
            Assignées à moi · <span className="tabular-nums">{assignedToMe}</span>
          </Link>
          <PrintSheetButton />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="En retard" value={String(overdue)} sub="échéance dépassée" />
        <KpiCard label="Aujourd'hui" value={String(todayTasks.length)} sub={`dont ${urgentToday} urgente${urgentToday > 1 ? "s" : ""}`} />
        <KpiCard label="Cette semaine" value={String(week)} sub="échéance dans les 7 jours" />
        <KpiCard
          label="Résolues aujourd'hui"
          value={resolved.error ? "—" : String(resolved.rows.length)}
          sub={resolved.error ? "journal indisponible" : "résolutions constatées depuis 00:00"}
        />
      </div>

      {/* Onglets */}
      <div role="tablist" className="flex flex-wrap items-center gap-1 border-b border-[#E5E0D7] mb-4 print:hidden">
        {(
          [
            { key: "todo", label: `À faire · ${tasks.length}` },
            { key: "infos", label: `Informations · ${data.infos.length}` },
            { key: "resolved", label: `Résolues · ${resolved.rows.length}` },
          ] as const
        ).map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            href={href({ tab: t.key })}
            className={`inline-flex h-11 items-center px-4 text-[13.5px] font-medium -mb-px border-b-2 transition-colors ${
              tab === t.key ? "border-[#1A1F2E] text-[#1A1F2E]" : "border-transparent text-[#6B6862] hover:text-[#1A1F2E]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "todo" && (
        <>
          <div className="flex gap-1.5 overflow-x-auto mb-4 print:hidden">
            <Link href={href({ domain: null })} className={chip(!domain)}>
              Tout <span className={!domain ? "text-white/80" : "text-[#968F84]"}>{tasks.filter((t) => !mineOnly || t.assignee?.id === user.id).length}</span>
            </Link>
            {FAMILIES.map((f) => {
              const n = tasks.filter((t) => t.family === f && (!mineOnly || t.assignee?.id === user.id)).length;
              return (
                <Link key={f} href={href({ domain: f })} className={chip(domain === f)}>
                  {FAMILY_META[f].label} <span className={domain === f ? "text-white/80" : "text-[#968F84]"}>{n}</span>
                </Link>
              );
            })}
          </div>

          {scoped.length === 0 ? (
            <div className="bg-white border border-[#E5E0D7] rounded-xl px-6 py-14 text-center">
              <p className="font-display text-xl tracking-[-0.02em] text-[#1A1F2E]">Rien à traiter</p>
              <p className="text-[13px] text-[#6B6862] mt-1">Toutes les actions de la journée sont faites.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E0D7] rounded-xl overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="border-b border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
                  <tr>
                    <th className={th}>Priorité</th>
                    <th className={th}>Action</th>
                    <th className={th}>Dossier</th>
                    <th className={th}>Client</th>
                    <th className={th}>Échéance</th>
                    <th className={th}>Assignée à</th>
                    <th className={`${th} print:hidden`} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EDE5]">
                  {scoped.map((t) => {
                    const pr = PRIORITY_META[t.priority];
                    const fam = FAMILY_META[t.family];
                    return (
                      <tr key={t.key} className="align-middle print:break-inside-avoid">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={{ backgroundColor: pr.bg, color: pr.color }}>
                            {pr.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 min-w-[240px]">
                          <div className="flex items-start gap-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: fam.tint, color: fam.color }} aria-hidden>
                              <FamilyIcon family={t.family} className="size-4" />
                            </span>
                            <div>
                              <p className="font-medium text-[#1A1F2E] leading-snug">{t.title}</p>
                              {t.detail && <p className="text-[12px] text-[#6B6862]">{t.detail}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link href={`/admin/reservations/${t.reservationId}`} className="font-mono text-[12px] text-[#1A1F2E] hover:text-[#C84B31]">
                            {t.reference}
                          </Link>
                          <p className="text-[12px] text-[#6B6862] truncate max-w-[200px]">
                            {t.product}
                            {t.pax ? ` · ${t.pax} pax` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-[#1A1F2E]">{t.client ?? "—"}</td>
                        <td className="px-3 py-2.5 text-[12.5px] text-[#58524A] whitespace-nowrap">{t.dueLabel}</td>
                        <td className="px-3 py-2.5">
                          <AssignCell taskKey={t.key} assignee={t.assignee} staff={staff} />
                        </td>
                        <td className="px-3 py-2.5 print:hidden">
                          <div className="flex items-center justify-end gap-1">
                            <SnoozeButton taskKey={t.key} snoozedUntil={t.snoozedUntil} />
                            <Link
                              href={t.action.href}
                              className="inline-flex h-11 items-center gap-1 rounded-lg bg-[#1A1F2E] px-4 text-[12.5px] font-medium text-white hover:bg-[#2A3142]"
                            >
                              {t.action.label} <ChevronRight className="size-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "infos" && (
        <div className="bg-white border border-[#E5E0D7] rounded-xl">
          <div className="flex justify-end border-b border-[#EEE9E0] px-3">
            <MarkAllInfosReadButton keys={data.infos.filter((i) => !i.read).map((i) => i.key)} />
          </div>
          {data.infos.length === 0 ? (
            <p className="px-6 py-12 text-center text-[13px] text-[#6B6862]">Aucune information pour le moment.</p>
          ) : (
            <ul className="divide-y divide-[#F1EDE5]">
              {data.infos.map((i) => (
                <li key={i.key} className="px-4 py-3 flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F1EFE8] text-[#58524A]" aria-hidden>
                    <InfoIcon kind={i.kind} className="size-[17px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13.5px] ${i.read ? "text-[#58524A]" : "font-medium text-[#1A1F2E]"}`}>
                      {!i.read && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#0C6B8A] align-middle" aria-label="Non lue" />}
                      {i.title}
                    </p>
                    <p className="text-[12px] text-[#6B6862]">{i.description}</p>
                    {i.lines && (
                      <details className="mt-1">
                        <summary className="inline-flex h-11 cursor-pointer items-center text-[12.5px] font-medium text-[#0C6B8A]">
                          Voir les {i.lines.length} départs
                        </summary>
                        <ul className="mt-1 space-y-0.5">
                          {i.lines.map((l, n) => (
                            <li key={n}>
                              <Link href={l.href} className="flex min-h-[44px] items-center justify-between gap-3 rounded-md px-2 text-[12.5px] hover:bg-[#FBF9F5]">
                                <span className="text-[#1A1F2E]">{l.label}</span>
                                <span className="text-[#6B6862] tabular-nums">{l.detail}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <Link href={i.href} className="inline-flex h-11 items-center text-[12.5px] font-medium text-[#0C6B8A] hover:underline">
                      {i.hrefLabel ?? "Ouvrir"}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "resolved" && (
        <div className="bg-white border border-[#E5E0D7] rounded-xl overflow-x-auto">
          <p className="px-4 py-2.5 text-[12px] text-[#6B6862] border-b border-[#EEE9E0]">
            Tâches dont la cause a disparu aujourd&apos;hui (heure de Casablanca), constatées au calcul suivant. Les
            tâches sorties de leur fenêtre (départ passé) ou liées à un dossier annulé ne sont pas comptées.
          </p>
          {resolved.rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-[13px] text-[#6B6862]">Aucune tâche résolue aujourd&apos;hui pour le moment.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-[#E5E0D7]" style={{ backgroundColor: "#FBF9F5" }}>
                <tr>
                  <th className={th}>Résolue à</th>
                  <th className={th}>Action</th>
                  <th className={th}>Dossier</th>
                  <th className={th}>Assignée à</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EDE5]">
                {resolved.rows.map((r) => (
                  <tr key={r.task_key}>
                    <td className="px-3 py-2.5 tabular-nums text-[#6B6862]">{agencyTime(r.resolved_at)}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-md" style={{ backgroundColor: FAMILY_META[r.family]?.tint, color: FAMILY_META[r.family]?.color }} aria-hidden>
                          <FamilyIcon family={r.family} className="size-3.5" />
                        </span>
                        {r.title}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.reservation_id ? (
                        <Link href={`/admin/reservations/${r.reservation_id}`} className="font-mono text-[12px] text-[#1A1F2E] hover:text-[#C84B31]">
                          {r.reference}
                        </Link>
                      ) : (
                        r.reference ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[#58524A]">{r.assignee_id ? staffName.get(r.assignee_id) ?? "—" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p className="mt-4 text-[11px] text-[#968F84] tabular-nums print:mt-2">
        Calculé à {agencyTime(data.computedAt)} · {tasks.filter(isUrgent).length} action{tasks.filter(isUrgent).length > 1 ? "s" : ""} en retard ou urgente{tasks.filter(isUrgent).length > 1 ? "s" : ""}
      </p>
    </div>
  );
}
