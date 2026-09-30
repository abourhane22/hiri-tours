"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, X, ChevronDown, CircleCheck, Printer } from "lucide-react";
import {
  FAMILIES,
  FAMILY_META,
  PRIORITY_META,
  badgeCount,
  isMine,
  isUrgent,
  type InfoItem,
  type NotificationsData,
  type Task,
  type TaskFamily,
} from "@/lib/tasks";
import { agencyTime } from "@/lib/tz";
import { fetchNotifications, markInfosRead, snoozeTask, unsnoozeTask } from "@/app/admin/notification-actions";
import { useToast } from "@/components/ui/toaster";
import { FamilyIcon, InfoIcon } from "@/components/actions/task-visuals";

type Segment = "todo" | "infos";

/**
 * Cloche du bandeau : des TÂCHES À RÉSOUDRE, pas des messages à lire.
 * La pastille compte les tâches ouvertes non reportées, non assignées ou
 * assignées à moi. Les informations se marquent comme lues et ne comptent pas.
 */
export function NotificationBell({ initial, variant = "dark" }: { initial: NotificationsData | null; variant?: "dark" | "light" }) {
  const [data, setData] = useState<NotificationsData | null>(initial);
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<Segment>("todo");
  const [family, setFamily] = useState<"all" | TaskFamily>("all");
  const [, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => setData(initial), [initial]);

  useEffect(() => {
    if (!open) return;
    // Un calcul serveur par ouverture du panneau (source de vérité).
    fetchNotifications().then((d) => d && setData(d)).catch(() => {});
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const now = Date.now();
  const mine = useMemo(() => (data ? data.tasks.filter((t) => isMine(t, data.userId, now)) : []), [data, now]);
  const badge = data ? badgeCount(data, now) : 0;
  const urgent = mine.filter(isUrgent).length;
  const infos = data?.infos ?? [];
  const unreadInfos = infos.filter((i) => !i.read).length;
  const filtered = family === "all" ? mine : mine.filter((t) => t.family === family);
  const groups = [
    { key: "today" as const, label: "Aujourd'hui", items: filtered.filter((t) => t.group === "today") },
    { key: "week" as const, label: "Cette semaine", items: filtered.filter((t) => t.group === "week") },
  ].filter((g) => g.items.length > 0);

  function onSnooze(t: Task) {
    startTransition(async () => {
      const res = await snoozeTask(t.key);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setData((d) => (d ? { ...d, tasks: d.tasks.map((x) => (x.key === t.key ? { ...x, snoozedUntil: res.until } : x)) } : d));
      toast.show({ type: "success", message: `Reportée à demain ${agencyTime(res.until)}`, action: { label: "Annuler", onClick: () => onUndo(t.key) } });
    });
  }

  function onUndo(key: string) {
    setData((d) => (d ? { ...d, tasks: d.tasks.map((x) => (x.key === key ? { ...x, snoozedUntil: null } : x)) } : d));
    startTransition(async () => {
      await unsnoozeTask(key);
    });
  }

  function markRead(keys: string[]) {
    if (keys.length === 0) return;
    setData((d) => (d ? { ...d, infos: d.infos.map((i) => (keys.includes(i.key) ? { ...i, read: true } : i)) } : d));
    markInfosRead(keys).catch(() => {});
  }

  const bellCls =
    variant === "light"
      ? "text-[#1A1F2E] hover:bg-[#FBF9F5] border border-[#E0DACF]"
      : "text-white/80 hover:text-white hover:bg-white/10";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={badge > 0 ? `Notifications — ${badge} action${badge > 1 ? "s" : ""} à traiter` : "Notifications"}
        aria-expanded={open}
        className={`relative inline-flex size-11 items-center justify-center rounded-md transition-colors ${bellCls}`}
      >
        <Bell className="size-[18px]" />
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#C84B31] text-white text-[11px] font-semibold leading-5 text-center tabular-nums">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-0 z-50 flex flex-col bg-white sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[460px] sm:max-h-[min(80vh,720px)] sm:rounded-xl sm:border sm:border-[#E5E0D7] sm:shadow-xl overflow-hidden"
        >
          {/* En-tête */}
          <div className="px-4 pt-4 pb-3 border-b border-[#EEE9E0]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-[20px] leading-tight tracking-[-0.02em] text-[#1A1F2E] m-0">Notifications</h2>
                <p className="text-[12px] text-[#6B6862] mt-0.5">
                  {mine.length === 0
                    ? "Aucune action en attente"
                    : `${mine.length} action${mine.length > 1 ? "s" : ""}${urgent > 0 ? ` · dont ${urgent} urgente${urgent > 1 ? "s" : ""}` : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href="/admin/actions"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center rounded-md px-3 text-[12.5px] font-medium text-[#0C6B8A] hover:bg-[#F2F8FA]"
                >
                  Tout voir
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="inline-flex size-11 items-center justify-center rounded-md text-[#6B6862] hover:bg-[#FBF9F5]"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Contrôle segmenté */}
            <div role="tablist" className="mt-3 grid grid-cols-2 rounded-lg bg-[#F1EFE8] p-1">
              {(
                [
                  { key: "todo", label: `À faire · ${mine.length}` },
                  { key: "infos", label: `Informations · ${infos.length}` },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={segment === s.key}
                  type="button"
                  onClick={() => setSegment(s.key)}
                  className={`h-10 rounded-md text-[13px] font-medium transition-colors ${
                    segment === s.key ? "bg-white text-[#1A1F2E] shadow-sm" : "text-[#6B6862] hover:text-[#1A1F2E]"
                  }`}
                >
                  {s.label}
                  {s.key === "infos" && unreadInfos > 0 && segment !== "infos" && (
                    <span className="ml-1.5 inline-block size-1.5 rounded-full bg-[#0C6B8A] align-middle" aria-label={`${unreadInfos} non lues`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Corps */}
          <div className="flex-1 overflow-y-auto">
            {segment === "todo" ? (
              <>
                <div className="flex gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-[#F1EDE5]">
                  {(["all", ...FAMILIES] as const).map((f) => {
                    const n = f === "all" ? mine.length : mine.filter((t) => t.family === f).length;
                    const active = family === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFamily(f)}
                        aria-pressed={active}
                        className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
                          active ? "border-[#1A1F2E] bg-[#1A1F2E] text-white" : "border-[#E0DACF] bg-white text-[#58524A] hover:border-[#C9C4BA]"
                        }`}
                      >
                        {f === "all" ? "Tout" : FAMILY_META[f].label}
                        <span className={`tabular-nums ${active ? "text-white/80" : "text-[#968F84]"}`}>{n}</span>
                      </button>
                    );
                  })}
                </div>

                {groups.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <CircleCheck className="mx-auto size-8 text-[#0F6E56]" />
                    <p className="mt-2 text-[13.5px] text-[#1A1F2E] font-medium">Rien à traiter</p>
                    <p className="text-[12.5px] text-[#6B6862]">Toutes les actions de la journée sont faites.</p>
                  </div>
                ) : (
                  groups.map((g) => (
                    <section key={g.key}>
                      <h3 className="sticky top-0 z-10 flex items-center justify-between bg-[#FBF9F5] px-4 py-1.5 text-[10.5px] font-medium uppercase tracking-[1.4px] text-[#968F84] border-b border-[#F1EDE5]">
                        {g.label}
                        <span className="tabular-nums">{g.items.length}</span>
                      </h3>
                      <ul className="divide-y divide-[#F1EDE5]">
                        {g.items.map((t) => (
                          <TaskItem key={t.key} task={t} onSnooze={() => onSnooze(t)} onNavigate={() => setOpen(false)} />
                        ))}
                      </ul>
                    </section>
                  ))
                )}
              </>
            ) : (
              <InfoList infos={infos} onRead={markRead} onNavigate={() => setOpen(false)} />
            )}
          </div>

          {/* Pied */}
          <div className="flex items-center justify-between gap-3 border-t border-[#EEE9E0] px-4 py-1">
            <Link
              href="/admin/actions"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 items-center text-[12.5px] font-medium text-[#1A1F2E] hover:text-[#C84B31]"
            >
              Ouvrir le centre d&apos;actions
            </Link>
            {data && <span className="text-[11px] text-[#968F84] tabular-nums">Mis à jour à {agencyTime(data.computedAt)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskItem({ task: t, onSnooze, onNavigate }: { task: Task; onSnooze: () => void; onNavigate: () => void }) {
  const fam = FAMILY_META[t.family];
  const pr = PRIORITY_META[t.priority];
  const meta = [t.product, t.pax ? `${t.pax} pax` : null, t.client].filter(Boolean).join(" · ");
  return (
    <li className="px-4 py-3">
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: fam.tint, color: fam.color }} aria-hidden>
          <FamilyIcon family={t.family} className="size-[17px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium leading-snug text-[#1A1F2E]">{t.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-[#6B6862]">
            {t.reference && <span className="font-mono text-[11.5px] text-[#1A1F2E]">{t.reference}</span>}
            {t.reference && meta && " · "}
            {meta}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={{ backgroundColor: pr.bg, color: pr.color }}>
              <span className="sr-only">{pr.label} — </span>
              {t.dueLabel}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onSnooze}
                className="inline-flex h-11 items-center rounded-lg px-3 text-[12.5px] font-medium text-[#58524A] hover:bg-[#F1EFE8]"
              >
                Plus tard
              </button>
              <Link
                href={t.action.href}
                onClick={onNavigate}
                className="inline-flex h-11 items-center rounded-lg bg-[#1A1F2E] px-4 text-[12.5px] font-medium text-white hover:bg-[#2A3142]"
              >
                {t.action.label}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function InfoList({ infos, onRead, onNavigate }: { infos: InfoItem[]; onRead: (keys: string[]) => void; onNavigate: () => void }) {
  const unread = infos.filter((i) => !i.read);
  if (infos.length === 0) {
    return <p className="px-6 py-12 text-center text-[13px] text-[#6B6862]">Aucune information pour le moment.</p>;
  }
  return (
    <div>
      <div className="flex justify-end border-b border-[#F1EDE5] px-3 py-0.5">
        <button
          type="button"
          onClick={() => onRead(unread.map((i) => i.key))}
          disabled={unread.length === 0}
          className="h-11 px-2 text-[12.5px] font-medium text-[#0C6B8A] hover:underline disabled:text-[#B4AEA3] disabled:no-underline"
        >
          Tout marquer comme lu
        </button>
      </div>
      <ul className="divide-y divide-[#F1EDE5]">
        {infos.map((i) => (
          <li key={i.key} className="px-4 py-3">
            <div className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F1EFE8] text-[#58524A]" aria-hidden>
                <InfoIcon kind={i.kind} className="size-[17px]" />
              </span>
              <div className="min-w-0 flex-1">
                {i.lines ? (
                  <details onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && !i.read && onRead([i.key])}>
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2">
                      <span className={`text-[13.5px] leading-snug ${i.read ? "text-[#58524A]" : "font-medium text-[#1A1F2E]"}`}>
                        {!i.read && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#0C6B8A] align-middle" aria-label="Non lue" />}
                        {i.title}
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-[#968F84]" />
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                      {i.lines.map((l, n) => (
                        <li key={n}>
                          <Link href={l.href} onClick={onNavigate} className="flex min-h-[44px] items-center justify-between gap-3 rounded-md px-2 text-[12.5px] hover:bg-[#FBF9F5]">
                            <span className="text-[#1A1F2E]">{l.label}</span>
                            <span className="shrink-0 text-[#6B6862] tabular-nums">{l.detail}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {i.hrefLabel && (
                      <Link href={i.href} onClick={onNavigate} className="mt-1 inline-flex h-11 items-center gap-1.5 text-[12.5px] font-medium text-[#0C6B8A] hover:underline">
                        <Printer className="size-3.5" /> {i.hrefLabel}
                      </Link>
                    )}
                  </details>
                ) : (
                  <Link
                    href={i.href}
                    onClick={() => {
                      if (!i.read) onRead([i.key]);
                      onNavigate();
                    }}
                    className="block min-h-[44px]"
                  >
                    <span className={`block text-[13.5px] leading-snug ${i.read ? "text-[#58524A]" : "font-medium text-[#1A1F2E]"}`}>
                      {!i.read && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#0C6B8A] align-middle" aria-label="Non lue" />}
                      {i.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[#6B6862]">{i.description}</span>
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
