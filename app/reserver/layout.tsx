import { Poppins } from "next/font/google";
import "@/app/(vitrine)/vitrine.css";
import { getAgence } from "@/lib/agence";
import { DemoBanner } from "@/components/public/demo-banner";
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
      {/* Bandeau démonstration — au-dessus du header, masqué sur le catalogue */}
      <DemoBanner />

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
