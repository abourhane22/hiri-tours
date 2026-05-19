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
