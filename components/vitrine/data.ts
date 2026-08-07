// Contenu marketing statique porté depuis maquette-vitrine/assets/js/data.js
// (destinations, activités, témoignages, blog). Conservé tel quel — contenu
// éditorial de la maquette. Les CIRCUITS transactionnels viennent de la base.

export const IMG = {
  agadir: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
  taghazout: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=900&q=80",
  desert: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=900&q=80",
  surf: "https://images.unsplash.com/photo-1502933691298-84fc14542831?auto=format&fit=crop&w=900&q=80",
  quad: "https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?auto=format&fit=crop&w=900&q=80",
  souk: "https://images.unsplash.com/photo-1489493887464-892be6d1daae?auto=format&fit=crop&w=900&q=80",
  paradis: "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=900&q=80",
  camel: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=900&q=80",
  argan: "https://images.unsplash.com/photo-1516834474-48c0abc2a902?auto=format&fit=crop&w=900&q=80",
  mountain: "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?auto=format&fit=crop&w=900&q=80",
  boat: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=80",
  tiznit: "https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=900&q=80",
  legzira: "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=900&q=80",
  medina: "https://images.unsplash.com/photo-1531761535209-180857e963b9?auto=format&fit=crop&w=900&q=80",
};

export const DESTINATIONS = [
  { nom: "Agadir", desc: "Baie & corniche", img: IMG.agadir, big: true },
  { nom: "Taghazout", desc: "Spots de surf", img: IMG.taghazout },
  { nom: "Sahara", desc: "Dunes & bivouac", img: IMG.desert },
  { nom: "Vallée du Paradis", desc: "Piscines naturelles", img: IMG.paradis },
  { nom: "Legzira", desc: "Arches rouges", img: IMG.legzira },
  { nom: "Tiznit", desc: "Cité des bijoutiers", img: IMG.tiznit },
  { nom: "Taroudant", desc: "Remparts & souks", img: IMG.medina },
];

export const DEST_GUIDES: Record<string, string> = {
  Agadir:
    "Reconstruite après 1960, Agadir est la capitale balnéaire du Maroc : 10 km de plage de sable fin, une corniche animée, la kasbah Agadir Oufella avec sa vue panoramique, le Souk El Had (le plus grand souk du pays) et la marina. Climat doux toute l'année — 300 jours de soleil.",
  Taghazout:
    "Ancien village de pêcheurs devenu la capitale marocaine du surf. Spots mythiques (Anchor Point, Panorama, Killer Point), surf-camps, yoga et couchers de soleil inoubliables sur la baie de Taghazout Bay.",
  Sahara:
    "À une journée de route d'Agadir, les dunes de Zagora et du Draâ offrent l'expérience du grand Sud : balade à dos de dromadaire, nuit en bivouac berbère, ciel étoilé et silence absolu.",
  "Vallée du Paradis":
    "Nichée dans les montagnes de l'Atlas à 60 km d'Agadir, la Vallée du Paradis émerveille avec ses gorges, ses palmiers et ses piscines naturelles d'eau turquoise. Randonnée facile et baignade rafraîchissante.",
  Legzira:
    "Classée parmi les plus belles plages du monde, Legzira est célèbre pour ses arches de pierre rouge sculptées par l'océan. Un spectacle grandiose, surtout au coucher du soleil.",
  Tiznit:
    "La « cité de l'argent » : remparts ocre, souk des bijoutiers berbères, médina paisible et authentique. Une étape culturelle incontournable sur la route du Sud.",
  Taroudant:
    "Surnommée « la petite Marrakech », Taroudant charme avec ses remparts du XVIe siècle, ses souks d'artisanat et son ambiance de ville marocaine authentique, loin des foules.",
};

// `href` = cible transactionnelle. Mots-clés q pour transmettre l'intention
// au catalogue ; fiche directe pour le transfert (seule prestation dédiée) ;
// devis pour ce qui n'existe pas encore en base (séjours, location).
export const ACTIVITES = [
  { ico: "surf", nom: "Surf & bodyboard", desc: "Cours et sessions encadrées sur les meilleurs spots de Taghazout et Tamraght.", href: "/reserver?q=surf" },
  { ico: "desert", nom: "Désert & dromadaires", desc: "Bivouacs, dunes et nuits étoilées dans le Sahara marocain.", href: "/reserver?q=désert" },
  { ico: "quad", nom: "Quad & buggy", desc: "Randonnées motorisées à travers dunes, oueds et pistes de l'arrière-pays.", href: "/reserver?q=quad" },
  { ico: "hike", nom: "Randonnée & nature", desc: "Vallée du Paradis, Anti-Atlas et cascades d'Imouzzer.", href: "/reserver?q=randonnée" },
  { ico: "souk", nom: "Culture & souks", desc: "Souk El Had, medinas et coopératives d'huile d'argan.", href: "/reserver?q=souk" },
  { ico: "van", nom: "Transferts aéroport", desc: "Navettes et VTC privés depuis/vers Agadir Al Massira.", href: "/reserver/transfert-aeroport-massira" },
  { ico: "hotel", nom: "Séjours tout inclus", desc: "Packages hébergement + activités sur demande.", href: "/contact#devis" },
  { ico: "car", nom: "Location 4x4", desc: "Véhicules avec ou sans chauffeur pour explorer librement.", href: "/contact#devis" },
];

export const AVIS = [
  { note: 5, txt: "Organisation parfaite pour notre excursion dans le désert. Guide passionnant et bivouac magnifique. Je recommande à 100% !", nom: "Camille D.", pays: "France", img: "https://i.pravatar.cc/100?img=32" },
  { note: 5, txt: "Nous avons réservé le transfert et une journée surf à Taghazout. Ponctualité, matériel neuf, super moniteurs. Merci Hiri Tours !", nom: "Youssef B.", pays: "Maroc", img: "https://i.pravatar.cc/100?img=12" },
  { note: 5, txt: "Excellent accueil, réservation par WhatsApp ultra simple. La Vallée du Paradis est un rêve. À refaire absolument.", nom: "Anna M.", pays: "Allemagne", img: "https://i.pravatar.cc/100?img=45" },
];

export const BLOG_HOME = [
  { cat: "Guide", titre: "Que faire à Agadir en 3 jours ?", img: IMG.agadir, date: "12 juin 2026", ext: "Notre itinéraire idéal pour découvrir la baie, la corniche, le souk et les environs." },
  { cat: "Surf", titre: "Les meilleurs spots de surf autour de Taghazout", img: IMG.surf, date: "28 mai 2026", ext: "Anchor Point, Panorama, Devil's Rock… le guide complet par niveau." },
  { cat: "Nature", titre: "Vallée du Paradis : conseils avant de partir", img: IMG.paradis, date: "5 mai 2026", ext: "Meilleure période, équipement, accès et bons plans pour la baignade." },
];

export const BLOG_ALL = [
  ...BLOG_HOME,
  { cat: "Guide", titre: "Excursion au Sahara depuis Agadir : le guide complet", img: IMG.desert, date: "20 avril 2026", ext: "Zagora ou Merzouga ? Combien de jours ? Que mettre dans son sac ? Toutes les réponses." },
  { cat: "Culture", titre: "Souk El Had : 10 choses à savoir avant d'y aller", img: IMG.souk, date: "2 avril 2026", ext: "Horaires, négociation, meilleures allées : nos conseils pour profiter du plus grand souk du Maroc." },
  { cat: "Bons plans", titre: "Agadir hors saison : pourquoi partir en hiver ?", img: IMG.agadir, date: "15 mars 2026", ext: "Températures douces, tarifs réduits et plages tranquilles : l'hiver est un secret bien gardé." },
  { cat: "Nature", titre: "Legzira et Mirleft : escapade sur la côte sauvage", img: IMG.legzira, date: "28 février 2026", ext: "Itinéraire d'une journée entre arches rouges, villages de pêcheurs et poisson grillé." },
  { cat: "Culture", titre: "Taroudant, la petite Marrakech sans les foules", img: IMG.medina, date: "10 février 2026", ext: "Remparts, souks et douceur de vivre : pourquoi Taroudant mérite le détour." },
  { cat: "Bons plans", titre: "Huile d'argan : reconnaître la vraie de la fausse", img: IMG.argan, date: "25 janvier 2026", ext: "Nos conseils pour acheter une huile d'argan authentique en coopérative." },
];

export function stars(n: number): string {
  const full = Math.round(n);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
}
