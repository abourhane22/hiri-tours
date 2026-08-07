"use client";

import { useRouter } from "next/navigation";

/**
 * Barre de recherche du héros — version simple : le submit redirige vers le
 * tunnel /reserver (pas d'autocomplétion). Champs présentés à titre visuel.
 */
export function HeroSearchBar() {
  const router = useRouter();

  return (
    <form
      className="search-bar"
      onSubmit={(e) => {
        e.preventDefault();
        router.push("/reserver");
      }}
    >
      <div className="search-field">
        <label>Destination ou activité</label>
        <input type="text" placeholder="Ex. : désert, surf, Taghazout…" autoComplete="off" />
      </div>
      <div className="search-field">
        <label>Date souhaitée</label>
        <input type="date" />
      </div>
      <div className="search-field">
        <label>Type de séjour</label>
        <select defaultValue="">
          <option value="">Tous les types</option>
          <option>Excursion à la journée</option>
          <option>Circuit 2-3 jours</option>
          <option>Séjour tout inclus</option>
          <option>Transfert aéroport</option>
        </select>
      </div>
      <button className="btn btn-ocean btn-lg" type="submit">
        Rechercher
      </button>
    </form>
  );
}
