export type UserRole = "admin" | "commercial" | "comptable" | "guide" | "client";

/**
 * Type de produit du catalogue. La colonne s'appelle toujours `category` et la
 * table `circuits` : le renommage physique mettrait en jeu le tunnel de
 * paiement pour un gain cosmétique. Le vocabulaire « Produit » est porté par
 * l'interface (alias `ProductType` / `Product` ci-dessous).
 */
export type CircuitCategory =
  | "circuit"
  | "excursion"
  | "transfert"
  | "sejour" // forfait packagé multi-nuits, vendu PAR PERSONNE
  | "hebergement" // nuitée sèche, vendue PAR CHAMBRE ET PAR NUIT
  | "billetterie"
  | "prestation";

/** Base de facturation d'un produit. Autorité de calcul : lib/pricing.ts. */
export type SaleUnit = "per_person" | "per_night_room" | "per_trip" | "per_unit";

/** fixed = réservable en ligne · on_request = devis, hors tunnel. */
export type PricingMode = "fixed" | "on_request";
export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "cancelled"
  | "completed";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type ItineraryDay = {
  day: number;
  title: string;
  description: string;
};

export type Circuit = {
  id: string;
  slug: string;
  title: string;
  category: CircuitCategory;
  short_description: string | null;
  description: string | null;
  duration_days: number;
  duration_hours: number | null;
  base_price_mad: number;
  child_price_mad: number | null;
  max_participants: number;
  meeting_point: string | null;
  included: string[] | null;
  excluded: string[] | null;
  itinerary: ItineraryDay[] | null;
  hero_image_url: string | null;
  gallery_urls: string[] | null;
  is_active: boolean;
  category_fields: Record<string, unknown> | null;
  sale_unit: SaleUnit;
  pricing_mode: PricingMode;
  created_at: string;
  updated_at: string;
};

/** Vocabulaire d'interface : un « circuit » est un produit du catalogue. */
export type Product = Circuit;
export type ProductType = CircuitCategory;

export type Reservation = {
  id: string;
  reference: string;
  client_id: string | null;
  guest_email: string | null;
  guest_full_name: string | null;
  guest_phone: string | null;
  circuit_id: string;
  departure_date: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  total_amount_mad: number;
  paid_amount_mad: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TravelerType = "adult" | "child";

/** Voyageur nominatif d'un dossier (distinct du client payeur). Backoffice uniquement. */
export type ReservationTraveler = {
  id: string;
  reservation_id: string;
  full_name: string;
  traveler_type: TravelerType;
  date_of_birth: string | null;
  nationality: string | null;
  passport_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReservationWithCircuit = Reservation & {
  circuits: Pick<Circuit, "title" | "slug" | "category"> | null;
};

export type PaymentMethod =
  | "attijari"
  | "cmi" // legacy : valeur d'enum conservée pour les anciens paiements
  | "stripe"
  | "paypal"
  | "cash"
  | "transfer"
  | "credit_note"; // règlement par utilisation d'un avoir (pas d'entrée de trésorerie)

export type CustomerLanguage = "fr" | "en" | "ar" | "es" | "de" | "it";
export type CustomerSource =
  | "walk_in"
  | "phone"
  | "whatsapp"
  | "email"
  | "website"
  | "referral"
  | "social_media"
  | "partner"
  | "hotel"
  | "event"
  | "other";

export type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  city: string | null;
  country: string | null;
  nationality: string | null;
  preferred_language: CustomerLanguage;
  acquisition_source: CustomerSource;
  internal_notes: string | null;
  linked_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerWithStats = Customer & {
  nb_reservations: number;
  total_spent_mad: number;
  last_departure_date: string | null;
};

export type Payment = {
  id: string;
  reservation_id: string;
  method: PaymentMethod;
  amount_mad: number;
  transaction_ref: string | null;
  paid_at: string;
  created_at: string;
};

export type CircuitSeason = {
  id: string;
  circuit_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  price_multiplier: number;
};

export type CompanySettings = {
  id: string;
  legal_name: string;
  commercial_name: string;
  address_line: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  ice: string | null;
  rc: string | null;
  if_number: string | null;
  patente: string | null;
  cnss: string | null;
  tva_default_rate: number;
  iban: string | null;
  bank_name: string | null;
  bank_rib: string | null;
  bank_account_holder: string | null;
  whatsapp: string | null;
  // Mentions légales (facturation)
  legal_form: string | null; // SARL, SARL AU…
  capital_mad: number | null;
  tva_number: string | null;
  rc_city: string | null; // tribunal d'immatriculation
  travel_license: string | null; // licence agence de voyages
  updated_at: string;
};

export type InvoiceLine = {
  description: string;
  details?: string;
  quantity: number;
  unit_price_ht_mad: number;
  total_ht_mad: number;
  total_ttc_mad: number;
};

/** Client tel que figé à l'émission (pas de notes internes). */
export type InvoiceCustomerSnapshot = {
  id?: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  address_line?: string | null;
  city?: string | null;
  country?: string | null;
};

/** Prestation telle que figée à l'émission. Absent sur les factures antérieures au 2026-09-17. */
export type InvoiceReservationSnapshot = {
  id: string;
  reference: string;
  status: string;
  departure_date: string;
  adults: number;
  children: number;
  circuit_title: string | null;
  circuit_category: string | null;
  duration_days: number | null;
  duration_hours: number | null;
};

export type InvoicePaymentSnapshot = {
  paid_at: string;
  method: string;
  amount_mad: number;
  ref: string | null;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  reservation_id: string;
  customer_id: string;
  issued_at: string;
  status: "issued" | "paid" | "cancelled";
  cancelled_at: string | null;
  cancellation_reason: string | null;
  company_snapshot: CompanySettings;
  customer_snapshot: InvoiceCustomerSnapshot;
  reservation_snapshot: InvoiceReservationSnapshot | null;
  payments_snapshot: InvoicePaymentSnapshot[];
  paid_at_issue_mad: number;
  balance_at_issue_mad: number;
  lines: InvoiceLine[];
  total_ht_mad: number;
  tva_rate: number;
  tva_amount_mad: number;
  total_ttc_mad: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type CreditNoteReason = "cancellation" | "commercial_gesture" | "billing_error" | "other";
export type CreditNoteStatus = "issued" | "consumed" | "refunded";
export type RefundMethod = "cash" | "transfer" | "card_manual";

/** Avoir figé à l'émission (mêmes garanties documentaires que la facture). */
export type CreditNoteSnapshot = {
  invoice_number: string;
  invoice_issued_at: string;
  invoice_total_ttc_mad: number;
  reservation_reference: string;
  reservation_departure_date: string | null;
  circuit_title: string | null;
  customer: InvoiceCustomerSnapshot;
  company: CompanySettings;
  amount_mad: number;
  reason: CreditNoteReason;
  reason_details: string | null;
};

export type CreditNote = {
  id: string;
  credit_note_number: string;
  invoice_id: string;
  reservation_id: string;
  customer_id: string | null;
  amount_mad: number;
  reason: CreditNoteReason;
  reason_details: string | null;
  snapshot: CreditNoteSnapshot;
  remaining_mad: number;
  status: CreditNoteStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreditNoteMovement = {
  id: string;
  credit_note_id: string;
  kind: "use" | "refund";
  amount_mad: number;
  target_reservation_id: string | null;
  payment_id: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Achat : fournisseurs, contrats, tarifs (lot C2a)
// ---------------------------------------------------------------------------

export type SupplierType = "hotel" | "transporteur" | "compagnie" | "receptif" | "prestataire" | "autre";
export type PaymentTerms = "comptant" | "15j" | "30j" | "45j" | "60j" | "fin_de_mois";
export type RemunerationMode = "commission" | "markup" | "net";
export type ContractStatus = "draft" | "active" | "expired" | "terminated";

export type SupplierContact = {
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  legal_name: string | null;
  supplier_type: SupplierType;
  ice: string | null;
  if_number: string | null;
  rc: string | null;
  address_line: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  contacts: SupplierContact[];
  payment_terms: PaymentTerms;
  default_currency: string;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Barème d'annulation : pénalité applicable à J−{days_before} du départ. */
export type CancellationStep = { days_before: number; penalty_pct: number };
/** Échéancier de paiement fournisseur. */
export type PaymentStep = { label: string; pct: number; due: string };

export type SupplierContract = {
  id: string;
  supplier_id: string;
  reference: string | null;
  label: string;
  valid_from: string;
  valid_to: string;
  currency: string;
  remuneration_mode: RemunerationMode;
  commission_rate: number | null;
  markup_rate: number | null;
  cancellation_policy: CancellationStep[];
  payment_schedule: PaymentStep[];
  release_days_default: number;
  status: ContractStatus;
  document_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseRate = {
  id: string;
  contract_id: string;
  product_id: string | null; // NULL = tarif générique du contrat
  valid_from: string;
  valid_to: string;
  unit_cost_mad: number;
  child_cost_mad: number | null;
  currency: string | null; // NULL = hérite du contrat
  min_pax: number | null;
  max_pax: number | null;
  conditions: Record<string, unknown>;
  priority: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Allotements (lot C2b)
// ---------------------------------------------------------------------------

export type AllotmentCommitment = "guaranteed" | "on_request" | "free_sale";
export type AllotmentOnExhausted = "block" | "request";

export type Allotment = {
  id: string;
  product_id: string;
  /** NULL = capacité propre : l'agence est son propre fournisseur. */
  contract_id: string | null;
  label: string;
  starts_on: string;
  ends_on: string;
  quota_per_day: number;
  /** NULL = tous les jours ; sinon 0 = dimanche … 6 = samedi. */
  weekdays: number[] | null;
  /** 0 = pas de release. */
  release_days: number;
  commitment: AllotmentCommitment;
  on_exhausted: AllotmentOnExhausted;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AllotmentDay = {
  id: string;
  allotment_id: string;
  product_id: string;
  day: string;
  quota: number;
  sold: number;
  released: boolean;
  created_at: string;
  updated_at: string;
};

export type AllotmentMovement = {
  id: string;
  allotment_day_id: string;
  reservation_id: string | null;
  kind: "consume" | "release";
  qty: number;
  reason: "booking" | "cancellation" | "pax_change" | "manual";
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

/** Issue typée renvoyée par consume_allotment — jamais une exception pour un cas métier. */
export type AllotmentOutcome = "no_allotment" | "consumed" | "on_request" | "blocked" | "released";

export type VehicleType = "sedan" | "van" | "4x4" | "minibus" | "bus";
export type StaffRole = "guide" | "driver" | "both";

export type VehicleDocument = {
  name: string;
  url: string;
  uploaded_at: string;
};

export type Vehicle = {
  id: string;
  registration: string;
  make: string | null;
  model: string | null;
  type: VehicleType;
  capacity: number;
  color: string | null;
  is_active: boolean;
  notes: string | null;
  documents: VehicleDocument[] | null;
  next_maintenance_date: string | null;
  next_maintenance_km: number | null;
  insurance_expires_on: string | null;
  inspection_expires_on: string | null;
  vignette_expires_on: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffDocument = {
  name: string;
  url: string;
  uploaded_at: string;
};

export type StaffMember = {
  id: string;
  full_name: string;
  role: StaffRole;
  phone: string | null;
  email: string | null;
  languages: string[] | null;
  certifications: string | null;
  documents: StaffDocument[] | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CostCategoryType = "direct" | "overhead";

export type CostCategory = {
  id: string;
  name: string;
  type: CostCategoryType;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  expense_date: string;
  category_id: string;
  amount_mad: number;
  description: string | null;
  reservation_id: string | null;
  circuit_id: string | null;
  vehicle_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
