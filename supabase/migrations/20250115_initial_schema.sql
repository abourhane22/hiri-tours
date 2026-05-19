-- =====================================================================
-- Agadir Tourisme - Initial schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`)
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- Enums ----------
create type user_role as enum ('admin', 'commercial', 'comptable', 'guide', 'client');
create type circuit_category as enum ('circuit', 'excursion', 'transfert', 'sejour');
create type reservation_status as enum ('pending', 'confirmed', 'paid', 'cancelled', 'completed');
create type payment_method as enum ('cmi', 'stripe', 'paypal', 'cash', 'transfer');

-- ---------- Profiles (extends auth.users) ----------
-- Every Supabase auth user has a row here, created automatically by the trigger below.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role user_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Circuits (catalog) ----------
create table public.circuits (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  category circuit_category not null default 'circuit',
  short_description text,
  description text,
  duration_days int not null default 1,
  duration_hours int,
  base_price_mad numeric(10, 2) not null,
  child_price_mad numeric(10, 2),
  max_participants int not null default 20,
  meeting_point text,
  included text[],
  excluded text[],
  itinerary jsonb, -- [{ day: 1, title: "...", description: "..." }]
  hero_image_url text,
  gallery_urls text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index circuits_active_idx on public.circuits (is_active) where is_active = true;
create index circuits_category_idx on public.circuits (category);

-- ---------- Seasonal pricing (optional override) ----------
create table public.circuit_seasons (
  id uuid primary key default uuid_generate_v4(),
  circuit_id uuid not null references public.circuits(id) on delete cascade,
  name text not null, -- "Haute saison", "Ramadan", etc.
  starts_on date not null,
  ends_on date not null,
  price_multiplier numeric(4, 2) not null default 1.0
);

create index circuit_seasons_circuit_idx on public.circuit_seasons (circuit_id);

-- ---------- Reservations (dossiers) ----------
create table public.reservations (
  id uuid primary key default uuid_generate_v4(),
  reference text unique not null, -- AG-2026-00001 (generated via trigger)
  client_id uuid references public.profiles(id) on delete set null,

  -- Guest booking fallback (when no account)
  guest_email text,
  guest_full_name text,
  guest_phone text,

  circuit_id uuid not null references public.circuits(id) on delete restrict,
  departure_date date not null,
  adults int not null default 1 check (adults >= 1),
  children int not null default 0 check (children >= 0),

  status reservation_status not null default 'pending',
  total_amount_mad numeric(10, 2) not null,
  paid_amount_mad numeric(10, 2) not null default 0,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reservations_client_idx on public.reservations (client_id);
create index reservations_circuit_idx on public.reservations (circuit_id);
create index reservations_status_idx on public.reservations (status);
create index reservations_departure_idx on public.reservations (departure_date);

-- Auto-generate a sequential reference like AG-2026-00001
create sequence reservation_ref_seq start 1;

create or replace function public.generate_reservation_reference()
returns trigger as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'AG-' || to_char(now(), 'YYYY') || '-' ||
                     lpad(nextval('reservation_ref_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger set_reservation_reference
  before insert on public.reservations
  for each row execute function public.generate_reservation_reference();

-- ---------- Payments ----------
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  method payment_method not null,
  amount_mad numeric(10, 2) not null,
  transaction_ref text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index payments_reservation_idx on public.payments (reservation_id);

-- ---------- updated_at trigger helper ----------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger circuits_updated_at before update on public.circuits
  for each row execute function public.set_updated_at();
create trigger reservations_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Row Level Security (RLS) — critical with Supabase
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.circuits enable row level security;
alter table public.circuit_seasons enable row level security;
alter table public.reservations enable row level security;
alter table public.payments enable row level security;

-- Helper: check if current user is staff (admin/commercial/comptable)
create or replace function public.is_staff()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'commercial', 'comptable')
  );
$$ language sql security definer stable;

-- ---- profiles ----
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_staff_read" on public.profiles
  for select using (public.is_staff());
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_staff_update" on public.profiles
  for update using (public.is_staff());

-- ---- circuits (catalog is public-readable when active) ----
create policy "circuits_public_read" on public.circuits
  for select using (is_active = true or public.is_staff());
create policy "circuits_staff_write" on public.circuits
  for all using (public.is_staff()) with check (public.is_staff());

-- ---- circuit_seasons ----
create policy "seasons_public_read" on public.circuit_seasons
  for select using (true);
create policy "seasons_staff_write" on public.circuit_seasons
  for all using (public.is_staff()) with check (public.is_staff());

-- ---- reservations ----
create policy "reservations_owner_read" on public.reservations
  for select using (auth.uid() = client_id or public.is_staff());
create policy "reservations_public_insert" on public.reservations
  for insert with check (true); -- anyone can create a booking (guest or logged)
create policy "reservations_staff_update" on public.reservations
  for update using (public.is_staff());

-- ---- payments ----
create policy "payments_staff_all" on public.payments
  for all using (public.is_staff()) with check (public.is_staff());
create policy "payments_owner_read" on public.payments
  for select using (
    exists (
      select 1 from public.reservations r
      where r.id = payments.reservation_id and r.client_id = auth.uid()
    )
  );

-- =====================================================================
-- Seed data — sample circuits to test with
-- =====================================================================

insert into public.circuits (slug, title, category, short_description, description, duration_days, duration_hours, base_price_mad, child_price_mad, max_participants, meeting_point, included, excluded, itinerary, hero_image_url) values
(
  'paradise-valley-tafraout',
  'Paradise Valley & Tafraout',
  'circuit',
  'Deux jours entre oasis cachée et villages berbères, au cœur de l''Anti-Atlas.',
  'Évadez-vous de la côte pour découvrir les piscines naturelles de Paradise Valley puis les villages roses de la région de Tafraout. Un itinéraire de deux jours en petit groupe, encadré par un guide francophone.',
  2, null, 1850.00, 1200.00, 12,
  'Bureau Bright Strategy, Boulevard du 20 Août, Agadir',
  array['Transport en 4x4 climatisé', 'Guide francophone', 'Hébergement gîte 1 nuit', 'Petit-déjeuner et dîner berbère'],
  array['Déjeuners', 'Boissons', 'Pourboires'],
  '[{"day": 1, "title": "Paradise Valley", "description": "Départ matinal vers la palmeraie d''Aourir, randonnée jusqu''aux piscines naturelles, baignade et déjeuner libre."}, {"day": 2, "title": "Tafraout & rochers peints", "description": "Route vers Tafraout via les gorges d''Aït Mansour, visite des rochers peints de Jean Vérame, retour à Agadir en fin d''après-midi."}]',
  'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=1600'
),
(
  'souk-medina-agadir',
  'Souk El Had & Médina d''Agadir',
  'excursion',
  'Demi-journée pour goûter l''Agadir authentique : épices, artisanat, thé à la menthe.',
  'Plongée dans le plus grand souk du sud marocain (6000 échoppes), puis visite de la médina reconstruite par Coco Polizzi. Notre guide vous initie au marchandage et vous fait découvrir les meilleures adresses d''épices et de produits locaux.',
  1, 4, 350.00, 200.00, 15,
  'Hall des hôtels participants ou Bureau Bright Strategy',
  array['Guide francophone', 'Transport aller-retour', 'Thé à la menthe traditionnel', 'Dégustation d''épices'],
  array['Achats personnels', 'Déjeuner'],
  '[{"day": 1, "title": "Souk & Médina", "description": "9h départ, 10h souk El Had (1h30 de visite guidée), 12h médina d''Agadir et thé chez un artisan, 13h retour."}]',
  'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1600'
),
(
  'transfert-aeroport-massira',
  'Transfert aéroport Al Massira',
  'transfert',
  'Navette privée depuis ou vers l''aéroport Agadir Al Massira.',
  'Service de transfert privé entre l''aéroport Agadir Al Massira (AGA) et votre hôtel à Agadir ou Taghazout. Véhicule climatisé, chauffeur professionnel, accueil personnalisé avec pancarte.',
  1, 1, 250.00, null, 4,
  'Aéroport Agadir Al Massira, Terminal arrivées',
  array['Chauffeur', 'Véhicule climatisé', 'Accueil avec pancarte', 'Eau minérale'],
  array['Bagages excédentaires'],
  null,
  'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=1600'
),
(
  'surf-taghazout-decouverte',
  'Initiation surf à Taghazout',
  'excursion',
  'Une journée surf sur les vagues légendaires de Taghazout, leçon comprise.',
  'Journée surf à Taghazout, capitale marocaine du surf. Cours collectif de 2h avec moniteur diplômé, planche et combinaison fournies, déjeuner en bord de mer.',
  1, 8, 550.00, 400.00, 8,
  'Bureau Bright Strategy ou directement à Taghazout',
  array['Transport A/R', 'Cours de surf 2h', 'Matériel (planche + combi)', 'Déjeuner local'],
  array['Crème solaire', 'Serviette'],
  '[{"day": 1, "title": "Journée surf", "description": "9h départ Agadir, 10h arrivée Taghazout, 10h30 cours surf, 13h déjeuner, 15h surf libre, 17h retour."}]',
  'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1600'
);
