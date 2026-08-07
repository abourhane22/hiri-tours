import Link from "next/link";
import { PageHero, SectionHead, Strip } from "@/components/vitrine/ui";
import { DESTINATIONS, DEST_GUIDES } from "@/components/vitrine/data";

export const metadata = {
  title: "Destinations phares — Agadir, Taghazout, Sahara | Hiri Tours",
  description:
    "Découvrez les destinations phares de Hiri Tours : Agadir, Taghazout, le Sahara, la Vallée du Paradis, Legzira, Tiznit et Taroudant. Guides et circuits pour chaque destination.",
};

export default function DestinationsPage() {
  return (
    <>
      <PageHero
        crumb="Destinations"
        title="Nos destinations phares"
        subtitle="D'Agadir au Sahara, chaque destination du Souss-Massa raconte une histoire. Choisissez la vôtre."
        image="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80"
      />

      <section className="section">
        <div className="wrap">
          <div className="dest-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {DESTINATIONS.map((d) => (
              <Link
                key={d.nom}
                className="dest"
                href={`/reserver?q=${encodeURIComponent(d.nom)}`}
                style={{ aspectRatio: "4/3" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.img} alt={d.nom} loading="lazy" />
                <div className="dest-info">
                  <h3>{d.nom}</h3>
                  <span>{d.desc} → voir les circuits</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section tight" style={{ background: "#fff" }}>
        <div className="wrap">
          <SectionHead eyebrow="Guides par destination" title="Que voir, que faire ?" />
          <div>
            {DESTINATIONS.map((d) => (
              <div
                key={d.nom}
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 1fr auto",
                  gap: "24px",
                  alignItems: "center",
                  background: "var(--sand)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  padding: "20px",
                  marginBottom: "16px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.img}
                  alt={d.nom}
                  loading="lazy"
                  style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", borderRadius: "var(--radius-s)" }}
                />
                <div>
                  <h3 style={{ marginBottom: "6px" }}>
                    {d.nom}{" "}
                    <span className="muted" style={{ fontSize: ".8rem", fontWeight: 500 }}>
                      · {d.desc}
                    </span>
                  </h3>
                  <p className="muted" style={{ fontSize: ".92rem" }}>
                    {DEST_GUIDES[d.nom] ?? ""}
                  </p>
                </div>
                <Link className="btn btn-ocean" href={`/reserver?q=${encodeURIComponent(d.nom)}`}>
                  Explorer →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section tight">
        <div className="wrap">
          <Strip
            title="Une destination vous fait rêver ?"
            text="Nos conseillers locaux connaissent chaque piste, chaque plage et chaque village de la région. Demandez votre programme sur mesure."
            ctaHref="/contact#devis"
            ctaLabel="Créer mon voyage"
          />
        </div>
      </section>
    </>
  );
}
