-- ============================================================================
-- Lot D1b — Distribution aérienne (Duffel) : dossiers issus d'une offre
-- Trois sous-blocs indépendants et idempotents, exécutés manuellement dans
-- l'ordre 8.1 → 8.2 → 8.3, chacun suivi de sa requête de vérification.
-- Statut : passés et vérifiés (28 colonnes / 3 FK / 5 index / RLS ;
-- travelers 12 colonnes ; fx_rates présente).
-- ============================================================================


-- ============================================================================
-- Sous-bloc 8.1 — distribution_bookings
-- ============================================================================
-- Réservations issues d'un distributeur externe (Duffel). Le pendant de
-- `invoices` pour la distribution : l'offre et l'ordre sont FIGÉS en
-- snapshot, le statut de l'ordre vit ici — pas dans le jsonb d'un produit.
create table if not exists public.distribution_bookings (
  id                    uuid primary key default gen_random_uuid(),
  reservation_id        uuid not null references public.reservations(id) on delete restrict,
  product_id            uuid not null references public.circuits(id)     on delete restrict,
  provider              text not null default 'duffel' check (provider in ('duffel')),
  kind                  text not null default 'flight' check (kind in ('flight','stay')),
  live_mode             boolean not null default false,

  -- Offre figée au moment de la création du dossier
  offer_request_id      text,
  offer_id              text not null,
  offer_snapshot        jsonb not null,
  offer_expires_at      timestamptz,
  currency              text not null,                                   -- devise Duffel (ex. EUR)
  amount                numeric(12,2) not null check (amount >= 0),
  fx_rate               numeric(12,6) not null check (fx_rate > 0),       -- MAD pour 1 unité de `currency`
  fx_source             text not null default 'parametres'
                        check (fx_source in ('parametres','saisi')),
  amount_mad            numeric(12,2) not null check (amount_mad >= 0),

  -- Ordre (émission) — rempli au lot D1b, jamais modifié après émission
  order_id              text,
  booking_reference     text,
  order_snapshot        jsonb,
  documents             jsonb not null default '[]'::jsonb,               -- e-tickets
  payment_status        jsonb,
  cancellation_snapshot jsonb,
  status                text not null default 'draft'
                        check (status in ('draft','ordered','cancelled','failed')),
  failure_message       text,
  ordered_at            timestamptz,
  cancelled_at          timestamptz,

  created_by            uuid references auth.users(id) default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Un dossier = au plus UN ordre actif (les échecs ne comptent pas, on peut réessayer).
create unique index if not exists distribution_bookings_one_active_per_reservation
  on public.distribution_bookings (reservation_id) where status <> 'failed';

-- Un ordre Duffel n'est rattaché qu'à un seul dossier.
create unique index if not exists distribution_bookings_order_uidx
  on public.distribution_bookings (order_id) where order_id is not null;

create index if not exists distribution_bookings_reservation_idx on public.distribution_bookings (reservation_id);
create index if not exists distribution_bookings_product_idx     on public.distribution_bookings (product_id);

drop trigger if exists distribution_bookings_updated_at on public.distribution_bookings;
create trigger distribution_bookings_updated_at before update on public.distribution_bookings
  for each row execute function public.set_updated_at();

alter table public.distribution_bookings enable row level security;
drop policy if exists "distribution_bookings_staff_all" on public.distribution_bookings;
create policy "distribution_bookings_staff_all" on public.distribution_bookings
  for all using (public.is_staff()) with check (public.is_staff());

-- Vérification 8.1 — attendu : colonnes=28, fk=3 (reservation_id, product_id,
-- created_by), index=5 (pkey, one_active_per_reservation, order_uidx,
-- reservation_idx, product_idx), policies=1, rls=t, triggers=1.
-- select
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='distribution_bookings')                                  as colonnes,
--   (select count(*) from pg_constraint where conrelid='public.distribution_bookings'::regclass
--      and contype='f')                                                                                     as fk,
--   (select count(*) from pg_indexes where schemaname='public' and tablename='distribution_bookings')       as index,
--   (select count(*) from pg_policies where schemaname='public' and tablename='distribution_bookings')      as policies,
--   (select relrowsecurity from pg_class where oid='public.distribution_bookings'::regclass)                as rls,
--   (select count(*) from pg_trigger where tgrelid='public.distribution_bookings'::regclass
--      and not tgisinternal)                                                                                as triggers;


-- ============================================================================
-- Sous-bloc 8.2 — reservation_travelers : ce que Duffel exige à l'ordre
-- ============================================================================
-- Duffel exige `gender` (m/f) pour chaque passager, et `expires_on` du
-- passeport quand l'offre porte passenger_identity_documents_required.
-- `title` se dérive du genre, le pays émetteur de `nationality` via
-- lib/countries, le couple prénom/nom de `full_name`.
alter table public.reservation_travelers
  add column if not exists gender              text check (gender in ('m','f')),
  add column if not exists passport_expires_on date;

comment on column public.reservation_travelers.gender is
  'm | f — exigé par les distributeurs aériens à l''émission (Duffel : gender).';
comment on column public.reservation_travelers.passport_expires_on is
  'Date d''expiration du passeport — exigée quand l''offre requiert un document d''identité.';

-- Vérification 8.2 — attendu : colonnes=12 (10 existantes + 2), nouvelles=2, gender_check=1.
-- select
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='reservation_travelers')                                  as colonnes,
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='reservation_travelers'
--      and column_name in ('gender','passport_expires_on'))                                                 as nouvelles,
--   (select count(*) from pg_constraint where conrelid='public.reservation_travelers'::regclass
--      and contype='c' and pg_get_constraintdef(oid) ilike '%gender%')                                      as gender_check;


-- ============================================================================
-- Sous-bloc 8.3 — company_settings.fx_rates
-- ============================================================================
-- Taux de change par défaut, en MAD pour 1 unité de devise : {"EUR": 10.90, "GBP": 12.85}.
-- Éditable dans Paramètres › Société. Chaque dossier fige le taux utilisé
-- dans distribution_bookings.fx_rate (source 'parametres' ou 'saisi').
-- Volontairement sans pré-remplissage : tant que la clé est absente, l'écran
-- exige la saisie manuelle du taux à la création (source 'saisi').
alter table public.company_settings
  add column if not exists fx_rates jsonb not null default '{}'::jsonb;

comment on column public.company_settings.fx_rates is
  'Taux de change par défaut, MAD pour 1 unité de devise, ex. {"EUR": 10.90}. Le taux réellement appliqué est figé dossier par dossier.';

-- Vérification 8.3 — attendu : presente=1, defaut='{}'::jsonb, valeur_actuelle={}.
-- select
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='company_settings' and column_name='fx_rates')            as presente,
--   (select column_default from information_schema.columns
--      where table_schema='public' and table_name='company_settings' and column_name='fx_rates')            as defaut,
--   (select fx_rates from public.company_settings limit 1)                                                  as valeur_actuelle;
