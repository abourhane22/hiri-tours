import Link from "next/link";

export function SectionHead({
  eyebrow,
  title,
  children,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={`section-head ${align === "center" ? "center" : "left"}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Strip({
  title,
  text,
  ctaHref,
  ctaLabel,
  sun = false,
}: {
  title: string;
  text: string;
  ctaHref: string;
  ctaLabel: string;
  sun?: boolean;
}) {
  return (
    <div
      className="strip"
      style={sun ? { background: "linear-gradient(135deg, var(--sun), var(--sun-dark))" } : undefined}
    >
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <Link href={ctaHref} className="btn btn-primary btn-lg">
        {ctaLabel}
      </Link>
    </div>
  );
}

export function PageHero({
  title,
  subtitle,
  crumb,
  image,
}: {
  title: string;
  subtitle: string;
  crumb: string;
  image: string;
}) {
  return (
    <section className="page-hero" style={{ "--ph": `url('${image}')` } as React.CSSProperties}>
      <div className="wrap">
        <div className="breadcrumb">
          <Link href="/">Accueil</Link> / {crumb}
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </section>
  );
}
