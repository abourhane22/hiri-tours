import Link from "next/link";
import { ShieldCheck, FlaskConical } from "lucide-react";

export const metadata = {
  title: "Réserver — Hiri Tours",
  description: "Réservez et payez votre excursion ou circuit en ligne.",
};

export default function ReserverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-sand-50">
      {/* Header navy compact */}
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

      {/* Bandeau démonstration */}
      <div className="bg-[#FFF4E0] border-b border-[#F1D9A8] print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2">
          <FlaskConical className="size-3.5 text-[#8A5A00] shrink-0" />
          <p className="text-xs text-[#8A5A00]">
            Environnement de démonstration — aucune transaction bancaire réelle.
          </p>
        </div>
      </div>

      <main className="flex-1">{children}</main>

      {/* Footer sobre */}
      <footer className="border-t border-[#E5E0D7] print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-5 text-center text-xs text-[#968F84]">
          Hiri Tours · Agadir, Maroc — Plateforme de démonstration
        </div>
      </footer>
    </div>
  );
}
