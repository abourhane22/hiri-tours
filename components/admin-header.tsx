"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard, Calendar, Map, Users, Receipt, FileText, BarChart3, LogOut, Settings, Truck, Wallet, ChevronDown, Package, Compass, Tag, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { userCan, type Permission } from "@/lib/permissions";

type NavItem = { href: string; label: string; icon: any; exact?: boolean; permission?: Permission };
type NavGroup = { label: string; icon: any; match: string[]; items: NavItem[]; permission?: Permission };

const topLevelStart: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true, permission: "viewDashboard" },
  { href: "/admin/reservations", label: "Réservations", icon: Calendar, permission: "viewReservations" },
  { href: "/admin/calendrier", label: "Calendrier", icon: Calendar, permission: "viewCalendrier" },
  { href: "/admin/manifestes", label: "Manifestes", icon: FileText, permission: "viewManifestes" },
  { href: "/admin/clients", label: "Clients", icon: Users, permission: "viewClients" },
];

const ressourcesGroup: NavGroup = {
  label: "Ressources",
  icon: Package,
  match: ["/admin/circuits", "/admin/logistique"],
  permission: "viewCircuits",
  items: [
    { href: "/admin/circuits", label: "Catalogue", icon: Map, permission: "viewCircuits" },
    { href: "/admin/logistique", label: "Logistique", icon: Truck, permission: "viewLogistique" },
  ],
};

const financeGroup: NavGroup = {
  label: "Finance",
  icon: Wallet,
  match: ["/admin/factures", "/admin/finance"],
  permission: "viewFinance",
  items: [
    { href: "/admin/finance/pilotage", label: "Pilotage", icon: Target },
    { href: "/admin/factures", label: "Factures", icon: Receipt },
    { href: "/admin/finance/depenses", label: "Dépenses", icon: Wallet },
    { href: "/admin/finance/pnl", label: "P&L mensuel", icon: BarChart3 },
    { href: "/admin/finance/resultat-annuel", label: "Compte de résultat annuel", icon: BarChart3 },
    { href: "/admin/finance/rentabilite", label: "Rentabilité par circuit", icon: Compass },
    { href: "/admin/finance/categories", label: "Catégories de coûts", icon: Tag },
  ],
};

const groups = [ressourcesGroup, financeGroup];

const topLevelEnd: NavItem[] = [
  { href: "/admin/rapports", label: "Rapports", icon: BarChart3, permission: "viewRapports" },
];

export function AdminHeader({ userEmail, userRole }: { userEmail?: string; userRole?: string }) {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const role = userRole ?? "admin";

  function can(permission?: Permission): boolean {
    if (!permission) return true;
    return userCan(role, permission);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  function isItemActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  function isGroupActive(group: NavGroup) {
    return group.match.some((m) => pathname.startsWith(m));
  }

  function isSubItemActive(item: NavItem) {
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  const visibleTopStart = topLevelStart.filter((item) => can(item.permission));
  const visibleGroups = groups
    .filter((g) => can(g.permission))
    .map((g) => ({ ...g, items: g.items.filter((item) => can(item.permission)) }));
  const visibleTopEnd = topLevelEnd.filter((item) => can(item.permission));

  const allMobileItems: NavItem[] = [
    ...visibleTopStart,
    ...visibleGroups.flatMap((g) => g.items),
    ...visibleTopEnd,
  ];

  return (
    <header className="relative bg-navy-700 text-white sticky top-0 z-40 border-b border-navy-800 print:hidden">
      {/* Zellige pattern overlay — ton sur ton, n'affecte pas la lisibilité */}
      <div className="absolute inset-0 bg-[url('/header-pattern.png')] bg-repeat bg-[length:180px] opacity-[0.08] pointer-events-none" />
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6" ref={wrapperRef}>
        <Link href="/admin" className="flex items-baseline gap-2 shrink-0">
          <span className="font-display text-xl font-medium text-white">Hiri Tours</span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-terracotta-300 font-medium">Backoffice</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center flex-wrap">
          {visibleTopStart.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item);
            return (
              <Link key={item.href} href={item.href} className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2",
                isActive ? "bg-terracotta-600 text-white shadow-sm" : "text-navy-100 hover:bg-navy-600 hover:text-white"
              )}>
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {visibleGroups.map((group) => {
            const Icon = group.icon;
            const isActive = isGroupActive(group);
            const isOpen = openMenu === group.label;
            return (
              <div key={group.label} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(isOpen ? null : group.label)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 cursor-pointer",
                    isActive ? "bg-terracotta-600 text-white shadow-sm" : "text-navy-100 hover:bg-navy-600 hover:text-white"
                  )}
                >
                  <Icon className="size-4" />
                  <span>{group.label}</span>
                  <ChevronDown className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-white border border-sand-200 rounded-md shadow-lg overflow-hidden z-50">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const subActive = isSubItemActive(item);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm transition-colors",
                            subActive ? "bg-terracotta-50 text-terracotta-700 font-medium" : "text-ink hover:bg-sand-50"
                          )}
                        >
                          <ItemIcon className="size-3.5" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {visibleTopEnd.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item);
            return (
              <Link key={item.href} href={item.href} className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2",
                isActive ? "bg-terracotta-600 text-white shadow-sm" : "text-navy-100 hover:bg-navy-600 hover:text-white"
              )}>
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {userEmail && <span className="hidden lg:inline text-xs text-navy-200 truncate max-w-[180px]">{userEmail}</span>}
          {can("viewParametres") && (
            <Link href="/admin/parametres" className={cn(
              "size-8 rounded-md border flex items-center justify-center transition-colors",
              pathname.startsWith("/admin/parametres") ? "bg-terracotta-600 border-terracotta-700 text-white" : "border-navy-400/50 text-navy-100 hover:bg-navy-600"
            )} title="Paramètres">
              <Settings className="size-4" />
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-navy-400/50 text-sm text-white hover:bg-navy-600 transition-colors">
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </form>
        </div>
      </div>

      <div className="relative z-10 md:hidden border-t border-navy-800 overflow-x-auto">
        <nav className="flex gap-1 px-6 py-2 min-w-max">
          {allMobileItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact ? pathname === item.href : (pathname === item.href || pathname.startsWith(item.href + "/") || pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={cn(
                "px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors flex items-center gap-1.5",
                isActive ? "bg-terracotta-600 text-white" : "text-navy-100 hover:bg-navy-600"
              )}>
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
          {can("viewParametres") && (
            <Link href="/admin/parametres" className={cn(
              "px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors flex items-center gap-1.5",
              pathname.startsWith("/admin/parametres") ? "bg-terracotta-600 text-white" : "text-navy-100 hover:bg-navy-600"
            )}>
              <Settings className="size-3.5" />
              Paramètres
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
