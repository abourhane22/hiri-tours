"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { VitrineIcon } from "@/components/vitrine/icon";

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Accueil" },
  { href: "/reserver", label: "Circuits & Excursions" },
  { href: "/destinations", label: "Destinations" },
  { href: "/activites", label: "Activités" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function VitrineHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="site-header">
      <div className="wrap nav">
        <Link href="/" className="brand">
          <span className="mark">✦</span>
          <span>
            Hiri Tours
            <small>Agadir · Souss-Massa</small>
          </span>
        </Link>

        <nav className={`nav-links${open ? " open" : ""}`}>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={isActive(l.href) ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {/* Accès agence — visible uniquement dans le menu burger (mobile) */}
          <Link href="/login" className="nav-agency" onClick={() => setOpen(false)}>
            Espace agence
          </Link>
        </nav>

        <div className="nav-tools">
          <Link href="/reserver/suivi" className="nav-track">
            Suivre ma réservation
          </Link>
          <Link href="/login" className="btn btn-agency">
            <VitrineIcon name="user" />
            Espace agence
          </Link>
          <Link href="/reserver" className="btn btn-primary">
            Réserver
          </Link>
          <button className="burger" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            <VitrineIcon name="menu" />
          </button>
        </div>
      </div>
    </header>
  );
}
