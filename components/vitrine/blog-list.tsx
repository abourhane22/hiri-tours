"use client";

import { useState } from "react";
import { VitrineIcon } from "@/components/vitrine/icon";

type Post = { cat: string; titre: string; img: string; date: string; ext: string };

export function BlogList({ posts }: { posts: Post[] }) {
  const cats = ["Tous", ...Array.from(new Set(posts.map((p) => p.cat)))];
  const [active, setActive] = useState("Tous");
  const list = active === "Tous" ? posts : posts.filter((p) => p.cat === active);

  return (
    <>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", marginBottom: "36px" }}>
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            className={`btn ${c === active ? "btn-ocean" : "btn-outline"}`}
            style={{ padding: "9px 20px", fontSize: ".88rem" }}
            onClick={() => setActive(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-3">
        {list.map((b) => (
          <article className="post post-static" key={b.titre}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.img} alt={b.titre} loading="lazy" />
            <div className="body">
              <span className="cat">{b.cat}</span>
              <h3>{b.titre}</h3>
              <p>{b.ext}</p>
              <div className="date">
                <VitrineIcon name="cal" /> {b.date} · <VitrineIcon name="clock" /> 5 min de lecture
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
