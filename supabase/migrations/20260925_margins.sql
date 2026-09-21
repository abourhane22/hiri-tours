-- ============================================================================
-- Bloc 11 — Marges réelles vs prévisionnelles (C3a)
-- Passé et vérifié (3 / 2 / 3 / 1 / 0). Idempotent, données existantes intactes.
-- ============================================================================
-- Le coût prévisionnel est FIGÉ à la création du dossier (jamais recalculé
-- silencieusement) ; l'historique des recalculs explicites vit dans
-- cost_snapshot.previous[]. Autorité de calcul : lib/margin.ts.

alter table public.reservations
  add column if not exists expected_cost_mad numeric(10,2) check (expected_cost_mad >= 0), -- null = non renseigné
  add column if not exists cost_snapshot     jsonb,
  add column if not exists cost_snapshot_at  timestamptz;

comment on column public.reservations.expected_cost_mad is
  'Coût d''achat prévisionnel figé à la vente (MAD), dénormalisé depuis cost_snapshot pour les agrégats. null = non renseigné (jamais 0 par défaut).';
comment on column public.reservations.cost_snapshot is
  'Snapshot : {source: contract|interne|distribution, rate_id, contract_id, supplier_id, supplier_name, unit_cost, child_cost, currency, fx_rate, fx_source, quantities, computed_at, computed_by, previous:[…]}';

-- Capacité propre : coût de revient estimé saisi sur le produit, même unité que sale_unit.
-- Utilisé uniquement si aucun tarif d'achat ne se résout (source 'interne').
alter table public.circuits
  add column if not exists internal_unit_cost_mad  numeric(10,2) check (internal_unit_cost_mad  >= 0),
  add column if not exists internal_child_cost_mad numeric(10,2) check (internal_child_cost_mad >= 0);

comment on column public.circuits.internal_unit_cost_mad is
  'Coût de revient estimé pour la capacité propre (carburant, chauffeur, guide…), dans l''unité de vente du produit.';

-- Agrégats de rentabilité : dossiers d'une période avec coût figé.
create index if not exists reservations_expected_cost_idx
  on public.reservations (departure_date) where expected_cost_mad is not null;

-- Vérification 11 — attendu : resa_cols=3, circuits_cols=2, checks=3, index=1, deja_renseignes=0.
-- select
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='reservations'
--      and column_name in ('expected_cost_mad','cost_snapshot','cost_snapshot_at'))                  as resa_cols,
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='circuits'
--      and column_name in ('internal_unit_cost_mad','internal_child_cost_mad'))                      as circuits_cols,
--   (select count(*) from pg_constraint where contype='c'
--      and conrelid in ('public.reservations'::regclass, 'public.circuits'::regclass)
--      and (pg_get_constraintdef(oid) ilike '%expected_cost_mad%'
--        or pg_get_constraintdef(oid) ilike '%internal_unit_cost_mad%'
--        or pg_get_constraintdef(oid) ilike '%internal_child_cost_mad%'))                            as checks,
--   (select count(*) from pg_indexes
--      where schemaname='public' and indexname='reservations_expected_cost_idx')                      as index,
--   (select count(*) from public.reservations where expected_cost_mad is not null)                   as deja_renseignes;
