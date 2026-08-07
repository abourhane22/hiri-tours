import { PageHero } from "@/components/vitrine/ui";
import { BlogList } from "@/components/vitrine/blog-list";
import { NewsletterForm } from "@/components/vitrine/newsletter-form";
import { BLOG_ALL } from "@/components/vitrine/data";

export const metadata = {
  title: "Blog & guides de voyage — Agadir et Souss-Massa | Hiri Tours",
  description:
    "Guides de voyage, conseils et actualités touristiques sur Agadir, Taghazout et la région Souss-Massa : que faire, où surfer, meilleures périodes et bons plans.",
};

export default function BlogPage() {
  return (
    <>
      <PageHero
        crumb="Blog"
        title="Blog & guides de voyage"
        subtitle="Conseils d'experts locaux, itinéraires et actualités touristiques de la région d'Agadir."
        image="https://images.unsplash.com/photo-1489493887464-892be6d1daae?auto=format&fit=crop&w=1600&q=80"
      />

      <section className="section">
        <div className="wrap">
          <BlogList posts={BLOG_ALL} />
        </div>
      </section>

      <section className="section tight" style={{ background: "#fff" }}>
        <div className="wrap">
          <div className="strip" style={{ background: "linear-gradient(135deg,var(--sun),var(--sun-dark))" }}>
            <div>
              <h2>Ne manquez aucun bon plan</h2>
              <p>Recevez chaque mois nos guides, offres saisonnières et idées d&apos;escapades dans le Souss-Massa.</p>
            </div>
            <NewsletterForm variant="strip" />
          </div>
        </div>
      </section>
    </>
  );
}
