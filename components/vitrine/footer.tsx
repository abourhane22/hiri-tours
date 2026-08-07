import Link from "next/link";
import { VitrineIcon } from "@/components/vitrine/icon";
import { NewsletterForm } from "@/components/vitrine/newsletter-form";
import { waLink, type Agence } from "@/lib/agence";

export function VitrineFooter({ agence }: { agence: Agence }) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <div className="brand">
              <span className="mark">✦</span>
              <span>
                Hiri Tours
                <small>Agadir · Souss-Massa</small>
              </span>
            </div>
            <p style={{ fontSize: ".92rem", lineHeight: 1.7 }}>
              Agence d&apos;animation touristique à Agadir. Circuits, excursions et séjours dans
              la région du Souss-Massa et au-delà.
            </p>
            <div className="socials">
              <a href="#" title="Instagram" aria-label="Instagram"><VitrineIcon name="instagram" /></a>
              <a href="#" title="Facebook" aria-label="Facebook"><VitrineIcon name="facebook" /></a>
              <a href="#" title="TikTok" aria-label="TikTok"><VitrineIcon name="tiktok" /></a>
              <a href={waLink(agence.whatsapp)} title="WhatsApp" target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <VitrineIcon name="wa" />
              </a>
            </div>
          </div>

          <div>
            <h4>Explorer</h4>
            <ul className="footer-links">
              <li><Link href="/reserver">Circuits &amp; Excursions</Link></li>
              <li><Link href="/destinations">Destinations phares</Link></li>
              <li><Link href="/activites">Activités</Link></li>
              <li><Link href="/blog">Blog &amp; guides</Link></li>
            </ul>
          </div>

          <div>
            <h4>Aide &amp; infos</h4>
            <ul className="footer-links">
              <li><Link href="/contact">Nous contacter</Link></li>
              <li><Link href="/contact#devis">Demander un devis</Link></li>
              <li><Link href="/reserver/suivi">Suivre ma réservation</Link></li>
            </ul>
          </div>

          <div>
            <h4>Newsletter</h4>
            <p style={{ fontSize: ".92rem" }}>Recevez nos offres saisonnières et bons plans.</p>
            <NewsletterForm />
            <p style={{ fontSize: ".86rem", marginTop: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span><VitrineIcon name="phone" /> {agence.tel}</span>
              <span><VitrineIcon name="mail" /> {agence.email}</span>
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Hiri Tours — Tous droits réservés. · <Link href="/login">Espace agence</Link></span>
          <div className="pay-badges">
            <span>Paiement sécurisé</span>
            <span>Visa</span>
            <span>Mastercard</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
