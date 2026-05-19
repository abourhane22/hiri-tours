export type UserRole = "admin" | "commercial" | "comptable" | "guide" | "client";
export type CircuitCategory = "circuit" | "excursion" | "transfert" | "sejour";
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
  created_at: string;
  updated_at: string;
};

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

export type ReservationWithCircuit = Reservation & {
  circuits: Pick<Circuit, "title" | "slug" | "category"> | null;
};

export type PaymentMethod = "cmi" | "stripe" | "paypal" | "cash" | "transfer";

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

export type Invoice = {
  id: string;
  invoice_number: string;
  reservation_id: string;
  customer_id: string;
  issued_at: string;
  status: "issued" | "cancelled";
  cancelled_at: string | null;
  cancellation_reason: string | null;
  company_snapshot: CompanySettings;
  customer_snapshot: any;
  lines: InvoiceLine[];
  total_ht_mad: number;
  tva_rate: number;
  tva_amount_mad: number;
  total_ttc_mad: number;
  notes: string | null;
  created_at: string;
};

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
