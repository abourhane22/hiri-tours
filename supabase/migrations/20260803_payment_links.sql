-- =====================================================================
-- Liens de paiement tokenisés et expirables.
-- Le client reçoit une URL /payer/t/{token} sans exposer l'UUID de la
-- réservation. Un seul lien actif à la fois par réservation.
-- =====================================================================

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  token text not null unique,          -- 32+ chars aléatoires URL-safe
  amount_mad numeric,                  -- null = restant dû au moment du clic
  expires_at timestamptz not null,
  used_at timestamptz,                 -- renseigné au premier paiement réussi
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_links_reservation_idx on public.payment_links (reservation_id);
create index if not exists payment_links_token_idx on public.payment_links (token);

alter table public.payment_links enable row level security;

-- Le staff peut lire (backoffice). Écritures via service-role uniquement.
create policy "payment_links_staff_read" on public.payment_links
  for select using (public.is_staff());
