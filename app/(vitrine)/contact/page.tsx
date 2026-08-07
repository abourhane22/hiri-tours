import { PageHero, SectionHead } from "@/components/vitrine/ui";
import { VitrineIcon } from "@/components/vitrine/icon";
import { ContactForm, DevisForm } from "@/components/vitrine/contact-forms";
import { getAgence, waLink } from "@/lib/agence";

export const metadata = {
  title: "Contact & Devis — Hiri Tours Agadir",
  description:
    "Contactez Hiri Tours à Agadir : demande d'information, devis personnalisé pour groupes et entreprises, partenariats. Réponse sous 24h, WhatsApp disponible.",
};

export default async function ContactPage() {
  const agence = await getAgence();
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(agence.address)}&output=embed`;

  return (
    <>
      <PageHero
        crumb="Contact"
        title="Contact & devis"
        subtitle="Une question, un projet de voyage, un événement de groupe ? Nous vous répondons sous 24h."
        image="https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1600&q=80"
      />

      <section className="section">
        <div className="wrap" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "40px", alignItems: "start" }}>
          {/* Coordonnées */}
          <div>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "24px" }}>Nos coordonnées</h2>
            <ul className="info-list">
              <li>
                <div className="ico"><VitrineIcon name="pin" /></div>
                <div>
                  <b>Agence {agence.name}</b>
                  <span>{agence.address}</span>
                </div>
              </li>
              <li>
                <div className="ico"><VitrineIcon name="phone" /></div>
                <div>
                  <b>Téléphone</b>
                  <span>{agence.tel}<br />Lun–Sam : 9h – 19h</span>
                </div>
              </li>
              <li>
                <div className="ico"><VitrineIcon name="wa" /></div>
                <div>
                  <b>WhatsApp Business</b>
                  <span>
                    <a href={waLink(agence.whatsapp)} target="_blank" rel="noreferrer" style={{ color: "var(--ocean-dark)", fontWeight: 600 }}>
                      Ouvrir la conversation
                    </a>
                    <br />Réponse rapide 7j/7
                  </span>
                </div>
              </li>
              <li>
                <div className="ico"><VitrineIcon name="mail" /></div>
                <div>
                  <b>Email</b>
                  <span>{agence.email}</span>
                </div>
              </li>
            </ul>
            <iframe
              className="map-embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={mapSrc}
              title="Localisation de l'agence"
            />
          </div>

          {/* Formulaire contact */}
          <div>
            <div className="form-card">
              <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Écrivez-nous</h2>
              <p className="muted" style={{ marginBottom: "22px", fontSize: ".95rem" }}>
                Formulaire multi-objet : information, réservation, partenariat ou réclamation.
              </p>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Devis */}
      <section className="section tight" style={{ background: "#fff" }} id="devis">
        <div className="wrap">
          <SectionHead eyebrow="Groupes · MICE · Événements" title="Demande de devis personnalisé">
            Voyages incentive, séminaires, sorties scolaires, EVJF/EVG… Recevez une proposition
            détaillée et gratuite sous 24h.
          </SectionHead>
          <div className="form-card" style={{ maxWidth: "860px", margin: "0 auto" }}>
            <DevisForm />
          </div>
        </div>
      </section>

      {/* FAQ — réécrite pour coller au réel (3 canaux, règle J-7, suivi par référence) */}
      <section className="section">
        <div className="wrap" style={{ maxWidth: "860px" }}>
          <SectionHead eyebrow="FAQ" title="Questions fréquentes" />
          <div className="faq">
            <details>
              <summary>Comment se passe le paiement en ligne ?</summary>
              <p>
                Trois moyens au choix : carte bancaire marocaine ou internationale (Visa,
                Mastercard) via un paiement 100 % sécurisé 3D Secure, virement bancaire, ou
                règlement directement à l&apos;agence.
              </p>
            </details>
            <details>
              <summary>Puis-je régler à l&apos;agence ?</summary>
              <p>
                Oui. Si vous choisissez le règlement à l&apos;agence (espèces ou carte), il doit
                être effectué au plus tard 7 jours avant le départ — ou sous 24 h si le départ est
                imminent. Au-delà, la réservation peut être libérée.
              </p>
            </details>
            <details>
              <summary>Que se passe-t-il après ma réservation ?</summary>
              <p>
                Vous recevez une confirmation par email avec votre numéro de dossier. Vous pouvez
                suivre votre dossier et payer en ligne à tout moment grâce à votre référence.
              </p>
            </details>
            <details>
              <summary>Comment suivre ou régler mon dossier ?</summary>
              <p>
                Rendez-vous sur « Suivre ma réservation », saisissez votre référence et l&apos;email
                ou le téléphone utilisés lors de la réservation : vous accédez à votre dossier et
                pouvez régler le solde en ligne par carte.
              </p>
            </details>
            <details>
              <summary>Mes données personnelles sont-elles protégées ?</summary>
              <p>
                Oui. Le site est entièrement chiffré (HTTPS/SSL) et nous respectons la loi
                marocaine 09-08 relative à la protection des données personnelles (CNDP).
              </p>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
