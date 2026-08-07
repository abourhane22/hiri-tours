import { Poppins } from "next/font/google";
import "./vitrine.css";
import { getAgence } from "@/lib/agence";
import { VitrineHeader } from "@/components/vitrine/header";
import { VitrineFooter } from "@/components/vitrine/footer";
import { WaFloat } from "@/components/vitrine/wa-float";

// Coordonnées agence lues en base → rendu à la demande (jamais figé au build).
export const dynamic = "force-dynamic";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export default async function VitrineLayout({ children }: { children: React.ReactNode }) {
  const agence = await getAgence();

  return (
    <div className={`vitrine-scope ${poppins.variable}`}>
      <VitrineHeader />
      {children}
      <VitrineFooter agence={agence} />
      <WaFloat whatsapp={agence.whatsapp} />
    </div>
  );
}
