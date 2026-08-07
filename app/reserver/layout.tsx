import { Poppins } from "next/font/google";
import { FlaskConical } from "lucide-react";
import "@/app/(vitrine)/vitrine.css";
import { getAgence } from "@/lib/agence";
import { VitrineHeader } from "@/components/vitrine/header";
import { VitrineFooter } from "@/components/vitrine/footer";

export const metadata = {
  title: "Réserver — Hiri Tours",
  description: "Réservez et payez votre excursion ou circuit en ligne.",
};

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

// Le header/footer vitrine sont scopés sous .vitrine-scope ; on neutralise
// le min-height/background de la classe pour ne pas créer de zone 100vh et
// pour ne PAS affecter le contenu des pages tunnel (qui gardent leurs styles).
const chromeStyle = { minHeight: 0, background: "transparent" } as const;

export default async function ReserverLayout({ children }: { children: React.ReactNode }) {
  const agence = await getAgence();

  return (
    <div className="min-h-screen flex flex-col bg-sand-50">
      {/* Bandeau démonstration — au-dessus du header */}
      <div className="bg-[#FFF4E0] border-b border-[#F1D9A8] print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2">
          <FlaskConical className="size-3.5 text-[#8A5A00] shrink-0" />
          <p className="text-xs text-[#8A5A00]">
            Environnement de démonstration — aucune transaction bancaire réelle.
          </p>
        </div>
      </div>

      {/* Header vitrine (scopé, chrome uniquement) */}
      <div className={`vitrine-scope ${poppins.variable}`} style={chromeStyle}>
        <VitrineHeader />
      </div>

      {/* Contenu tunnel — hors .vitrine-scope, styles propres inchangés */}
      <main className="flex-1">{children}</main>

      {/* Footer vitrine (scopé, chrome uniquement) */}
      <div className={`vitrine-scope ${poppins.variable}`} style={chromeStyle}>
        <VitrineFooter agence={agence} />
      </div>
    </div>
  );
}
