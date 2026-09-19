// Structure de la navigation backoffice — source unique pour la sidebar,
// le panneau mobile et le fil d'Ariane. Les ROUTES ne changent pas ici :
// seule l'organisation des entrées par métier.
//
// Client-safe : aucune dépendance serveur (les icônes lucide sont des
// composants purs).

import {
  LayoutDashboard,
  CalendarCheck,
  Package,
  Plane,
  Users,
  Map,
  Building2,
  CalendarRange,
  Calendar,
  FileText,
  Truck,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavLeaf = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  /** Correspondance exacte (accueil) ; sinon préfixe. */
  exact?: boolean;
  /** Autres préfixes qui rendent l'entrée active (routes conservées, entrée de menu unique). */
  alsoMatch?: string[];
  /** Sous-entrées affichées quand l'entrée est active ou survolée. */
  children?: NavLeaf[];
  /** Pastille : clé du compteur fourni par le layout. */
  badge?: "pending";
};

export type NavGroup = {
  /** Libellé en petites capitales espacées ; null pour l'accueil (sans en-tête). */
  label: string | null;
  items: NavLeaf[];
};

export const ADMIN_NAV: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/admin", label: "Accueil", icon: LayoutDashboard, exact: true, permission: "viewDashboard" }],
  },
  {
    label: "Ventes",
    items: [
      {
        href: "/admin/reservations",
        label: "Réservations",
        icon: CalendarCheck,
        permission: "viewReservations",
        badge: "pending",
        // /admin/billetterie est une porte d'entrée de réservation : elle vit sous Réservations.
        alsoMatch: ["/admin/billetterie"],
        children: [
          { href: "/admin/reservations/new", label: "Produits catalogue", icon: Package, permission: "viewReservations" },
          { href: "/admin/billetterie", label: "Vols", icon: Plane, permission: "viewBilletterie" },
        ],
      },
      { href: "/admin/clients", label: "Clients", icon: Users, permission: "viewClients" },
    ],
  },
  {
    label: "Catalogue & achats",
    items: [
      { href: "/admin/produits", label: "Produits", icon: Map, permission: "viewCircuits", alsoMatch: ["/admin/circuits"] },
      { href: "/admin/fournisseurs", label: "Fournisseurs & contrats", icon: Building2, permission: "viewAchats" },
      { href: "/admin/allotements", label: "Allotements", icon: CalendarRange, permission: "viewCircuits" },
    ],
  },
  {
    label: "Exploitation",
    items: [
      { href: "/admin/calendrier", label: "Calendrier", icon: Calendar, permission: "viewCalendrier" },
      { href: "/admin/manifestes", label: "Manifestes", icon: FileText, permission: "viewManifestes" },
      { href: "/admin/logistique", label: "Logistique", icon: Truck, permission: "viewLogistique" },
    ],
  },
  {
    label: "Finance",
    items: [
      // Les avoirs sont un onglet du registre ; /admin/avoirs reste joignable et actif ici.
      { href: "/admin/factures", label: "Factures & avoirs", icon: Receipt, permission: "viewFinance", alsoMatch: ["/admin/avoirs"] },
      { href: "/admin/finance/depenses", label: "Dépenses", icon: Wallet, permission: "viewFinance" },
      // Rentabilité = onglet en tête des Rapports ; les autres écrans /admin/finance/* restent joignables.
      {
        href: "/admin/rapports",
        label: "Rapports & rentabilité",
        icon: BarChart3,
        permission: "viewRapports",
        alsoMatch: ["/admin/finance/rentabilite", "/admin/finance/pilotage", "/admin/finance/pnl", "/admin/finance/resultat-annuel", "/admin/finance/categories", "/admin/finance"],
      },
    ],
  },
];

export const SETTINGS_ITEM: NavLeaf = { href: "/admin/parametres", label: "Paramètres", icon: Settings, permission: "viewParametres" };

// ---------------------------------------------------------------------------
// Activation & fil d'Ariane
// ---------------------------------------------------------------------------

const startsWithPath = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

export function leafIsActive(pathname: string, leaf: NavLeaf): boolean {
  if (leaf.exact) return pathname === leaf.href;
  if (startsWithPath(pathname, leaf.href)) return true;
  return (leaf.alsoMatch ?? []).some((p) => startsWithPath(pathname, p));
}

/** Sous-entrée : exacte pour /new (sinon la liste l'activerait), préfixe sinon. */
export function childIsActive(pathname: string, child: NavLeaf): boolean {
  if (child.href.endsWith("/new")) return pathname === child.href;
  return startsWithPath(pathname, child.href);
}

export type Breadcrumb = { group: string | null; page: NavLeaf | null; child: NavLeaf | null };

/** « Groupe / Page [/ Sous-page] » d'après le chemin courant — la plus longue correspondance gagne. */
export function breadcrumbFor(pathname: string): Breadcrumb {
  let best: Breadcrumb = { group: null, page: null, child: null };
  let bestLen = -1;
  const consider = (group: string | null, page: NavLeaf, child: NavLeaf | null, matched: string) => {
    if (matched.length > bestLen) {
      bestLen = matched.length;
      best = { group, page, child };
    }
  };
  for (const g of ADMIN_NAV) {
    for (const item of g.items) {
      if (item.exact) {
        if (pathname === item.href) consider(g.label, item, null, item.href);
        continue;
      }
      for (const p of [item.href, ...(item.alsoMatch ?? [])]) {
        if (startsWithPath(pathname, p)) consider(g.label, item, null, p);
      }
      for (const c of item.children ?? []) {
        if (childIsActive(pathname, c)) consider(g.label, item, c, c.href + "#");
      }
    }
  }
  if (startsWithPath(pathname, SETTINGS_ITEM.href)) return { group: null, page: SETTINGS_ITEM, child: null };
  return best;
}

/** Libellés des pages de détail non portées par le menu (fil d'Ariane plus parlant). */
export function detailLabel(pathname: string): string | null {
  if (/^\/admin\/reservations\/[^/]+\/voucher$/.test(pathname)) return "Voucher";
  if (/^\/admin\/reservations\/(?!new$)[^/]+$/.test(pathname)) return "Dossier";
  if (/^\/admin\/clients\/new$/.test(pathname)) return "Nouveau client";
  if (/^\/admin\/clients\/[^/]+$/.test(pathname)) return "Fiche client";
  if (/^\/admin\/produits\/new$/.test(pathname)) return "Nouveau produit";
  if (/^\/admin\/produits\/[^/]+$/.test(pathname)) return "Fiche produit";
  if (/^\/admin\/fournisseurs\/new$/.test(pathname)) return "Nouveau fournisseur";
  if (/^\/admin\/fournisseurs\/[^/]+\/contrats\//.test(pathname)) return "Contrat";
  if (/^\/admin\/fournisseurs\/[^/]+$/.test(pathname)) return "Fiche fournisseur";
  if (/^\/admin\/allotements\/new$/.test(pathname)) return "Nouvel allotement";
  if (/^\/admin\/allotements\/[^/]+$/.test(pathname)) return "Allotement";
  if (/^\/admin\/manifestes\/.+/.test(pathname)) return "Manifeste";
  if (/^\/admin\/logistique\/vehicules/.test(pathname)) return "Véhicules";
  if (/^\/admin\/logistique\/equipe/.test(pathname)) return "Équipe";
  if (/^\/admin\/factures\/[^/]+$/.test(pathname)) return "Facture";
  if (/^\/admin\/avoirs$/.test(pathname)) return "Avoirs";
  if (/^\/admin\/avoirs\/[^/]+$/.test(pathname)) return "Avoir";
  if (/^\/admin\/finance\/depenses\/new$/.test(pathname)) return "Nouvelle dépense";
  if (/^\/admin\/finance\/depenses\/[^/]+$/.test(pathname)) return "Dépense";
  if (/^\/admin\/finance\/rentabilite/.test(pathname)) return "Rentabilité";
  if (/^\/admin\/finance\/pilotage/.test(pathname)) return "Pilotage";
  if (/^\/admin\/finance\/pnl/.test(pathname)) return "P&L mensuel";
  if (/^\/admin\/finance\/resultat-annuel/.test(pathname)) return "Compte de résultat";
  if (/^\/admin\/finance\/categories/.test(pathname)) return "Catégories de coûts";
  if (/^\/admin\/parametres\/societe/.test(pathname)) return "Société";
  if (/^\/admin\/parametres\/utilisateurs\/inviter/.test(pathname)) return "Inviter";
  if (/^\/admin\/parametres\/utilisateurs/.test(pathname)) return "Utilisateurs";
  return null;
}
