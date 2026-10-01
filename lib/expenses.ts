// Dépenses — modèle partagé (client-safe) : rattachement, libellés, textes d'aide,
// périodes de la liste. Les MARGES ne se calculent pas ici : lib/margin.ts.
//
// Rattachement PRINCIPAL exclusif (contrainte SQL num_nonnulls(reservation_id, circuit_id) <= 1) :
//   dossier XOR produit XOR aucun. Le VÉHICULE est une dimension optionnelle indépendante.
// Les quatre cartes de l'interface (une seule cible saisie par carte) :
//   Dossier (reservation_id) · Produit (circuit_id) · Véhicule (vehicle_id) · Frais généraux (rien).
// Héritage : 2 dépenses dossier + véhicule conservent leur vehicle_id en modification.

import { addDays, agencyDate } from "@/lib/tz";

export type ExpenseAttachment = "dossier" | "produit" | "vehicule" | "general";

export const ATTACHMENTS: ExpenseAttachment[] = ["dossier", "produit", "vehicule", "general"];

export function attachmentOf(e: { reservation_id: string | null; circuit_id: string | null; vehicle_id: string | null }): ExpenseAttachment {
  if (e.reservation_id) return "dossier";
  if (e.circuit_id) return "produit";
  if (e.vehicle_id) return "vehicule";
  return "general";
}

export const ATTACHMENT_META: Record<ExpenseAttachment, { label: string; card: string; help: string; legend: string }> = {
  dossier: {
    label: "Dossier",
    card: "Un client précis. Entre dans la marge réelle de son dossier.",
    help: "Tapez une référence ou un nom de client. Seuls les dossiers non annulés sont proposés.",
    legend: "entre dans la marge réelle du dossier",
  },
  produit: {
    label: "Produit",
    card: "Un départ commun à plusieurs dossiers. Rentabilité du produit.",
    help: "Pour une dépense commune à plusieurs dossiers (entrées du groupe, guide partagé). Elle compte dans la rentabilité du produit, sans être répartie entre les dossiers.",
    legend: "rentabilité du produit, non ventilée sur les dossiers",
  },
  vehicule: {
    label: "Véhicule",
    card: "Un véhicule de l'agence, sans client précis. Suivi des coûts par véhicule.",
    help: "Entretien, assurance, vignette : la dépense est suivie par véhicule.",
    legend: "suivi par véhicule",
  },
  general: {
    label: "Frais généraux",
    card: "L'agence elle-même. Hors marge des dossiers.",
    help: "Loyer, abonnements, frais bancaires, salaires administratifs : aucune sélection nécessaire. La dépense apparaît dans le compte de résultat, pas dans la marge des dossiers.",
    legend: "structure, hors marge des dossiers",
  },
};

export const ATTACHMENT_STYLE: Record<ExpenseAttachment, { bg: string; color: string }> = {
  dossier: { bg: "#E6F1FB", color: "#0C447C" },
  produit: { bg: "#FAEEDA", color: "#7A4B00" },
  vehicule: { bg: "#E3F0F4", color: "#0C6B8A" },
  general: { bg: "#F1EFE8", color: "#58524A" },
};

/** Textes d'aide du formulaire (maquette validée). */
export const EXPENSE_HELP = {
  label: "Ce qui a été payé, tel qu'il apparaîtra dans les listes et les rapports. Soyez précis : « Carburant Sprinter — semaine 39 » plutôt que « carburant ».",
  amount: "Montant TTC réellement payé. Facture en devise : convertissez au taux du jour du paiement.",
  date: "Date de la facture ou du paiement. C'est elle qui range la dépense dans la bonne période des rapports.",
  paidBy: "Facilite le rapprochement avec le relevé bancaire ou la caisse.",
  forWhom: "Le rattachement décide où la dépense compte. C'est le choix le plus important du formulaire.",
  receiptZone: "Glisser la facture ici ou choisir un fichier",
  receiptFormats: "PDF, JPG, PNG ou WEBP · 10 Mo max · une photo prise au téléphone suffit",
  receipt: "Conservé avec la dépense. Les dépenses sans justificatif sont signalées « À joindre » dans la liste.",
  notesPlaceholder: "Ex. : taxe de séjour ajoutée par l'hôtel, à négocier au prochain contrat",
};

export const IMPACT_TEXT: Record<ExpenseAttachment, { title: (name: string) => string; body: string }> = {
  dossier: {
    title: (ref) => `Marge réelle du dossier ${ref}`,
    body: "La dépense s'ajoute au coût réel de ce dossier. Sa marge réelle et l'écart avec le prévisionnel se mettent à jour.",
  },
  produit: {
    title: (name) => `Rentabilité du produit ${name}`,
    body: "Comptée dans le coût du produit sur la période. Les marges des dossiers ne bougent pas : la dépense n'est pas répartie entre eux.",
  },
  vehicule: {
    title: (name) => `Coûts du véhicule ${name}`,
    body: "Suivie par véhicule. Aucun dossier n'est touché.",
  },
  general: {
    title: () => "Frais de structure de l'agence",
    body: "Apparaît dans le compte de résultat et le résultat annuel. Aucune marge de dossier ni de produit n'est touchée.",
  },
};

export const WHICH_ATTACHMENT: { text: string; target: string }[] = [
  { text: "Un client précis en a bénéficié (sa nuit d'hôtel, son guide, son déjeuner)", target: "Dossier" },
  { text: "Tout un départ en a bénéficié, sans répartition évidente", target: "Produit" },
  { text: "Un véhicule de l'agence, sans client précis", target: "Véhicule" },
  { text: "L'agence elle-même (loyer, banque, abonnements)", target: "Frais généraux" },
];

export const LIST_LEGEND =
  "Dossier : entre dans la marge réelle du dossier · Produit : rentabilité du produit, non ventilée sur les dossiers · Véhicule : suivi par véhicule · Frais généraux : structure, hors marge des dossiers.";

export type ExpensePaymentMethod = "transfer" | "cash" | "card" | "cheque";
export const EXPENSE_PAYMENT_METHODS: { value: ExpensePaymentMethod; label: string }[] = [
  { value: "transfer", label: "Virement" },
  { value: "cash", label: "Espèces" },
  { value: "card", label: "Carte" },
  { value: "cheque", label: "Chèque" },
];
export const EXPENSE_PAYMENT_LABEL: Record<string, string> = Object.fromEntries(EXPENSE_PAYMENT_METHODS.map((m) => [m.value, m.label]));

export const RECEIPT_BUCKET = "expense-receipts";
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// ---------------------------------------------------------------- liste : période

export type PeriodKey = "month" | "prev" | "quarter" | "custom";

export type ExpenseFilters = {
  q: string;
  cat: string;
  period: PeriodKey;
  from: string;
  to: string;
  att: ExpenseAttachment | "";
  vehicle: string;
  noReceipt: boolean;
  reservation: string;
  circuit: string;
  page: number;
};

/** Bornes (jours civils, Casablanca) d'une période, et de la période précédente de même longueur. */
export function periodRange(f: Pick<ExpenseFilters, "period" | "from" | "to">, now: number = Date.now()): { start: string; end: string; prevStart: string; prevEnd: string; label: string } {
  const today = agencyDate(now);
  const [y, m] = today.split("-").map(Number);
  const ymd = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm - 1, dd)).toISOString().slice(0, 10);
  const monthLabel = (yy: number, mm: number) =>
    new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(yy, mm - 1, 15)));
  if (f.period === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(f.from) && /^\d{4}-\d{2}-\d{2}$/.test(f.to) && f.from <= f.to) {
    const days = Math.round((Date.parse(f.to) - Date.parse(f.from)) / 86_400_000) + 1;
    return { start: f.from, end: f.to, prevStart: addDays(f.from, -days), prevEnd: addDays(f.from, -1), label: `du ${f.from.split("-").reverse().join("/")} au ${f.to.split("-").reverse().join("/")}` };
  }
  if (f.period === "prev") {
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    const ppm = pm === 1 ? 12 : pm - 1;
    const ppy = pm === 1 ? py - 1 : py;
    return { start: ymd(py, pm, 1), end: ymd(py, pm + 1, 0), prevStart: ymd(ppy, ppm, 1), prevEnd: ymd(ppy, ppm + 1, 0), label: monthLabel(py, pm) };
  }
  if (f.period === "quarter") {
    const q0 = Math.floor((m - 1) / 3) * 3 + 1;
    const start = ymd(y, q0, 1);
    const end = ymd(y, q0 + 3, 0);
    const prevStart = ymd(q0 === 1 ? y - 1 : y, q0 === 1 ? 10 : q0 - 3, 1);
    return { start, end, prevStart, prevEnd: addDays(start, -1), label: `T${(q0 + 2) / 3} ${y}` };
  }
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return { start: ymd(y, m, 1), end: ymd(y, m + 1, 0), prevStart: ymd(py, pm, 1), prevEnd: ymd(py, pm + 1, 0), label: monthLabel(y, m) };
}

/** Lecture des filtres depuis l'URL. Compatibilité : ?year=&month= (liens de la carte Marge) → période personnalisée. */
export function parseExpenseFilters(sp: Record<string, string | undefined>): ExpenseFilters {
  let period = (["month", "prev", "quarter", "custom"].includes(sp.period ?? "") ? sp.period : "month") as PeriodKey;
  let from = sp.from ?? "";
  let to = sp.to ?? "";
  if (sp.year && sp.month !== undefined && !sp.period) {
    const yy = Number(sp.year);
    const mm = Number(sp.month) + 1; // ancien format : mois 0-11
    if (Number.isInteger(yy) && mm >= 1 && mm <= 12) {
      period = "custom";
      from = new Date(Date.UTC(yy, mm - 1, 1)).toISOString().slice(0, 10);
      to = new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
    }
  }
  const att = (ATTACHMENTS as string[]).includes(sp.att ?? "") ? (sp.att as ExpenseAttachment) : "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  return {
    q: (sp.q ?? "").trim(),
    cat: sp.cat ?? "",
    period,
    from,
    to,
    att,
    vehicle: sp.vehicle ?? "",
    noReceipt: sp.sans_justif === "1",
    reservation: sp.reservation ?? "",
    circuit: sp.circuit ?? "",
    page,
  };
}

export function filtersToSearch(f: ExpenseFilters, over: Partial<ExpenseFilters> = {}): string {
  const m = { ...f, ...over };
  const sp = new URLSearchParams();
  if (m.q) sp.set("q", m.q);
  if (m.cat) sp.set("cat", m.cat);
  if (m.period !== "month") sp.set("period", m.period);
  if (m.period === "custom") {
    if (m.from) sp.set("from", m.from);
    if (m.to) sp.set("to", m.to);
  }
  if (m.att) sp.set("att", m.att);
  if (m.vehicle) sp.set("vehicle", m.vehicle);
  if (m.noReceipt) sp.set("sans_justif", "1");
  if (m.reservation) sp.set("reservation", m.reservation);
  if (m.circuit) sp.set("circuit", m.circuit);
  if (m.page > 1) sp.set("page", String(m.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilter(f: ExpenseFilters): boolean {
  return Boolean(f.q || f.cat || f.period !== "month" || f.att || f.vehicle || f.noReceipt || f.reservation || f.circuit);
}
