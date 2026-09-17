-- =====================================================================
-- Facturation légale : mentions, numérotation continue, snapshot complet
-- Blocs A–E appliqués dans le SQL Editor le 2026-09-17.
-- Bloc F à passer APRÈS le déploiement du code (l'ancienne action
-- createInvoice appelait encore next_invoice_number()).
-- =====================================================================

-- A. Mentions légales manquantes
alter table public.company_settings
  add column if not exists legal_form     text,            -- SARL, SARL AU…
  add column if not exists capital_mad    numeric(14, 2),  -- capital social
  add column if not exists tva_number     text,
  add column if not exists rc_city        text,            -- tribunal d'immatriculation
  add column if not exists travel_license text;            -- licence agence de voyages

-- B. Compléments du document figé
alter table public.invoices
  add column if not exists reservation_snapshot jsonb,                    -- réf, départ, pax, circuit
  add column if not exists payments_snapshot    jsonb not null default '[]'::jsonb,
  add column if not exists paid_at_issue_mad    numeric(10, 2) not null default 0,
  add column if not exists balance_at_issue_mad numeric(10, 2) not null default 0,
  add column if not exists created_by           uuid references auth.users(id) default auth.uid();

-- C. Numérotation séquentielle continue par année (trigger BEFORE INSERT).
--    Verrou de ligne sur le compteur → pas de doublon ; incrément dans la
--    transaction de l'insert → pas de trou si l'insert échoue.
create table if not exists public.invoice_counters (
  year        int primary key,
  last_number int not null default 0
);
alter table public.invoice_counters enable row level security;  -- aucune policy : accès via trigger uniquement

-- Reprise de l'existant : le compteur démarre après le dernier numéro déjà émis
insert into public.invoice_counters (year, last_number)
select extract(year from issued_at)::int,
       greatest(count(*), coalesce(max((regexp_match(invoice_number, '^FAC-\d{4}-(\d+)$'))[1]::int), 0))
from public.invoices
group by 1
on conflict (year) do update set last_number = greatest(invoice_counters.last_number, excluded.last_number);

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
  new.invoice_number := format('FAC-%s-%s', v_year, lpad(v_n::text, 5, '0'));
  return new;
end $$;

drop trigger if exists invoices_assign_number on public.invoices;
create trigger invoices_assign_number
  before insert on public.invoices
  for each row execute function public.invoices_assign_number();

-- D. Au plus une facture active par réservation (les corrections passeront par avoir)
create unique index if not exists invoices_one_active_per_reservation
  on public.invoices (reservation_id) where status <> 'cancelled';

-- E. RLS staff (réplique payments_staff_all), aucun accès anon
alter table public.invoices enable row level security;
drop policy if exists "invoices_staff_all" on public.invoices;
create policy "invoices_staff_all" on public.invoices
  for all using (public.is_staff()) with check (public.is_staff());

-- F. APRÈS déploiement du code :
-- drop function if exists public.next_invoice_number();
