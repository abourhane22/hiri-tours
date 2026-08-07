import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { minAdultPriceMad } from "@/lib/pricing";
import { VitrineIcon } from "@/components/vitrine/icon";
import { HeroSearchBar } from "@/components/vitrine/search-bar";
import { SectionHead, Strip } from "@/components/vitrine/ui";
import { CircuitCard, type VitrineCircuit } from "@/components/vitrine/circuit-card";
import { DESTINATIONS, ACTIVITES, AVIS, BLOG_HOME, stars } from "@/components/vitrine/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hiri Tours — Agence d'animation touristique à Agadir | Circuits, excursions & séjours",
  description:
    "Hiri Tours, votre agence de voyage à Agadir : excursions désert, surf à Taghazout, Vallée du Paradis, transferts aéroport et séjours tout inclus dans la région Souss-Massa.",
};

const CAT_LABEL: Record<string, string> = {
  circuit: "Circuit",
  excursion: "Excursion",
  transfert: "Transfert",
  sejour: "Séjour",
};

function durationLabel(cat: string, days: number | null, hours: number | null): string | null {
  if (cat === "excursion") return hours ? `${hours} h` : "Journée";
  if (cat === "transfert") return "Trajet privé";
  if (days) return `${days} jours`;
  return null;
}

async function getPopular(): Promise<VitrineCircuit[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("circuits")
    .select(
      "id, title, category, short_description, hero_image_url, base_price_mad, duration_days, duration_hours, circuit_seasons(starts_on, ends_on, price_multiplier)",
    )
    .eq("is_active", true)
    .order("base_price_mad", { ascending: false })
    .limit(3);

  return ((data ?? []) as any[]).map((c) => ({
    id: c.id,
    title: c.title,
    categoryLabel: CAT_LABEL[c.category] ?? c.category,
    durationLabel: durationLabel(c.category, c.duration_days, c.duration_hours),
    // Prix « à partir de » via lib/pricing (min saisonnier) — même formule que le tunnel.
    price: minAdultPriceMad({ base_price_mad: c.base_price_mad, circuit_seasons: c.circuit_seasons }),
    image: c.hero_image_url ?? null,
    excerpt: c.short_description
      ? c.short_description.length > 96
        ? c.short_description.slice(0, 96) + "…"
        : c.short_description
      : null,
  }));
}

export default async function HomePage() {
  const popular = await getPopular();

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-inner">
            <span className="eyebrow" style={{ background: "rgba(255,255,255,.18)", color: "#fff" }}>
              Agadir · Souss-Massa · Maroc
            </span>
            <h1>Vivez la magie du Sud marocain</h1>
            <p>
              Excursions dans le désert, surf à Taghazout, Vallée du Paradis, séjours tout
              inclus… Réservez vos plus beaux souvenirs en quelques clics.
            </p>
            <div className="hero-cta">
              <Link href="/reserver" className="btn btn-primary btn-lg">
                Découvrir nos circuits
              </Link>
              <Link href="/contact#devis" className="btn btn-ghost btn-lg">
                Devis gratuit
              </Link>
            </div>
            <div className="hero-badges">
              <div><b>+2 500</b> voyageurs accompagnés</div>
              <div><b>4.9/5</b> note moyenne clients</div>
              <div><b>24/7</b> réservation en ligne</div>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <HeroSearchBar />
      </div>

      {/* CIRCUITS POPULAIRES */}
      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow="Nos best-sellers" title="Circuits & excursions populaires">
            Les expériences préférées de nos voyageurs, organisées de A à Z par notre équipe
            locale.
          </SectionHead>
          {popular.length > 0 ? (
            <div className="grid grid-3">
              {popular.map((c) => (
                <CircuitCard key={c.id} c={c} />
              ))}
            </div>
          ) : (
            <p className="center muted">Notre catalogue arrive très bientôt.</p>
          )}
          <p className="center" style={{ marginTop: "36px" }}>
            <Link href="/reserver" className="btn btn-outline">
              Voir tout le catalogue →
            </Link>
          </p>
        </div>
      </section>

      {/* DESTINATIONS */}
      <section className="section tight" style={{ background: "#fff" }}>
        <div className="wrap">
          <SectionHead eyebrow="Destinations phares" title="Où partirez-vous ?">
            D&apos;Agadir au Sahara, chaque destination raconte une histoire.
          </SectionHead>
          <div className="dest-grid">
            {DESTINATIONS.slice(0, 6).map((d, i) => (
              <Link
                key={d.nom}
                className={`dest ${i === 0 ? "big" : ""}`}
                href={`/reserver?q=${encodeURIComponent(d.nom)}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.img} alt={d.nom} loading="lazy" />
                <div className="dest-info">
                  <h3>{d.nom}</h3>
                  <span>{d.desc}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ACTIVITÉS */}
      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow="Nos services" title="Une agence, toutes vos envies" />
          <div className="feature-grid">
            {ACTIVITES.map((a) => (
              <Link className="feature" href={a.href} key={a.nom}>
                <div className="ico">
                  <VitrineIcon name={a.ico} />
                </div>
                <h3>{a.nom}</h3>
                <p>{a.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* BANDEAU DEVIS */}
      <section className="section tight">
        <div className="wrap">
          <Strip
            title="Groupe, entreprise ou événement ?"
            text="Voyages incentive, séminaires, sorties scolaires : nous créons un programme sur mesure pour votre groupe, avec devis gratuit sous 24h."
            ctaHref="/contact#devis"
            ctaLabel="Demander un devis personnalisé"
          />
        </div>
      </section>

      {/* CONFIANCE */}
      <section className="section tight" style={{ background: "#fff" }}>
        <div className="wrap trust">
          <div><div className="num">12+</div><div className="lbl">années d&apos;expérience locale</div></div>
          <div><div className="num">40+</div><div className="lbl">circuits & activités</div></div>
          <div><div className="num">2 500+</div><div className="lbl">voyageurs satisfaits</div></div>
          <div><div className="num">100%</div><div className="lbl">paiement sécurisé (3D Secure)</div></div>
        </div>
      </section>

      {/* TÉMOIGNAGES */}
      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow="Avis vérifiés" title="Ils ont voyagé avec nous" />
          <div className="grid grid-3">
            {AVIS.map((a) => (
              <div className="testi" key={a.nom}>
                <div className="stars">{stars(a.note)}</div>
                <p>&ldquo;{a.txt}&rdquo;</p>
                <div className="who">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.img} alt={a.nom} />
                  <div>
                    <b>
                      {a.nom} <span className="verified">✓ vérifié</span>
                    </b>
                    <span>{a.pays}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BLOG */}
      <section className="section tight" style={{ background: "#fff" }}>
        <div className="wrap">
          <SectionHead eyebrow="Blog & guides" title="Inspirations de voyage" />
          <div className="grid grid-3">
            {BLOG_HOME.map((b) => (
              <Link className="post" href="/blog" key={b.titre}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.img} alt={b.titre} loading="lazy" />
                <div className="body">
                  <span className="cat">{b.cat}</span>
                  <h3>{b.titre}</h3>
                  <p>{b.ext}</p>
                  <div className="date">
                    <VitrineIcon name="cal" /> {b.date}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <p className="center" style={{ marginTop: "32px" }}>
            <Link href="/blog" className="btn btn-outline">
              Tous les articles →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
