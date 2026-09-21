-- ============================================================================
-- Rattrapage du dépôt — objets créés ou modifiés HORS migrations versionnées
-- (constat du 21/09/2026, lecture de la base de production).
-- ============================================================================
-- RIEN À EXÉCUTER EN PRODUCTION : tout ce fichier est déjà en place (les
-- instructions sont idempotentes — `if not exists`, `create or replace`). Il
-- sert à ce qu'un `db reset` local ou un nouvel environnement reproduise
-- fidèlement la base réelle.
--
-- Périmètre versionné ici :
--   1. reservations — colonnes ajoutées manuellement (affectation, horodatages, canal prévu)
--   2. notification_reads — marqueurs « lu » du centre de notifications
--   3. invoice_renumber_map — piste d'audit de la renumérotation des factures
--   4. numérotation définitive HT-AAAA-NNNN / AV-AAAA-NNNN (fonctions remplacées le 21/09/2026)
--
-- Dérive plus large, constatée mais VOLONTAIREMENT hors de ce fichier : les tables
-- customers, staff_members, vehicles, expenses, cost_categories, company_settings et
-- invoices (structure de base) ne sont créées par aucune migration du dépôt ; des
-- colonnes non versionnées existent aussi sur customers (phone_normalized, first_name,
-- last_name), staff_members (documents), vehicles (maintenance, assurances) et
-- company_settings (cibles, RIB, WhatsApp). À traiter dans un lot « schéma de référence ».


-- ----------------------------------------------------------------------------
-- 1. reservations — colonnes ajoutées hors dépôt
-- ----------------------------------------------------------------------------
-- Les noms de contraintes reservations_guide_id_fkey / reservations_driver_id_fkey
-- sont utilisés par le code (hints PostgREST `staff_members!reservations_guide_id_fkey`)
-- et doivent être conservés à l'identique.
alter table public.reservations
  add column if not exists customer_id  uuid references public.customers(id) on delete set null,
  add column if not exists vehicle_id   uuid references public.vehicles(id)  on delete set null,
  add column if not exists guide_id     uuid constraint reservations_guide_id_fkey  references public.staff_members(id) on delete set null,
  add column if not exists driver_id    uuid constraint reservations_driver_id_fkey references public.staff_members(id) on delete set null,
  add column if not exists confirmed_at timestamptz,   -- Demande → Confirmée (premier encaissement ou action staff)
  add column if not exists paid_at      timestamptz,   -- trigger paiements : solde encaissé
  add column if not exists completed_at timestamptz,   -- cron /api/complete-departed
  add column if not exists cancelled_at timestamptz,
  add column if not exists intended_payment_channel text
       check (intended_payment_channel in ('carte','virement','agence'));  -- canal annoncé par le tunnel public

create index if not exists reservations_customer_idx on public.reservations (customer_id);
create index if not exists reservations_guide_idx    on public.reservations (guide_id, departure_date);
create index if not exists reservations_driver_idx   on public.reservations (driver_id, departure_date);
create index if not exists reservations_vehicle_idx  on public.reservations (vehicle_id, departure_date);

comment on column public.reservations.intended_payment_channel is
  'Canal de règlement annoncé : carte (lien de paiement) | virement | agence (J-7). Renseigné par le tunnel public et le formulaire backoffice.';


-- ----------------------------------------------------------------------------
-- 2. notification_reads — marqueurs « lu » (centre de notifications dérivé, lib/notifications.ts)
-- ----------------------------------------------------------------------------
-- Écrit par app/admin/notification-actions.ts en upsert sur (user_id, notification_key).
create table if not exists public.notification_reads (
  user_id          uuid not null references auth.users(id) on delete cascade,
  notification_key text not null,                       -- ex. 'solde-j7:<reservation_id>', 'attente-48h:<reservation_id>'
  read_at          timestamptz not null default now(),
  primary key (user_id, notification_key)
);

alter table public.notification_reads enable row level security;

-- Chaque utilisateur ne voit et n'écrit que ses propres marqueurs.
drop policy if exists "notification_reads_own" on public.notification_reads;
create policy "notification_reads_own" on public.notification_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 3. invoice_renumber_map — piste d'audit de la renumérotation du 21/09/2026
-- ----------------------------------------------------------------------------
-- 97 factures renumérotées en HT-AAAA-NNNN par année d'émission, ordre
-- (issued_at, created_at, id) ; compteurs recalés 2024 → 30, 2025 → 52, 2026 → 15.
-- Aucun avoir, aucun snapshot ni texte ne référençait les anciens numéros.
create table if not exists public.invoice_renumber_map (
  invoice_id    uuid primary key references public.invoices(id) on delete cascade,
  old_number    text not null,
  new_number    text not null,
  renumbered_at timestamptz not null default now()
);
alter table public.invoice_renumber_map enable row level security;   -- aucune policy : lecture via SQL Editor uniquement
comment on table public.invoice_renumber_map is
  'Correspondance ancien → nouveau numéro de facture (renumérotation continue du 21/09/2026). Table d''audit, jamais lue par l''application.';


-- ----------------------------------------------------------------------------
-- 4. Numérotation définitive — HT-AAAA-NNNN (factures) et AV-AAAA-NNNN (avoirs)
-- ----------------------------------------------------------------------------
-- Les fonctions ont été remplacées manuellement le 21/09/2026 ; elles sont
-- ré-affirmées ici (create or replace, idempotent) pour qu'un environnement
-- rejoué depuis les migrations 20260917/20260918 — désormais alignées — reste
-- cohérent même si une version antérieure de ces fichiers avait été appliquée.

create or replace function public.invoices_assign_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from coalesce(new.issued_at, now()))::int;
  v_n    int;
begin
  if new.invoice_number is not null and new.invoice_number <> '' then
    return new;  -- numéro fourni explicitement (reprise) : on ne touche pas
  end if;
  insert into invoice_counters (year, last_number) values (v_year, 1)
  on conflict (year) do update set last_number = invoice_counters.last_number + 1
  returning last_number into v_n;
  new.invoice_number := format('HT-%s-%s', v_year, lpad(v_n::text, 4, '0'));
  return new;
end $$;

create or replace function public.credit_notes_assign_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from coalesce(new.created_at, now()))::int;
  v_n    int;
begin
  if new.credit_note_number is not null and new.credit_note_number <> '' then return new; end if;
  insert into credit_note_counters (year, last_number) values (v_year, 1)
  on conflict (year) do update set last_number = credit_note_counters.last_number + 1
  returning last_number into v_n;
  new.credit_note_number := format('AV-%s-%s', v_year, lpad(v_n::text, 4, '0'));
  return new;
end $$;

-- Vérification (lecture seule) — attendu : les deux corps contiennent 'HT-'/'AV-' et lpad(…, 4) ;
-- colonnes=9 ; notification_reads et invoice_renumber_map présentes ; prochaine facture HT-2026-0016.
-- select pg_get_functiondef('public.invoices_assign_number'::regproc) ~ 'HT-%s-%s'      as factures_ht,
--        pg_get_functiondef('public.credit_notes_assign_number'::regproc) ~ 'AV-%s-%s'   as avoirs_av,
--        (select count(*) from information_schema.columns where table_schema='public' and table_name='reservations'
--           and column_name in ('customer_id','vehicle_id','guide_id','driver_id','confirmed_at','paid_at','completed_at','cancelled_at','intended_payment_channel')) as colonnes,
--        (select count(*) from information_schema.tables where table_schema='public' and table_name in ('notification_reads','invoice_renumber_map')) as tables,
--        (select last_number + 1 from public.invoice_counters where year = 2026) as prochaine_2026;
