-- =====================================================================
-- LOT C2a — Fournisseurs, contrats, tarifs d'achat
-- Lot PUREMENT ADDITIF : aucune table existante n'est modifiée, aucune
-- lecture de l'application actuelle ne change. Le parcours public n'est
-- pas touché.
-- À exécuter bloc par bloc, chaque bloc suivi de sa vérification.
-- (Les allotements — blocs 4 à 8 — font l'objet du lot C2b.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- BLOC 1 — suppliers
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  legal_name       text,
  supplier_type    text not null default 'autre'
                   check (supplier_type in ('hotel','transporteur','compagnie','receptif','prestataire','autre')),
  ice              text,
  if_number        text,
  rc               text,
  address_line     text,
  city             text,
  country          text default 'Maroc',
  phone            text,
  email            text,
  website          text,
  contacts         jsonb not null default '[]'::jsonb,   -- [{name, role, phone, email}]
  payment_terms    text not null default 'comptant'
                   check (payment_terms in ('comptant','15j','30j','45j','60j','fin_de_mois')),
  default_currency text not null default 'MAD',
  is_active        boolean not null default true,
  notes            text,
  created_by       uuid references auth.users(id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists suppliers_active_idx on public.suppliers (is_active) where is_active;
create index if not exists suppliers_name_idx   on public.suppliers (name);

drop trigger if exists suppliers_updated_at on public.suppliers;
create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;
drop policy if exists "suppliers_staff_all" on public.suppliers;
create policy "suppliers_staff_all" on public.suppliers
  for all using (public.is_staff()) with check (public.is_staff());

-- VÉRIFICATION BLOC 1 — attendu : colonnes=21, index>=3, policies=1, rls=t, triggers=1
-- select
--   (select count(*) from information_schema.columns where table_schema='public' and table_name='suppliers') as colonnes,
--   (select count(*) from pg_indexes  where schemaname='public' and tablename='suppliers')  as index,
--   (select count(*) from pg_policies where schemaname='public' and tablename='suppliers')  as policies,
--   (select relrowsecurity from pg_class where oid='public.suppliers'::regclass)            as rls,
--   (select count(*) from pg_trigger where tgrelid='public.suppliers'::regclass and not tgisinternal) as triggers;


-- ---------------------------------------------------------------------
-- BLOC 2 — supplier_contracts (conditions commerciales)
-- ---------------------------------------------------------------------
create table if not exists public.supplier_contracts (
  id                   uuid primary key default gen_random_uuid(),
  supplier_id          uuid not null references public.suppliers(id) on delete restrict,
  reference            text,
  label                text not null,
  valid_from           date not null,
  valid_to             date not null,
  currency             text not null default 'MAD',
  remuneration_mode    text not null default 'net'
                       check (remuneration_mode in ('commission','markup','net')),
  commission_rate      numeric(5,4) check (commission_rate >= 0 and commission_rate <= 1),
  markup_rate          numeric(5,4) check (markup_rate >= 0),
  cancellation_policy  jsonb not null default '[]'::jsonb,  -- [{days_before, penalty_pct}]
  payment_schedule     jsonb not null default '[]'::jsonb,  -- [{label, pct, due}]
  release_days_default int not null default 0 check (release_days_default >= 0),
  status               text not null default 'draft'
                       check (status in ('draft','active','expired','terminated')),
  document_url         text,
  notes                text,
  created_by           uuid references auth.users(id) default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint supplier_contracts_period_chk check (valid_from <= valid_to),
  constraint supplier_contracts_remuneration_chk check (
    (remuneration_mode = 'commission' and commission_rate is not null) or
    (remuneration_mode = 'markup'     and markup_rate     is not null) or
    (remuneration_mode = 'net')
  )
);

create index if not exists supplier_contracts_supplier_idx on public.supplier_contracts (supplier_id);
create index if not exists supplier_contracts_status_idx   on public.supplier_contracts (status);
create index if not exists supplier_contracts_period_idx   on public.supplier_contracts (valid_from, valid_to);

drop trigger if exists supplier_contracts_updated_at on public.supplier_contracts;
create trigger supplier_contracts_updated_at before update on public.supplier_contracts
  for each row execute function public.set_updated_at();

alter table public.supplier_contracts enable row level security;
drop policy if exists "supplier_contracts_staff_all" on public.supplier_contracts;
create policy "supplier_contracts_staff_all" on public.supplier_contracts
  for all using (public.is_staff()) with check (public.is_staff());

-- VÉRIFICATION BLOC 2 — attendu : colonnes=19, checks_nommes=2, policies=1, rls=t
-- select
--   (select count(*) from information_schema.columns where table_schema='public' and table_name='supplier_contracts') as colonnes,
--   (select count(*) from pg_constraint where conrelid='public.supplier_contracts'::regclass
--      and conname in ('supplier_contracts_period_chk','supplier_contracts_remuneration_chk'))                        as checks_nommes,
--   (select count(*) from pg_policies where schemaname='public' and tablename='supplier_contracts')                   as policies,
--   (select relrowsecurity from pg_class where oid='public.supplier_contracts'::regclass)                             as rls;


-- ---------------------------------------------------------------------
-- BLOC 3 — purchase_rates (tarifs d'achat)
-- Pas d'index unique : les chevauchements sont légitimes (tarif produit +
-- tarif générique, paliers de pax). L'ambiguïté est levée par la fonction
-- déterministe resolvePurchaseRate (lib/purchasing.ts), autorité unique du
-- coût d'achat — comme lib/pricing.ts l'est du prix de vente.
-- ---------------------------------------------------------------------
create table if not exists public.purchase_rates (
  id             uuid primary key default gen_random_uuid(),
  contract_id    uuid not null references public.supplier_contracts(id) on delete cascade,
  product_id     uuid references public.circuits(id) on delete cascade,  -- NULL = tarif générique du contrat
  valid_from     date not null,
  valid_to       date not null,
  unit_cost_mad  numeric(10,2) not null check (unit_cost_mad >= 0),
  child_cost_mad numeric(10,2) check (child_cost_mad >= 0),
  currency       text,                                   -- NULL = hérite du contrat
  min_pax        int check (min_pax >= 1),
  max_pax        int check (max_pax >= 1),
  conditions     jsonb not null default '{}'::jsonb,     -- room_type, occupancy, travel_class…
  priority       int not null default 0,
  notes          text,
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint purchase_rates_period_chk check (valid_from <= valid_to),
  constraint purchase_rates_pax_chk    check (min_pax is null or max_pax is null or min_pax <= max_pax)
);

create index if not exists purchase_rates_product_idx  on public.purchase_rates (product_id, valid_from, valid_to);
create index if not exists purchase_rates_contract_idx on public.purchase_rates (contract_id);

drop trigger if exists purchase_rates_updated_at on public.purchase_rates;
create trigger purchase_rates_updated_at before update on public.purchase_rates
  for each row execute function public.set_updated_at();

alter table public.purchase_rates enable row level security;
drop policy if exists "purchase_rates_staff_all" on public.purchase_rates;
create policy "purchase_rates_staff_all" on public.purchase_rates
  for all using (public.is_staff()) with check (public.is_staff());

-- VÉRIFICATION BLOC 3 — attendu : colonnes=16, fk=3, policies=1, rls=t
--   Les 3 clés étrangères sont : contract_id → supplier_contracts,
--   product_id → circuits, created_by → auth.users.
-- select
--   (select count(*) from information_schema.columns where table_schema='public' and table_name='purchase_rates') as colonnes,
--   (select count(*) from pg_constraint where conrelid='public.purchase_rates'::regclass and contype='f')          as fk,
--   (select count(*) from pg_policies where schemaname='public' and tablename='purchase_rates')                    as policies,
--   (select relrowsecurity from pg_class where oid='public.purchase_rates'::regclass)                              as rls;
