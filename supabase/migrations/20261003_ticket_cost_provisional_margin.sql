-- ============================================================================
-- Coût réel automatique du billet (billetterie) + marge réelle provisoire (02/10/2026)
-- ============================================================================
-- Blocs 1, 2, 3 et 4 PASSÉS dans le SQL Editor et vérifiés. Bloc 1.3 non passé :
-- la contrainte existante est déjà amount_mad >= 0 (0 MAD accepté = remboursement total).
-- Bloc 3 : rattrapage des ordres déjà émis fait, sans_depense = 0.
-- Bloc 4 : main_cost_for posé par l'utilisateur (table en fin de fichier) et catégorie
-- « Transport sous-traité » (code transport_subcontracted) créée.

-- 1. Code stable de catégorie + « Billetterie aérienne » ; dépense automatique
alter table public.cost_categories add column if not exists code text;
create unique index if not exists cost_categories_code_uidx on public.cost_categories (code) where code is not null;
insert into public.cost_categories (name, type, description, sort_order, is_active, code)
select 'Billetterie aérienne', 'direct',
       'Billet payé à la compagnie via la distribution aérienne. Saisi automatiquement à l''émission de l''ordre — non modifiable à la main.',
       coalesce((select max(sort_order) from public.cost_categories where type = 'direct'), 0) + 1, true, 'flight_ticket'
where not exists (select 1 from public.cost_categories where code = 'flight_ticket');

alter table public.expenses
  add column if not exists source text not null default 'manual' check (source in ('manual','distribution')),
  add column if not exists distribution_booking_id uuid references public.distribution_bookings(id);
create unique index if not exists expenses_distribution_booking_uidx
  on public.expenses (distribution_booking_id) where distribution_booking_id is not null;
alter table public.expenses drop constraint if exists expenses_distribution_source_chk;
alter table public.expenses add constraint expenses_distribution_source_chk
  check ((source = 'distribution') = (distribution_booking_id is not null));

-- 2. Protection + calcul en base (idempotent, depuis les snapshots figés)
create or replace function public.expenses_protect_automatic()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('hiri.sync_distribution_expense', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' and new.source = 'distribution' then
    raise exception 'Une dépense de billetterie automatique ne se saisit pas à la main.';
  elsif tg_op = 'UPDATE' and (old.source = 'distribution' or new.source = 'distribution') then
    raise exception 'Dépense automatique (billetterie) : modification impossible.';
  elsif tg_op = 'DELETE' and old.source = 'distribution' then
    raise exception 'Dépense automatique (billetterie) : suppression impossible.';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists expenses_protect_automatic on public.expenses;
create trigger expenses_protect_automatic before insert or update or delete on public.expenses
  for each row execute function public.expenses_protect_automatic();

create or replace function public.sync_distribution_expense(p_booking_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  b        distribution_bookings%rowtype;
  v_cat    uuid;
  v_order  numeric;
  v_cur    text;
  v_refund numeric := 0;
  v_amount numeric;
  v_label  text;
  v_note   text;
  v_id     uuid;
begin
  if not (public.is_staff() or auth.role() = 'service_role' or session_user = 'postgres') then
    raise exception 'Accès réservé au staff.';
  end if;
  select * into b from distribution_bookings where id = p_booking_id for update;
  if not found then raise exception 'Réservation de distribution introuvable.'; end if;
  if b.status not in ('ordered','cancelled') or b.order_snapshot is null then return null; end if;

  select id into v_cat from cost_categories where code = 'flight_ticket';
  if v_cat is null then raise exception 'Catégorie « Billetterie aérienne » (code flight_ticket) absente.'; end if;

  v_order := coalesce((b.order_snapshot->>'total_amount')::numeric, b.amount);
  v_cur   := coalesce(b.order_snapshot->>'total_currency', b.currency);
  if v_cur <> b.currency then
    raise exception 'Devise de l''ordre (%) différente de celle de l''offre (%) : coût non calculable au taux figé.', v_cur, b.currency;
  end if;
  if b.status = 'cancelled' and b.cancellation_snapshot is not null then
    if coalesce(b.cancellation_snapshot->>'refund_currency', v_cur) <> v_cur then
      raise exception 'Remboursement en % : conversion au taux figé impossible.', b.cancellation_snapshot->>'refund_currency';
    end if;
    v_refund := coalesce((b.cancellation_snapshot->>'refund_amount')::numeric, 0);
  end if;

  v_amount := round(greatest(v_order - v_refund, 0) * b.fx_rate, 2);
  v_label  := 'Billet ' || coalesce(b.order_snapshot->'owner'->>'name', b.offer_snapshot->'owner'->>'name', 'compagnie')
              || ' — réf. ' || coalesce(b.booking_reference, b.order_id, '—');
  v_note   := 'Automatique · ordre ' || coalesce(b.order_id, '—') || ' · ' || v_order || ' ' || v_cur || ' × ' || b.fx_rate || ' MAD'
              || case when v_refund > 0 then ' · remboursé ' || v_refund || ' ' || v_cur else '' end;

  perform set_config('hiri.sync_distribution_expense', 'on', true);
  insert into expenses (expense_date, category_id, amount_mad, description, reservation_id, source, distribution_booking_id, notes)
  values ((coalesce(b.ordered_at, now()) at time zone 'Africa/Casablanca')::date, v_cat, v_amount, v_label,
          b.reservation_id, 'distribution', b.id, v_note)
  on conflict (distribution_booking_id) where distribution_booking_id is not null
  do update set amount_mad = excluded.amount_mad, description = excluded.description, notes = excluded.notes
  returning id into v_id;
  perform set_config('hiri.sync_distribution_expense', 'off', true);
  return v_id;
end $$;

-- 3. Rattrapage (passé) : une dépense automatique par ordre émis ou annulé
-- select r.reference, public.sync_distribution_expense(b.id)
-- from public.distribution_bookings b join public.reservations r on r.id = b.reservation_id
-- where b.status in ('ordered','cancelled');

-- 4. Catégories de coût fournisseur principal (marge réelle définitive, lib/margin.ts#realMarginState)
alter table public.cost_categories add column if not exists main_cost_for text[] not null default '{}';
comment on column public.cost_categories.main_cost_for is
  'Types de produit pour lesquels une dépense de cette catégorie couvre le coût fournisseur principal (marge réelle définitive).';
-- Table posée le 02/10/2026 (modifiable dans l'onglet Catégories) :
--   Billetterie aérienne            → billetterie
--   Hébergement                     → hebergement, sejour
--   Transport sous-traité           → transfert, excursion, circuit, sejour   (code transport_subcontracted)
--   Carburant, Salaires chauffeurs  → transfert
--   Salaires guides                 → excursion, circuit, sejour, prestation
--   Droits d'entrée sites           → excursion, circuit
