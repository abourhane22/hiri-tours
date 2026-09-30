-- ============================================================================
-- Lot « retours de test » (30/09/2026) — frais de service billetterie, stepper,
-- remise du voucher, facture payée automatiquement, mode d'émission des factures,
-- clé téléphone calculée en base.
-- ============================================================================
-- Blocs 1, 2, 3, 4, 5, 5b et 6 PASSÉS dans le SQL Editor le 30/09/2026 et vérifiés.
-- Bloc 3b À PASSER (canal de remise du voucher) — le code tolère son absence :
-- sans la colonne, seule la date est enregistrée.
--
-- Constat du diagnostic (bloc 0, lecture de la production) :
--   - customers : index uniques customers_phone_normalized_unique (partiel, sur
--     phone_normalized) et customers_email_unique sur lower(email) — PAS
--     lower(btrim(email)) ; l'application enregistre l'email déjà nettoyé (trim).
--   - payments : trigger update_reservation_paid_amount (AFTER INSERT) — passe le
--     dossier en 'paid' mais ne pose PAS reservations.paid_at.
--   - invoices.status : enum invoice_status (issued, paid, cancelled), défaut
--     'issued', aucune contrainte CHECK.
--   - 99 factures au 30/09 : 27 issued → paid par le bloc 5 (94 payées au total).


-- ----------------------------------------------------------------------------
-- 1. company_settings — réglages billetterie et facturation
-- ----------------------------------------------------------------------------
alter table public.company_settings
  add column if not exists ticketing_fee_per_pax_mad numeric(10,2) not null default 0
       check (ticketing_fee_per_pax_mad >= 0),
  add column if not exists ticketing_fee_pct numeric(5,2)
       check (ticketing_fee_pct is null or ticketing_fee_pct between 0 and 100),
  add column if not exists ticketing_require_full_payment boolean not null default true,
  add column if not exists invoice_issue_mode text not null default 'on_confirmation'
       check (invoice_issue_mode in ('on_confirmation','on_full_payment'));

comment on column public.company_settings.ticketing_fee_per_pax_mad is 'Billetterie : frais de service par défaut, MAD fixes par passager (pré-remplis, modifiables au dossier).';
comment on column public.company_settings.ticketing_fee_pct is 'Billetterie : % optionnel du tarif compagnie converti, ajouté au fixe.';
comment on column public.company_settings.ticketing_require_full_payment is 'Billetterie : dossier soldé exigé avant émission (contrôle serveur issueOrderAction).';
comment on column public.company_settings.invoice_issue_mode is 'generateInvoice : on_confirmation (défaut, comportement historique) | on_full_payment (dossier soldé exigé).';


-- ----------------------------------------------------------------------------
-- 2. distribution_bookings — frais figés ; colonnes du mode hold (hold REPORTÉ :
--    aucun code ne les utilise encore)
-- ----------------------------------------------------------------------------
alter table public.distribution_bookings
  add column if not exists service_fee_mad numeric(12,2) not null default 0 check (service_fee_mad >= 0),
  add column if not exists service_fee_detail jsonb,        -- {per_pax_mad, pax, pct, base_mad, from_defaults}
  add column if not exists held_at timestamptz,
  add column if not exists payment_required_by timestamptz; -- échéance Duffel d'un ordre en hold

alter table public.distribution_bookings drop constraint if exists distribution_bookings_status_check;
alter table public.distribution_bookings add constraint distribution_bookings_status_check
  check (status in ('draft','held','ordered','cancelled','failed'));

comment on column public.distribution_bookings.service_fee_mad is 'Frais de service agence figés à la création. Prix de vente = amount_mad + service_fee_mad ; coût = amount_mad.';


-- ----------------------------------------------------------------------------
-- 3. reservations.voucher_sent_at — dernière remise du voucher
-- ----------------------------------------------------------------------------
alter table public.reservations add column if not exists voucher_sent_at timestamptz;
comment on column public.reservations.voucher_sent_at is 'Dernière remise du voucher : envoi email (automatique) ou bouton « Marquer comme remis ». Canal dans voucher_delivery_channel.';

-- 3b. À PASSER — canal de la remise.
alter table public.reservations
  add column if not exists voucher_delivery_channel text
       check (voucher_delivery_channel in ('email','comptoir','whatsapp','autre'));
comment on column public.reservations.voucher_delivery_channel is 'Canal de la dernière remise du voucher : email | comptoir | whatsapp | autre.';

-- Vérification 3b — attendu : 1
-- select count(*) from information_schema.columns
-- where table_schema='public' and table_name='reservations' and column_name='voucher_delivery_channel';


-- ----------------------------------------------------------------------------
-- 4. Facture payée automatiquement quand le dossier est soldé
-- ----------------------------------------------------------------------------
alter table public.invoices add column if not exists paid_at timestamptz;

-- 4a. Le dossier change (paiement, total, statut) : la facture active suit.
create or replace function public.invoice_sync_paid_from_reservation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'cancelled' and new.total_amount_mad > 0
     and new.paid_amount_mad >= new.total_amount_mad - 0.01 then
    update invoices set status = 'paid', paid_at = coalesce(new.paid_at, now())
     where reservation_id = new.id and status = 'issued';
  elsif new.status <> 'cancelled' then
    -- Plus soldé (ex. total augmenté) : la facture revient à « émise ». Un dossier annulé garde sa facture payée.
    update invoices set status = 'issued', paid_at = null
     where reservation_id = new.id and status = 'paid';
  end if;
  return null;
end $$;

drop trigger if exists reservations_sync_invoice_paid on public.reservations;
create trigger reservations_sync_invoice_paid
  after update of paid_amount_mad, total_amount_mad, status on public.reservations
  for each row
  when (old.paid_amount_mad is distinct from new.paid_amount_mad
     or old.total_amount_mad is distinct from new.total_amount_mad
     or old.status is distinct from new.status)
  execute function public.invoice_sync_paid_from_reservation();

-- 4b. Facture émise alors que le dossier est déjà soldé : elle naît payée.
create or replace function public.invoices_paid_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r reservations%rowtype;
begin
  if new.status <> 'issued' then return new; end if;
  select * into r from reservations where id = new.reservation_id;
  if found and r.status <> 'cancelled' and r.total_amount_mad > 0
     and r.paid_amount_mad >= r.total_amount_mad - 0.01 then
    new.status := 'paid';
    new.paid_at := coalesce(r.paid_at, now());
  end if;
  return new;
end $$;

drop trigger if exists invoices_paid_on_insert on public.invoices;
create trigger invoices_paid_on_insert
  before insert on public.invoices
  for each row execute function public.invoices_paid_on_insert();


-- ----------------------------------------------------------------------------
-- 5. Rattrapage — factures émises dont le dossier est déjà soldé
-- ----------------------------------------------------------------------------
update public.invoices i
   set status = 'paid',
       paid_at = coalesce(r.paid_at,
                          (select max(p.paid_at) from public.payments p where p.reservation_id = r.id),
                          i.issued_at)
  from public.reservations r
 where r.id = i.reservation_id and i.status = 'issued'
   and r.status <> 'cancelled' and r.total_amount_mad > 0
   and r.paid_amount_mad >= r.total_amount_mad - 0.01;

-- 5b. Datation des factures DÉJÀ payées avant ce lot (paid_at vide).
update public.invoices i
   set paid_at = coalesce(r.paid_at,
                          (select max(p.paid_at) from public.payments p where p.reservation_id = r.id),
                          i.issued_at)
  from public.reservations r
 where r.id = i.reservation_id and i.status = 'paid' and i.paid_at is null;


-- ----------------------------------------------------------------------------
-- 6. customers.phone_normalized calculée en base (miroir exact de normalizePhone())
-- ----------------------------------------------------------------------------
-- Le sélecteur client (dossier, billetterie) insérait sans la clé : l'index
-- unique partiel ne voyait pas le doublon. Le trigger couvre tous les chemins.
create or replace function public.customers_normalize_phone()
returns trigger language plpgsql set search_path = public as $$
declare d text := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
begin
  if left(d, 2) = '00' then d := substr(d, 3);
  elsif d ~ '^0[567]' then d := '212' || substr(d, 2);
  end if;
  new.phone_normalized := nullif(d, '');
  return new;
end $$;

drop trigger if exists customers_normalize_phone on public.customers;
create trigger customers_normalize_phone
  before insert or update of phone on public.customers
  for each row execute function public.customers_normalize_phone();

update public.customers set phone = phone where phone is not null and phone_normalized is null;
