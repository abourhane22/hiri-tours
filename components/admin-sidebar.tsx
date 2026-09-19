"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { userCan, ROLE_LABELS, type Permission, type UserRole } from "@/lib/permissions";
import { ADMIN_NAV, SETTINGS_ITEM, leafIsActive, childIsActive, type NavLeaf, type NavGroup } from "@/lib/admin-nav";

export type SidebarUser = { email: string; name: string | null; role: string };
export type NavCounts = { pending: number };

const NAVY = "#1A1F2E";
const NAVY_ACTIVE = "#2A3142";
const NAVY_HOVER = "#232939";
const TERRACOTTA = "#C84B31";

/** Filtre permission → groupes non vides uniquement. */
export function visibleNav(role: string): NavGroup[] {
  const can = (p?: Permission) => !p || userCan(role, p);
  return ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items
      .filter((i) => can(i.permission))
      .map((i) => ({ ...i, children: i.children?.filter((c) => can(c.permission)) })),
  })).filter((g) => g.items.length > 0);
}

export function initials(name: string | null, email: string): string {
  const src = (name && name.trim()) || email.split("@")[0];
  const parts = src.replace(/[._-]+/g, " ").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Monogram({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-display font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: TERRACOTTA, fontSize: size * 0.5 }}
      aria-hidden
    >
      H
    </span>
  );
}

/**
 * Sidebar verticale groupée par métier. Sticky, repliable (préférence mémorisée
 * en localStorage, lue APRÈS montage pour éviter tout décalage SSR/CSR).
 * Masquée sous lg (le panneau mobile prend le relais) et à l'impression.
 */
export function AdminSidebar({
  user,
  counts,
  collapsed,
  onToggleCollapsed,
}: {
  user: SidebarUser;
  counts: NavCounts;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const groups = visibleNav(user.role);
  const canSettings = userCan(user.role, SETTINGS_ITEM.permission!);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col sticky top-0 h-screen shrink-0 text-white print:hidden transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
      style={{ backgroundColor: NAVY }}
      aria-label="Navigation principale"
    >
      {/* En-tête */}
      <Link
        href="/admin"
        className={cn("flex items-center gap-3 h-14 shrink-0 border-b border-white/10", collapsed ? "justify-center px-0" : "px-4")}
        title="Hiri Tours — Plateforme"
      >
        <Monogram />
        {!collapsed && (
          <span className="flex flex-col leading-tight min-w-0">
            <span className="font-display text-[17px] text-white truncate">Hiri Tours</span>
            <span className="text-[9px] uppercase tracking-[0.25em] font-medium" style={{ color: "#FFB89A" }}>
              Plateforme
            </span>
          </span>
        )}
      </Link>

      {/* Groupes */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 [scrollbar-width:thin]">
        {groups.map((g, gi) => (
          <div key={g.label ?? "home"} className={cn(gi > 0 && "mt-4")}>
            {g.label &&
              (collapsed ? (
                <div className="mx-4 my-2 h-px bg-white/10" aria-hidden />
              ) : (
                <div className="px-5 mb-1.5 text-[10px] uppercase tracking-[0.18em] font-medium" style={{ color: "#8B92A5" }}>
                  {g.label}
                </div>
              ))}
            <ul className="space-y-0.5 px-2.5">
              {g.items.map((item) => (
                <SidebarItem key={item.href} item={item} pathname={pathname} collapsed={collapsed} counts={counts} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pied */}
      <div className="shrink-0 border-t border-white/10 px-2.5 py-2.5 space-y-1">
        {canSettings && <SidebarItem item={SETTINGS_ITEM} pathname={pathname} collapsed={collapsed} counts={counts} />}

        <div className={cn("flex items-center gap-2.5 rounded-lg px-2 py-2", collapsed && "justify-center px-0")}>
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
            style={{ backgroundColor: NAVY_ACTIVE, color: "#FFB89A" }}
            title={collapsed ? `${user.name ?? user.email} · ${ROLE_LABELS[user.role as UserRole] ?? user.role}` : undefined}
          >
            {initials(user.name, user.email)}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-[13px] text-white truncate">{user.name ?? user.email}</span>
                <span className="block text-[11px] truncate" style={{ color: "#8B92A5" }}>
                  {ROLE_LABELS[user.role as UserRole] ?? user.role}
                </span>
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="inline-flex size-8 items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  title="Déconnexion"
                  aria-label="Déconnexion"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </>
          )}
        </div>
        {collapsed && (
          <form action="/auth/signout" method="post" className="flex justify-center">
            <button
              type="submit"
              className="inline-flex size-9 items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-white/60 hover:text-white hover:bg-white/10 transition-colors",
            collapsed && "justify-center px-0",
          )}
          title={collapsed ? "Déployer le menu" : "Réduire le menu"}
          aria-label={collapsed ? "Déployer le menu" : "Réduire le menu"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Réduire le menu</span>}
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({ item, pathname, collapsed, counts }: { item: NavLeaf; pathname: string; collapsed: boolean; counts: NavCounts }) {
  const Icon = item.icon;
  const active = leafIsActive(pathname, item);
  const [hover, setHover] = useState(false);
  const badge = item.badge === "pending" ? counts.pending : 0;
  const children = item.children ?? [];
  const showChildren = !collapsed && children.length > 0 && (active || hover);

  return (
    <li onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className="relative group/item">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-lg h-9 text-[13.5px] transition-colors",
          collapsed ? "justify-center px-0" : "px-3",
          active ? "text-white" : "text-white/75 hover:text-white",
        )}
        style={{ backgroundColor: active ? NAVY_ACTIVE : undefined }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = NAVY_HOVER; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = ""; }}
        title={collapsed ? item.label : undefined}
      >
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r" style={{ backgroundColor: TERRACOTTA }} aria-hidden />
        )}
        <Icon className="size-[18px] shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {badge > 0 && (
          <span
            className={cn(
              "inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-semibold text-white",
              collapsed && "absolute -top-0.5 -right-0.5",
            )}
            style={{ backgroundColor: TERRACOTTA }}
            title={`${badge} dossier${badge > 1 ? "s" : ""} à traiter`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>

      {/* Tooltip en mode compact */}
      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] text-white opacity-0 shadow-lg transition-opacity group-hover/item:opacity-100"
          style={{ backgroundColor: NAVY_ACTIVE, border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {item.label}
          {badge > 0 && <span className="ml-1.5" style={{ color: "#FFB89A" }}>· {badge} à traiter</span>}
        </span>
      )}

      {showChildren && (
        <ul className="mt-0.5 mb-1 ml-[22px] border-l border-white/10 pl-2.5 space-y-0.5">
          {children.map((c) => {
            const CIcon = c.icon;
            const cActive = childIsActive(pathname, c);
            return (
              <li key={c.href}>
                <Link
                  href={c.href}
                  aria-current={cActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md h-8 px-2.5 text-[12.5px] transition-colors",
                    cActive ? "text-white" : "text-white/65 hover:text-white hover:bg-white/5",
                  )}
                  style={{ backgroundColor: cActive ? NAVY_ACTIVE : undefined }}
                >
                  <CIcon className="size-3.5 shrink-0" />
                  <span className="truncate">{c.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
