export type UserRole = "admin" | "commercial" | "comptable" | "guide";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  commercial: "Commercial",
  comptable: "Comptable",
  guide: "Guide",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Accès complet à toutes les fonctionnalités et à la gestion des utilisateurs",
  commercial: "Réservations, clients, circuits, manifestes, rapports",
  comptable: "Finance, dépenses, P&L, rapports — lecture seule sur les réservations",
  guide: "Manifestes uniquement",
};

export const BACKOFFICE_ROLES: UserRole[] = ["admin", "commercial", "comptable", "guide"];

export type Permission =
  | "viewDashboard"
  | "viewReservations"
  | "viewCalendrier"
  | "viewManifestes"
  | "viewClients"
  | "viewCircuits"
  | "viewLogistique"
  | "viewFinance"
  | "viewRapports"
  | "viewParametres"
  | "manageUsers";

const PERMISSIONS: Record<Permission, UserRole[]> = {
  viewDashboard:   ["admin", "commercial", "comptable"],
  viewReservations:["admin", "commercial"],
  viewCalendrier:  ["admin", "commercial"],
  viewManifestes:  ["admin", "commercial", "guide"],
  viewClients:     ["admin", "commercial"],
  viewCircuits:    ["admin", "commercial"],
  viewLogistique:  ["admin"],
  viewFinance:     ["admin", "comptable"],
  viewRapports:    ["admin", "commercial", "comptable"],
  viewParametres:  ["admin"],
  manageUsers:     ["admin"],
} satisfies Record<Permission, UserRole[]>;

export function userCan(role: string, permission: Permission): boolean {
  return (PERMISSIONS[permission] as string[]).includes(role);
}

export const ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [
  { prefix: "/admin/parametres", permission: "viewParametres" },
  { prefix: "/admin/finance",    permission: "viewFinance" },
  { prefix: "/admin/factures",   permission: "viewFinance" },
  { prefix: "/admin/rapports",   permission: "viewRapports" },
  { prefix: "/admin/logistique", permission: "viewLogistique" },
  { prefix: "/admin/circuits",   permission: "viewCircuits" },
  { prefix: "/admin/clients",    permission: "viewClients" },
  { prefix: "/admin/reservations", permission: "viewReservations" },
  { prefix: "/admin/calendrier", permission: "viewCalendrier" },
  { prefix: "/admin/manifestes", permission: "viewManifestes" },
];

export const PERMISSIONS_MATRIX: { permission: Permission; label: string }[] = [
  { permission: "viewDashboard",    label: "Tableau de bord" },
  { permission: "viewReservations", label: "Réservations" },
  { permission: "viewCalendrier",   label: "Calendrier" },
  { permission: "viewManifestes",   label: "Manifestes" },
  { permission: "viewClients",      label: "Clients" },
  { permission: "viewCircuits",     label: "Catalogue circuits" },
  { permission: "viewLogistique",   label: "Logistique" },
  { permission: "viewFinance",      label: "Finance" },
  { permission: "viewRapports",     label: "Rapports" },
  { permission: "viewParametres",   label: "Paramètres" },
  { permission: "manageUsers",      label: "Gestion utilisateurs" },
];
