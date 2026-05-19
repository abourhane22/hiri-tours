"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Map,
  Users,
  Receipt,
  Truck,
  BarChart3,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  {
    href: "/admin",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    exact: true,
  },
  { href: "/admin/reservations", label: "Réservations", icon: Calendar },
  { href: "/admin/circuits", label: "Catalogue", icon: Map },
  { href: "/admin/clients", label: "Clients", icon: Users },
];

const navigationSoon = [
  { href: "#", label: "Factures", icon: Receipt },
  { href: "#", label: "Logistique", icon: Truck },
  { href: "#", label: "Rapports", icon: BarChart3 },
];

export function AdminHeader({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  return (
    <header className="bg-navy-700 text-white sticky top-0 z-40 border-b border-navy-800">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/admin" className="flex items-baseline gap-2 shrink-0">
          <span className="font-display text-xl font-medium text-white">
            Hiri Tours
          </span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-terracotta-300 font-medium">
            Backoffice
          </span>
        </Link>

        {/* Nav (desktop) */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navigation.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2",
                  isActive
                    ? "bg-navy-600 text-white border border-navy-400/40"
                    : "text-navy-100 hover:bg-navy-600 hover:text-white"
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {navigationSoon.map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.label}
                className="px-3 py-1.5 rounded-md text-sm text-navy-300/60 flex items-center gap-2 cursor-not-allowed"
                title="Bientôt disponible"
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                <span className="text-[9px] uppercase tracking-wider opacity-60">
                  bientôt
                </span>
              </span>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="flex items-center gap-3 shrink-0">
          {userEmail && (
            <span className="hidden lg:inline text-xs text-navy-200 truncate max-w-[200px]">
              {userEmail}
            </span>
          )}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-navy-400/50 text-sm text-white hover:bg-navy-600 transition-colors"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </form>
        </div>
      </div>

      {/* Mobile nav (horizontal scroll) */}
      <div className="md:hidden border-t border-navy-800 overflow-x-auto">
        <nav className="flex gap-1 px-6 py-2 min-w-max">
          {navigation.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors flex items-center gap-1.5",
                  isActive
                    ? "bg-navy-600 text-white"
                    : "text-navy-100 hover:bg-navy-600"
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
