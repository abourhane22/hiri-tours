"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminSidebar, Monogram, initials, visibleNav, type SidebarUser, type NavCounts } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { SETTINGS_ITEM, leafIsActive, childIsActive } from "@/lib/admin-nav";
import { userCan, ROLE_LABELS, type UserRole } from "@/lib/permissions";
import type { AppNotification } from "@/lib/notifications";

const STORAGE_KEY = "hiri.admin.sidebar.collapsed";

/**
 * Coque du backoffice : sidebar (≥ lg) + bandeau + contenu, et panneau
 * plein écran sous lg. Les pages ne changent pas : `main` reçoit `children`
 * tel quel, avec `min-w-0` pour que les écrans larges défilent en interne.
 */
export function AdminShell({
  user,
  counts,
  notifications,
  children,
}: {
  user: SidebarUser;
  counts: NavCounts;
  notifications: AppNotification[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Préférence lue après montage (jamais pendant le rendu serveur).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);
  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  // Panneau mobile : fermeture à la navigation, à Échap ; verrou du scroll.
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-sand-50">
      <AdminSidebar user={user} counts={counts} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminTopbar notifications={notifications} onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      {mobileOpen && <MobileNav user={user} counts={counts} pathname={pathname} onClose={() => setMobileOpen(false)} />}
    </div>
  );
}

function MobileNav({ user, counts, pathname, onClose }: { user: SidebarUser; counts: NavCounts; pathname: string; onClose: () => void }) {
  const groups = visibleNav(user.role);
  const canSettings = userCan(user.role, SETTINGS_ITEM.permission!);
  return (
    <div className="fixed inset-0 z-50 lg:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      {/* Clic extérieur */}
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fermer le menu" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-full max-w-[360px] flex flex-col text-white shadow-2xl" style={{ backgroundColor: "#1A1F2E" }}>
        <div className="flex items-center justify-between h-14 px-4 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-3" onClick={onClose}>
            <Monogram />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-[17px]">Hiri Tours</span>
              <span className="text-[9px] uppercase tracking-[0.25em] font-medium" style={{ color: "#FFB89A" }}>Plateforme</span>
            </span>
          </Link>
          <button type="button" onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-md text-white/80 hover:bg-white/10" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {groups.map((g, gi) => (
            <div key={g.label ?? "home"} className={cn(gi > 0 && "mt-4")}>
              {g.label && (
                <div className="px-5 mb-1.5 text-[10px] uppercase tracking-[0.18em] font-medium" style={{ color: "#8B92A5" }}>{g.label}</div>
              )}
              <ul className="space-y-0.5 px-2.5">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const active = leafIsActive(pathname, item);
                  const badge = item.badge === "pending" ? counts.pending : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={cn("relative flex items-center gap-3 rounded-lg h-11 px-3 text-[14px]", active ? "text-white" : "text-white/80")}
                        style={{ backgroundColor: active ? "#2A3142" : undefined }}
                      >
                        {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ backgroundColor: "#C84B31" }} aria-hidden />}
                        <Icon className="size-[18px]" />
                        <span className="flex-1">{item.label}</span>
                        {badge > 0 && (
                          <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-semibold" style={{ backgroundColor: "#C84B31" }}>
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </Link>
                      {item.children && item.children.length > 0 && (
                        <ul className="ml-[22px] border-l border-white/10 pl-2.5 my-0.5 space-y-0.5">
                          {item.children.map((c) => {
                            const CIcon = c.icon;
                            const cActive = childIsActive(pathname, c);
                            return (
                              <li key={c.href}>
                                <Link
                                  href={c.href}
                                  onClick={onClose}
                                  className={cn("flex items-center gap-2 rounded-md h-9 px-2.5 text-[13px]", cActive ? "text-white" : "text-white/65")}
                                  style={{ backgroundColor: cActive ? "#2A3142" : undefined }}
                                >
                                  <CIcon className="size-3.5" />
                                  {c.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-2.5 py-2.5 space-y-1">
          {canSettings && (
            <Link
              href={SETTINGS_ITEM.href}
              onClick={onClose}
              className={cn("flex items-center gap-3 rounded-lg h-11 px-3 text-[14px]", pathname.startsWith(SETTINGS_ITEM.href) ? "text-white" : "text-white/80")}
              style={{ backgroundColor: pathname.startsWith(SETTINGS_ITEM.href) ? "#2A3142" : undefined }}
            >
              <SETTINGS_ITEM.icon className="size-[18px]" />
              {SETTINGS_ITEM.label}
            </Link>
          )}
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold" style={{ backgroundColor: "#2A3142", color: "#FFB89A" }}>
              {initials(user.name, user.email)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[13px] truncate">{user.name ?? user.email}</span>
              <span className="block text-[11px] truncate" style={{ color: "#8B92A5" }}>{ROLE_LABELS[user.role as UserRole] ?? user.role}</span>
            </span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] text-white/80 hover:bg-white/10" title="Déconnexion">
                <LogOut className="size-4" /> Déconnexion
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
