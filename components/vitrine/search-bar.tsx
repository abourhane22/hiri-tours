"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Barre de recherche du héros — champ texte unique. Le submit transmet
 * l'intention au catalogue via ?q= (saisie vide → /reserver nu).
 */
export function HeroSearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      className="search-bar"
      style={{ gridTemplateColumns: "1fr auto" }}
      onSubmit={(e) => {
        e.preventDefault();
        const t = q.trim();
        router.push(t ? `/reserver?q=${encodeURIComponent(t)}` : "/reserver");
      }}
    >
      <div className="search-field">
        <label>Destination ou activité</label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ex. : désert, surf, Taghazout…"
          autoComplete="off"
        />
      </div>
      <button className="btn btn-ocean btn-lg" type="submit">
        Rechercher
      </button>
    </form>
  );
}
