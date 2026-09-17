-- =====================================================================
-- Voyageurs nominatifs par dossier de réservation
-- (distinction client payeur / voyageurs). Backoffice uniquement.
-- Appliqué dans le SQL Editor le 2026-09-17.
-- =====================================================================

create table if not exists public.reservation_travelers (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  full_name text not null,
  traveler_type text not null default 'adult'
    check (traveler_type in ('adult', 'child')),
  date_of_birth date,
  nationality text,          -- nom français, même référentiel que customers.country
  passport_number text,      -- affiché masqué dans l'UI ; jamais exposé hors backoffice
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservation_travelers_reservation_idx
  on public.reservation_travelers (reservation_id);

-- updated_at automatique (helper existant du schéma initial)
drop trigger if exists reservation_travelers_updated_at on public.reservation_travelers;
create trigger reservation_travelers_updated_at
  before update on public.reservation_travelers
  for each row execute function public.set_updated_at();

-- RLS : staff authentifié uniquement (réplique payments_staff_all).
-- Aucun accès anon, aucun accès client : les données ne sortent pas du backoffice.
alter table public.reservation_travelers enable row level security;

drop policy if exists "reservation_travelers_staff_all" on public.reservation_travelers;
create policy "reservation_travelers_staff_all" on public.reservation_travelers
  for all using (public.is_staff()) with check (public.is_staff());
