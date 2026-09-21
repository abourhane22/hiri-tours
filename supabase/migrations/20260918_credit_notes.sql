-- =====================================================================
-- Avoirs & remboursements — complément du circuit de facturation
-- Bloc A passé SÉPARÉMENT (valeur d'enum), puis blocs B–F,
-- dans le SQL Editor le 2026-09-18.
-- =====================================================================

-- A. Méthode de paiement « avoir » (réutilisation d'un avoir sur un dossier).
--    ⚠ À exécuter SEULE, dans sa propre requête, AVANT le reste
--    (une valeur d'enum n'est utilisable qu'une fois committée).
alter type payment_method add value if not exists 'credit_note';

-- ---------------------------------------------------------------------
-- B. Avoirs
create table if not exists public.credit_notes (
  id                 uuid primary key default gen_random_uuid(),
  credit_note_number text not null unique,                 -- AV-2026-0001 (trigger, 4 chiffres)
  invoice_id         uuid not null references public.invoices(id),
  reservation_id     uuid not null references public.reservations(id),
  customer_id        uuid references public.customers(id),  -- pour « avoirs du même client »
  amount_mad         numeric(10, 2) not null check (amount_mad > 0),
  reason             text not null,                         -- annulation · geste commercial · erreur · autre
  reason_details     text,
  snapshot           jsonb not null,                        -- document figé (facture, dossier, client, agence)
  remaining_mad      numeric(10, 2) not null check (remaining_mad >= 0),
  status             text not null default 'issued'
                     check (status in ('issued', 'consumed', 'refunded')),
  created_by         uuid references auth.users(id) default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists credit_notes_invoice_idx     on public.credit_notes (invoice_id);
create index if not exists credit_notes_reservation_idx on public.credit_notes (reservation_id);
create index if not exists credit_notes_customer_idx    on public.credit_notes (customer_id);

drop trigger if exists credit_notes_updated_at on public.credit_notes;
create trigger credit_notes_updated_at before update on public.credit_notes
  for each row execute function public.set_updated_at();

-- Lien retour facture → avoir qui l'a annulée
alter table public.invoices
  add column if not exists cancelled_by_credit_note_id uuid references public.credit_notes(id);

-- C. Numérotation AV-AAAA-NNNN (4 chiffres) : compteur séparé, même mécanique que les factures
create table if not exists public.credit_note_counters (
  year        int primary key,
  last_number int not null default 0
);
alter table public.credit_note_counters enable row level security;  -- aucune policy : trigger uniquement

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
  -- Format définitif AV-AAAA-NNNN (4 chiffres) — aligné sur les factures HT-AAAA-NNNN (21/09/2026).
  new.credit_note_number := format('AV-%s-%s', v_year, lpad(v_n::text, 4, '0'));
  return new;
end $$;

drop trigger if exists credit_notes_assign_number on public.credit_notes;
create trigger credit_notes_assign_number before insert on public.credit_notes
  for each row execute function public.credit_notes_assign_number();

-- D. Mouvements : utilisations (sur un dossier) et remboursements
create table if not exists public.credit_note_movements (
  id                    uuid primary key default gen_random_uuid(),
  credit_note_id        uuid not null references public.credit_notes(id) on delete cascade,
  kind                  text not null check (kind in ('use', 'refund')),
  amount_mad            numeric(10, 2) not null check (amount_mad > 0),
  target_reservation_id uuid references public.reservations(id),   -- kind = use
  payment_id            uuid references public.payments(id),       -- kind = use : l'encaissement créé
  method                text,                                      -- kind = refund : cash · transfer · card_manual
  reference             text,                                      -- n° virement / réf remboursement carte
  notes                 text,
  created_by            uuid references auth.users(id) default auth.uid(),
  created_at            timestamptz not null default now()
);
create index if not exists credit_note_movements_note_idx   on public.credit_note_movements (credit_note_id);
create index if not exists credit_note_movements_target_idx on public.credit_note_movements (target_reservation_id);

-- E. RLS staff (réplique payments_staff_all), aucun accès anon
alter table public.credit_notes enable row level security;
drop policy if exists "credit_notes_staff_all" on public.credit_notes;
create policy "credit_notes_staff_all" on public.credit_notes
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.credit_note_movements enable row level security;
drop policy if exists "credit_note_movements_staff_all" on public.credit_note_movements;
create policy "credit_note_movements_staff_all" on public.credit_note_movements
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- F. Transactions métier (une fonction = une transaction)

-- F1. Émission : verrou facture, cumul ≤ TTC, annulation par avoir si total atteint
create or replace function public.issue_credit_note(
  p_invoice_id uuid, p_amount numeric, p_reason text, p_reason_details text, p_snapshot jsonb
) returns public.credit_notes language plpgsql security invoker set search_path = public as $$
declare
  v_inv     invoices%rowtype;
  v_already numeric;
  v_note    credit_notes%rowtype;
begin
  if not public.is_staff() then raise exception 'Accès réservé au staff.'; end if;
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found then raise exception 'Facture introuvable.'; end if;
  if v_inv.status = 'cancelled' then raise exception 'Facture déjà annulée.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide.'; end if;
  select coalesce(sum(amount_mad), 0) into v_already from credit_notes where invoice_id = p_invoice_id;
  if v_already + p_amount > v_inv.total_ttc_mad + 0.01 then
    raise exception 'Le cumul des avoirs (% MAD) dépasserait le total TTC de la facture (% MAD).',
      v_already + p_amount, v_inv.total_ttc_mad;
  end if;
  insert into credit_notes (invoice_id, reservation_id, customer_id, amount_mad, reason, reason_details, snapshot, remaining_mad)
  values (p_invoice_id, v_inv.reservation_id, v_inv.customer_id, p_amount, p_reason, p_reason_details, p_snapshot, p_amount)
  returning * into v_note;
  if v_already + p_amount >= v_inv.total_ttc_mad - 0.01 then
    update invoices set status = 'cancelled', cancelled_at = now(),
      cancellation_reason = 'Annulée par avoir ' || v_note.credit_note_number,
      cancelled_by_credit_note_id = v_note.id
    where id = p_invoice_id;
  end if;
  return v_note;
end $$;

-- F2. Utilisation sur un dossier du même client : encaissement + mouvement + décrément
create or replace function public.apply_credit_note(
  p_credit_note_id uuid, p_reservation_id uuid, p_amount numeric
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_note credit_notes%rowtype;
  v_resa reservations%rowtype;
  v_pay  uuid;
begin
  if not public.is_staff() then raise exception 'Accès réservé au staff.'; end if;
  select * into v_note from credit_notes where id = p_credit_note_id for update;
  if not found then raise exception 'Avoir introuvable.'; end if;
  if v_note.remaining_mad <= 0 then raise exception 'Cet avoir est épuisé.'; end if;
  select * into v_resa from reservations where id = p_reservation_id for update;
  if not found then raise exception 'Dossier introuvable.'; end if;
  if v_resa.status = 'cancelled' then raise exception 'Dossier annulé.'; end if;
  if v_resa.customer_id is distinct from v_note.customer_id then
    raise exception 'Cet avoir appartient à un autre client.';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide.'; end if;
  if p_amount > v_note.remaining_mad + 0.01 then raise exception 'Montant supérieur au solde de l''avoir.'; end if;
  if p_amount > (v_resa.total_amount_mad - v_resa.paid_amount_mad) + 0.01 then
    raise exception 'Montant supérieur au reste à payer du dossier.';
  end if;
  insert into payments (reservation_id, method, amount_mad, external_ref, transaction_ref, source)
  values (p_reservation_id, 'credit_note'::payment_method, p_amount, v_note.credit_note_number, v_note.credit_note_number, 'credit_note')
  returning id into v_pay;
  insert into credit_note_movements (credit_note_id, kind, amount_mad, target_reservation_id, payment_id, method)
  values (p_credit_note_id, 'use', p_amount, p_reservation_id, v_pay, 'credit_note');
  update credit_notes
     set remaining_mad = remaining_mad - p_amount,
         status = case when remaining_mad - p_amount <= 0.009 then 'consumed' else status end
   where id = p_credit_note_id;
  return v_pay;
end $$;

-- F3. Remboursement déclaré (espèces / virement / carte manuel) : mouvement + décrément
create or replace function public.refund_credit_note(
  p_credit_note_id uuid, p_amount numeric, p_method text, p_reference text, p_notes text
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_note credit_notes%rowtype;
  v_mv   uuid;
begin
  if not public.is_staff() then raise exception 'Accès réservé au staff.'; end if;
  select * into v_note from credit_notes where id = p_credit_note_id for update;
  if not found then raise exception 'Avoir introuvable.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide.'; end if;
  if p_amount > v_note.remaining_mad + 0.01 then raise exception 'Montant supérieur au solde de l''avoir.'; end if;
  if p_method not in ('cash', 'transfer', 'card_manual') then raise exception 'Méthode de remboursement invalide.'; end if;
  if p_method <> 'cash' and coalesce(btrim(p_reference), '') = '' then
    raise exception 'La référence du remboursement est obligatoire pour ce mode.';
  end if;
  insert into credit_note_movements (credit_note_id, kind, amount_mad, method, reference, notes)
  values (p_credit_note_id, 'refund', p_amount, p_method, nullif(btrim(p_reference), ''), nullif(btrim(p_notes), ''))
  returning id into v_mv;
  update credit_notes
     set remaining_mad = remaining_mad - p_amount,
         status = case when remaining_mad - p_amount <= 0.009 then 'refunded' else status end
   where id = p_credit_note_id;
  return v_mv;
end $$;
