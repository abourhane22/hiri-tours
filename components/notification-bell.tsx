"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Truck, Banknote, Calendar, X, ChevronRight } from "lucide-react";
import type { AppNotification, NotifFamily, NotifPriority } from "@/lib/notifications";
import { fetchNotifications, markNotificationsRead } from "@/app/admin/notification-actions";

const PRIORITY_STYLE: Record<NotifPriority, { border: string; iconBg: string; icon: string }> = {
  terracotta: { border: "#C84B31", iconBg: "#FBEBE6", icon: "#C84B31" },
  amber: { border: "#D98324", iconBg: "#FAEEDA", icon: "#B25F0B" },
  info: { border: "#0C447C", iconBg: "#E6F1FB", icon: "#0C447C" },
  success: { border: "#0F6E56", iconBg: "#E1F5EE", icon: "#0F6E56" },
};

const FAMILY_ICON: Record<NotifFamily, typeof Truck> = {
  logistique: Truck,
  paiements: Banknote,
  reservations: Calendar,
};

const TABS: { key: "all" | NotifFamily; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "logistique", label: "Logistique" },
  { key: "paiements", label: "Paiements" },
  { key: "reservations", label: "Réservations" },
];

function isActionable(n: AppNotification) {
  return n.priority === "terracotta" || n.priority === "amber";
}

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
function relative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") return rtf.format(Math.round(diff / ms), unit);
  }
  return "";
}

export function NotificationBell({ initial }: { initial: AppNotification[] }) {
  const router = useRouter();
  const [notifs, setNotifs] = useState<AppNotification[]>(initial);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | NotifFamily>("all");
  const wrapRef = useRef<HTMLDivElement>(null);

  const badge = notifs.filter((n) => isActionable(n) && !n.read).length;

  const familyCount = (key: "all" | NotifFamily) =>
    key === "all" ? notifs.length : notifs.filter((n) => n.family === key).length;

  useEffect(() => {
    if (!open) return;
    // Recalcul à chaque ouverture (source de vérité serveur).
    fetchNotifications().then(setNotifs).catch(() => {});
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

  const visible = useMemo(
    () => (tab === "all" ? notifs : notifs.filter((n) => n.family === tab)),
    [notifs, tab],
  );
  const actionRequired = visible.filter(isActionable);
  const recent = visible.filter((n) => !isActionable(n));

  function markReadLocal(keys: string[]) {
    setNotifs((prev) => prev.map((n) => (keys.includes(n.key) ? { ...n, read: true } : n)));
    markNotificationsRead(keys).catch(() => {});
  }

  function openNotif(n: AppNotification) {
    if (!n.read) markReadLocal([n.key]);
    setOpen(false);
    router.push(n.href);
  }

  function markAll() {
    const keys = notifs.filter((n) => !n.read).map((n) => n.key);
    if (keys.length) markReadLocal(keys);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative size-8 rounded-md border border-navy-400/50 text-navy-100 hover:bg-navy-600 flex items-center justify-center transition-colors"
      >
        <Bell className="size-4" />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-terracotta-600 text-white text-[10.5px] font-semibold flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 sm:bg-transparent sm:inset-auto sm:absolute sm:right-0 sm:top-full sm:mt-2">
          <div className="fixed inset-x-0 bottom-0 top-0 sm:static sm:w-[420px] bg-white sm:rounded-xl border border-sand-200 shadow-xl flex flex-col max-h-screen sm:max-h-[75vh] overflow-hidden text-ink">
            {/* En-tête */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-sand-200">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base text-ink">Notifications</h2>
                {badge > 0 && (
                  <span className="text-[11px] font-medium text-terracotta-700 bg-terracotta-50 rounded-full px-2 py-0.5">
                    {badge} à traiter
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={markAll}
                  className="text-[12px] text-sand-700 hover:text-ink px-2 py-1 rounded hover:bg-sand-50"
                >
                  Tout marquer comme lu
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="sm:hidden size-8 rounded-md flex items-center justify-center text-sand-700 hover:bg-sand-50"
                  aria-label="Fermer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Onglets */}
            <div className="flex gap-1 px-3 py-2 border-b border-sand-200 overflow-x-auto">
              {TABS.map((t) => {
                const active = tab === t.key;
                const count = familyCount(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${
                      active ? "bg-navy-700 text-white" : "text-sand-700 hover:bg-sand-100"
                    }`}
                  >
                    {t.label}
                    {count > 0 && <span className={active ? "opacity-80" : "text-sand-500"}> · {count}</span>}
                  </button>
                );
              })}
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto">
              {visible.length === 0 ? (
                <p className="text-sm text-sand-600 text-center py-12 px-4">
                  Rien à signaler pour l&apos;instant.
                </p>
              ) : (
                <>
                  {actionRequired.length > 0 && (
                    <Group title="Action requise">
                      {actionRequired.map((n) => (
                        <NotifRow key={n.key} n={n} onOpen={openNotif} />
                      ))}
                    </Group>
                  )}
                  {recent.length > 0 && (
                    <Group title="Activité récente">
                      {recent.map((n) => (
                        <NotifRow key={n.key} n={n} onOpen={openNotif} />
                      ))}
                    </Group>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-sand-500">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function NotifRow({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  const style = PRIORITY_STYLE[n.priority];
  const Icon = FAMILY_ICON[n.family];
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className="w-full text-left flex gap-3 px-4 py-3 hover:bg-sand-50 transition-colors border-b border-sand-100"
      style={{ borderLeft: `3px solid ${n.read ? "transparent" : style.border}` }}
    >
      <span
        className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: style.iconBg, color: style.icon }}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={`text-[13px] leading-snug ${n.read ? "text-sand-700" : "text-ink font-medium"}`}>
            {n.title}
          </span>
          <span className="text-[10.5px] text-sand-500 shrink-0 whitespace-nowrap">{relative(n.at)}</span>
        </span>
        <span className="block text-[12px] text-sand-600 mt-0.5 leading-snug">{n.description}</span>
        <span className="mt-1.5 inline-flex items-center gap-0.5 text-[12px] font-medium text-terracotta-700">
          Ouvrir le dossier <ChevronRight className="size-3.5" />
        </span>
      </span>
    </button>
  );
}
