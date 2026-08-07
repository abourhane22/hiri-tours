"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

/**
 * Header navy compact des pages publiques. Masqué sur le catalogue
 * (/reserver) où le héros le remplace ; présent sur les autres pages.
 */
export function PublicHeader() {
  const pathname = usePathname();
  if (pathname === "/reserver") return null;

  return (
    <header className="bg-[#1A1F2E] text-white print:hidden">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/reserver" className="flex items-center gap-2 leading-none">
          <span className="font-display text-lg tracking-tight">Hiri Tours</span>
          <span className="text-[9px] tracking-[0.25em] uppercase text-[#FFB89A] mt-1">
            Réservation
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/reserver/suivi" className="text-xs text-white/80 hover:text-white">
            Suivre ma réservation
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#9FE1CB]">
            <ShieldCheck className="size-3.5" />
            Sécurisé
          </span>
        </div>
      </div>
    </header>
  );
}
