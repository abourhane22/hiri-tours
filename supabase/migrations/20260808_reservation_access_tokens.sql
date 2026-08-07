-- Jetons d'accès public à une réservation (page de suivi /reserver/suivi/[token]).
-- Pas d'expiration (consultation longue durée) ; révocable via revoked_at.
-- Écrit/lu uniquement via la clé service-role ; RLS activé sans policy.

create table if not exists public.reservation_access_tokens (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists reservation_access_tokens_reservation_idx
  on public.reservation_access_tokens (reservation_id);

alter table public.reservation_access_tokens enable row level security;
