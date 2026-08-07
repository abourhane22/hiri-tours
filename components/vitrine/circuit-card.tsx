import Link from "next/link";
import { VitrineIcon } from "@/components/vitrine/icon";
import { formatMAD } from "@/lib/utils";

export type VitrineCircuit = {
  id: string;
  title: string;
  categoryLabel: string;
  durationLabel: string | null;
  price: number;
  image: string | null;
  excerpt: string | null;
};

const PLACEHOLDER = "linear-gradient(135deg, #0f6d78, #0a4c54)";

export function CircuitCard({ c }: { c: VitrineCircuit }) {
  return (
    <article className="card">
      <div className="card-media" style={c.image ? undefined : { background: PLACEHOLDER }}>
        <Link href={`/reserver/${c.id}`}>
          {c.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image} alt={c.title} loading="lazy" />
          )}
        </Link>
        <span className="card-tag">{c.categoryLabel}</span>
      </div>
      <div className="card-body">
        <div className="card-meta">
          {c.durationLabel && (
            <span>
              <VitrineIcon name="clock" /> {c.durationLabel}
            </span>
          )}
        </div>
        <h3>
          <Link href={`/reserver/${c.id}`}>{c.title}</Link>
        </h3>
        {c.excerpt && <p>{c.excerpt}</p>}
        <div className="card-foot">
          <div className="price">
            <small>à partir de</small>
            <b>
              {formatMAD(c.price).replace(" MAD", "")} <span>MAD / pers.</span>
            </b>
          </div>
          <Link href={`/reserver/${c.id}`} className="btn btn-ocean">
            Réserver
          </Link>
        </div>
      </div>
    </article>
  );
}
