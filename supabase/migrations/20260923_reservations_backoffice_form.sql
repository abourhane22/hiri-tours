-- ============================================================================
-- Nouveau dossier backoffice — remise, origine, informations pratiques,
-- quantités, mode d'encaissement « Carte (TPE agence) », backfill origine.
-- Blocs exécutés manuellement dans l'ordre 9 → 9b → 9c, chacun suivi de sa
-- requête de vérification. Statut : 9 et 9b passés et vérifiés.
-- ============================================================================


-- ============================================================================
-- Bloc 9 — reservations : remise, origine, informations pratiques, quantités
-- ============================================================================
-- Idempotent. Le prix catalogue n'est jamais modifié :
-- total_amount_mad = prix calculé (lib/pricing.computeLineTotal) − discount_mad.
alter table public.reservations
  add column if not exists discount_mad     numeric(10,2) not null default 0 check (discount_mad >= 0),
  add column if not exists discount_reason  text
       check (discount_reason in ('client_fidele','groupe','geste_commercial','partenaire','autre')),
  add column if not exists booking_channel  text
       check (booking_channel in ('telephone','comptoir','whatsapp','email','partenaire','site_web')),
  add column if not exists special_requests text,   -- reprise sur le manifeste
  add column if not exists customer_note    text,   -- reprise sur le voucher (jamais les notes internes)
  add column if not exists group_language   text,   -- fr, en, es, de, ar, it…
  -- Quantités de la ligne selon sale_unit (per_person : adults/children existants)
  add column if not exists trips  int not null default 1 check (trips  >= 1),
  add column if not exists nights int not null default 1 check (nights >= 1),
  add column if not exists rooms  int not null default 1 check (rooms  >= 1),
  add column if not exists units  int not null default 1 check (units  >= 1);

-- Motif obligatoire dès qu'une remise est accordée (règle métier portée par la base).
alter table public.reservations drop constraint if exists reservations_discount_reason_required;
alter table public.reservations add constraint reservations_discount_reason_required
  check (discount_mad = 0 or discount_reason is not null);

comment on column public.reservations.discount_mad is
  'Remise commerciale en MAD, déjà déduite de total_amount_mad. Le prix catalogue du produit n''est jamais modifié.';
comment on column public.reservations.booking_channel is
  'Origine du dossier : telephone | comptoir | whatsapp | email | partenaire | site_web (tunnel public).';

-- Vérification 9 — attendu : nouvelles=10, checks_discount=2, check_channel=1, motif_check=1, defaults_ok=t.
-- select
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='reservations'
--      and column_name in ('discount_mad','discount_reason','booking_channel','special_requests',
--                          'customer_note','group_language','trips','nights','rooms','units'))     as nouvelles,
--   (select count(*) from pg_constraint where conrelid='public.reservations'::regclass
--      and contype='c' and pg_get_constraintdef(oid) ilike '%discount_mad%')                          as checks_discount,
--   (select count(*) from pg_constraint where conrelid='public.reservations'::regclass
--      and contype='c' and pg_get_constraintdef(oid) ilike '%booking_channel%')                       as check_channel,
--   (select count(*) from pg_constraint where conrelid='public.reservations'::regclass
--      and conname='reservations_discount_reason_required')                                          as motif_check,
--   (select bool_and(column_default is not null) from information_schema.columns
--      where table_schema='public' and table_name='reservations'
--      and column_name in ('discount_mad','trips','nights','rooms','units'))                          as defaults_ok;


-- ============================================================================
-- Bloc 9b — payment_method : carte au terminal de l'agence
-- ============================================================================
-- À passer SEUL (ALTER TYPE … ADD VALUE ne s'exécute pas dans une transaction
-- qui utilise la valeur). Libellé applicatif : « Carte (TPE agence) ».
alter type payment_method add value if not exists 'card_tpe';

-- Vérification 9b — attendu : present=1.
-- select count(*) as present from pg_enum
--   where enumtypid = 'payment_method'::regtype and enumlabel = 'card_tpe';


-- ============================================================================
-- Bloc 9c — backfill : les dossiers du tunnel public ont pour origine « site_web »
-- ============================================================================
-- Le tunnel a toujours renseigné intended_payment_channel ; c'est le marqueur
-- fiable des réservations en ligne. Les autres dossiers historiques restent
-- à null (« Non renseigné » dans le rapport Origine des dossiers).
--
-- AVANT — attendu : a_backfiller = nombre de dossiers avec intended_payment_channel
-- non nul et booking_channel null ; deja_site_web = 0.
-- select
--   (select count(*) from public.reservations
--      where intended_payment_channel is not null and booking_channel is null) as a_backfiller,
--   (select count(*) from public.reservations where booking_channel = 'site_web') as deja_site_web;

update public.reservations
   set booking_channel = 'site_web'
 where intended_payment_channel is not null
   and booking_channel is null;

-- APRÈS — attendu : a_backfiller = 0 ; site_web = la valeur « a_backfiller » d'avant ;
-- autres_canaux = 0 (le backoffice n'écrit booking_channel qu'à partir de ce lot).
-- select
--   (select count(*) from public.reservations
--      where intended_payment_channel is not null and booking_channel is null) as a_backfiller,
--   (select count(*) from public.reservations where booking_channel = 'site_web')  as site_web,
--   (select count(*) from public.reservations
--      where booking_channel is not null and booking_channel <> 'site_web')      as autres_canaux;
