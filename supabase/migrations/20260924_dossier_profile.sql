-- ============================================================================
-- Bloc 10 — Profil de dossier par type de produit
-- Passé et vérifié (1 / 3 / 1 / 2 / false). Idempotent, données intactes.
-- ============================================================================

-- Interrupteur produit : force la pièce d'identité des voyageurs quel que soit le type.
alter table public.circuits
  add column if not exists identity_documents_required boolean not null default false;
comment on column public.circuits.identity_documents_required is
  'Force la saisie complète de la pièce d''identité des voyageurs, quel que soit le type (fournisseur ou autorité).';

-- Transferts : vol et heure d'arrivée attendus par le chauffeur. Hébergement : régime.
alter table public.reservations
  add column if not exists arrival_flight_number text,
  add column if not exists arrival_flight_at     timestamptz,
  add column if not exists meal_plan             text
       check (meal_plan in ('none','breakfast','half_board','full_board','all_inclusive'));

-- Type de la pièce dont le numéro est dans passport_number (libellé UI « N° de pièce d'identité »).
alter table public.reservation_travelers
  add column if not exists id_document_type text check (id_document_type in ('cin','passeport'));
comment on column public.reservation_travelers.id_document_type is
  'Type de la pièce dont le numéro est dans passport_number : cin | passeport.';

-- Vérification 10 — attendu : circuits_col=1, resa_cols=3, trav_col=1, checks=2, defaut_idr=false.
-- select
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='circuits' and column_name='identity_documents_required')  as circuits_col,
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='reservations'
--      and column_name in ('arrival_flight_number','arrival_flight_at','meal_plan'))                          as resa_cols,
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='reservation_travelers' and column_name='id_document_type') as trav_col,
--   (select count(*) from pg_constraint where contype='c'
--      and (pg_get_constraintdef(oid) ilike '%meal_plan%' or pg_get_constraintdef(oid) ilike '%id_document_type%')) as checks,
--   (select column_default from information_schema.columns
--      where table_schema='public' and table_name='circuits' and column_name='identity_documents_required')  as defaut_idr;
