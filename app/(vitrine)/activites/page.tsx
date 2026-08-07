import Link from "next/link";
import { PageHero, SectionHead, Strip } from "@/components/vitrine/ui";
import { VitrineIcon } from "@/components/vitrine/icon";
import { ACTIVITES } from "@/components/vitrine/data";

export const metadata = {
  title: "Activités & Services — Surf, quad, transferts, séjours | Hiri Tours Agadir",
  description:
    "Toutes les activités Hiri Tours à Agadir : surf, quad, randonnée, culture, transferts aéroport Al Massira, séjours tout inclus et location de 4x4.",
};

export default function ActivitesPage() {
  return (
    <>
      <PageHero
        crumb="Activités"
        title="Activités & services"
        subtitle="Sport, nature, culture, logistique : une seule agence pour toutes vos envies dans la région d'Agadir."
        image="https://images.unsplash.com/photo-1502933691298-84fc14542831?auto=format&fit=crop&w=1600&q=80"
      />

      <section className="section">
        <div className="wrap">
          <div className="feature-grid">
            {ACTIVITES.map((a) => (
              <Link className="feature" href="/reserver" key={a.nom}>
                <div className="ico">
                  <VitrineIcon name={a.ico} />
                </div>
                <h3>{a.nom}</h3>
                <p>{a.desc}</p>
                <p style={{ marginTop: "10px", color: "var(--ocean)", fontWeight: 600, fontSize: ".88rem" }}>
                  Découvrir →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section tight" style={{ background: "#fff" }}>
        <div className="wrap">
          <SectionHead eyebrow="Services voyageurs" title="Nous nous occupons de tout" />
          <div className="grid grid-3">
            <div className="feature">
              <div className="ico"><VitrineIcon name="van" /></div>
              <h3>Transferts aéroport Al Massira</h3>
              <p>Navette privée ou VTC, accueil avec pancarte, suivi de vol en temps réel. Réservation en ligne 24h/24.</p>
              <p style={{ marginTop: "12px" }}>
                <Link href="/reserver" className="btn btn-outline">Réserver un transfert</Link>
              </p>
            </div>
            <div className="feature">
              <div className="ico"><VitrineIcon name="hotel" /></div>
              <h3>Séjours tout inclus</h3>
              <p>Packages hébergement + activités avec nos hôtels partenaires à Agadir et Taghazout Bay. Transferts inclus.</p>
              <p style={{ marginTop: "12px" }}>
                <Link href="/reserver" className="btn btn-outline">Voir les séjours</Link>
              </p>
            </div>
            <div className="feature">
              <div className="ico"><VitrineIcon name="car" /></div>
              <h3>Location 4x4 &amp; voitures</h3>
              <p>Véhicules récents avec ou sans chauffeur, kilométrage illimité, assistance 24/7. Idéal pour explorer l&apos;Anti-Atlas.</p>
              <p style={{ marginTop: "12px" }}>
                <Link href="/reserver" className="btn btn-outline">Louer un véhicule</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section tight">
        <div className="wrap">
          <Strip
            title="Groupes & entreprises"
            text="Team-building, incentive, séminaires, voyages scolaires : programmes clés en main avec guides, transport et animation. Devis gratuit sous 24h."
            ctaHref="/contact#devis"
            ctaLabel="Demander un devis"
          />
        </div>
      </section>
    </>
  );
}
