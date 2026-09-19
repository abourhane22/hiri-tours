"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu, Search, ChevronRight } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { breadcrumbFor, detailLabel } from "@/lib/admin-nav";
import type { AppNotification } from "@/lib/notifications";

/**
 * Bandeau supérieur blanc, sticky : fil d'Ariane, recherche globale
 * (→ liste des dossiers ?q=, Ctrl/⌘+K), cloche de notifications.
 * Aucun lien de navigation ici — c'est le rôle de la sidebar.
 */
export function AdminTopbar({ notifications, onOpenMenu }: { notifications: AppNotification[]; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const crumb = breadcrumbFor(pathname);
  const detail = detailLabel(pathname);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (inputRef.current?.value ?? "").trim();
    router.push(q ? `/admin/reservations?q=${encodeURIComponent(q)}` : "/admin/reservations");
  }

  const crumbs: { label: string; href?: string }[] = [];
  if (crumb.group) crumbs.push({ label: crumb.group });
  if (crumb.page) crumbs.push({ label: crumb.page.label, href: crumb.page.href });
  if (crumb.child) crumbs.push({ label: crumb.child.label, href: crumb.child.href });
  else if (detail) crumbs.push({ label: detail });

  return (
    <header
      className="sticky top-0 z-30 h-14 shrink-0 bg-white border-b border-[#E5E0D7] flex items-center gap-3 px-4 sm:px-6 print:hidden"
      style={{ top: 0 }}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        className="lg:hidden inline-flex size-9 items-center justify-center rounded-md border border-[#E0DACF] text-[#1A1F2E] hover:bg-[#FBF9F5]"
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-4" />
      </button>

      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="min-w-0 flex-1 flex items-center gap-1 text-[13px]">
        {crumbs.length === 0 ? (
          <span className="text-[#1A1F2E] font-medium">Backoffice</span>
        ) : (
          crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-[#C9C4BA]" />}
                {c.href && !last ? (
                  <Link href={c.href} className="truncate text-[#6B6862] hover:text-[#1A1F2E] transition-colors">
                    {c.label}
                  </Link>
                ) : (
                  <span className={last ? "truncate text-[#1A1F2E] font-medium" : "truncate text-[#6B6862]"}>{c.label}</span>
                )}
              </span>
            );
          })
        )}
      </nav>

      {/* Recherche globale */}
      <form onSubmit={onSubmit} role="search" className="relative hidden sm:block w-[220px] md:w-[280px]">
        <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#968F84] pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          placeholder="Référence, client, téléphone…"
          aria-label="Recherche globale des dossiers"
          className="h-9 w-full rounded-lg border border-[#E0DACF] bg-[#FBF9F5] pl-8 pr-14 text-[13px] text-[#1A1F2E] placeholder:text-[#968F84] focus:bg-white focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex h-5 items-center rounded border border-[#E0DACF] bg-white px-1.5 font-sans text-[10px] text-[#968F84]">
          Ctrl K
        </kbd>
      </form>
      <Link
        href="/admin/reservations"
        className="sm:hidden inline-flex size-9 items-center justify-center rounded-md border border-[#E0DACF] text-[#1A1F2E] hover:bg-[#FBF9F5]"
        aria-label="Rechercher un dossier"
      >
        <Search className="size-4" />
      </Link>

      <NotificationBell initial={notifications} variant="light" />
    </header>
  );
}
