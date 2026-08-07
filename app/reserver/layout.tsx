import { FlaskConical, Lock } from "lucide-react";
import { PublicHeader } from "@/components/public/public-header";

export const metadata = {
  title: "Réserver — Hiri Tours",
  description: "Réservez et payez votre excursion ou circuit en ligne.",
};

export default function ReserverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-sand-50">
      {/* Bandeau démonstration (au-dessus de tout, y compris le héros) */}
      <div className="bg-[#FFF4E0] border-b border-[#F1D9A8] print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2">
          <FlaskConical className="size-3.5 text-[#8A5A00] shrink-0" />
          <p className="text-xs text-[#8A5A00]">
            Environnement de démonstration — aucune transaction bancaire réelle.
          </p>
        </div>
      </div>

      {/* Header compact — masqué sur le catalogue (héros à la place) */}
      <PublicHeader />

      <main className="flex-1">{children}</main>

      {/* Footer sobre */}
      <footer className="border-t border-[#E5E0D7] print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#968F84]">
          <span>Hiri Tours · Agadir, Maroc — Plateforme de démonstration</span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" />
            Attijari Payment · Stripe
          </span>
        </div>
      </footer>
    </div>
  );
}
