"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus, ChevronDown, Package, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Deux portes d'entrée pour un nouveau dossier : produit du catalogue ou
 * vol via la distribution aérienne. Les routes cibles sont inchangées.
 */
export function NewReservationMenu({ canBilletterie }: { canBilletterie: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options = [
    {
      href: "/admin/reservations/new",
      icon: Package,
      title: "Produit du catalogue",
      desc: "Circuit, excursion, transfert, séjour, hébergement ou prestation.",
      show: true,
    },
    {
      href: "/admin/billetterie",
      icon: Plane,
      title: "Vol · distribution aérienne",
      desc: "Recherche d'offres, création du dossier et émission du billet.",
      show: canBilletterie,
    },
  ].filter((o) => o.show);

  return (
    <div className="relative" ref={ref}>
      <Button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Plus className="size-4" />
        Nouvelle réservation
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-30 w-[320px] overflow-hidden rounded-xl border border-[#E5E0D7] bg-white shadow-lg"
        >
          {options.map((o) => {
            const Icon = o.icon;
            return (
              <Link
                key={o.href}
                href={o.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-[#FBF9F5] transition-colors border-b border-[#F1EFE8] last:border-b-0"
              >
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "#F1EFE8", color: "#1A1F2E" }}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium text-[#1A1F2E]">{o.title}</span>
                  <span className="block text-[12px] text-[#6B6862] leading-snug mt-0.5">{o.desc}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
