-- =====================================================================
-- Attijari Payment (SIMULÉ) — ordres de paiement gateway + traçabilité
-- Reproduit le pattern des gateways bancaires marocaines :
-- un ordre signé est créé côté serveur puis vérifié au retour du callback.
-- La bascule vers le vrai Attijari Payment ne touchera que la couche simulateur
-- (lib/attijari.ts), pas ce schéma.
-- =====================================================================

-- 1. Ordres de paiement (le "panier" envoyé à la gateway)
create table if not exists public.payment_orders (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  order_id text unique not null,                       -- ATJ-{ts}-{XXXX}
  amount_mad numeric(10, 2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  signature text not null,                             -- HMAC-SHA256(order_id + montant)
  created_at timestamptz not null default now()
);

create index if not exists payment_orders_reservation_idx
  on public.payment_orders (reservation_id);
create index if not exists payment_orders_order_id_idx
  on public.payment_orders (order_id);

alter table public.payment_orders enable row level security;

-- Le staff peut lire les ordres (backoffice / audit).
-- Les écritures se font exclusivement via la clé service-role (bypass RLS)
-- depuis les server actions publiques de /payer — pas de policy d'insert.
create policy "payment_orders_staff_read" on public.payment_orders
  for select using (public.is_staff());

-- 2. Traçabilité de la source du paiement + référence externe gateway.
--    source = NULL  → paiement manuel (backoffice)
--    source = 'attijari_test' → encaissé via le simulateur Attijari
alter table public.payments add column if not exists source text;
alter table public.payments add column if not exists external_ref text;

create index if not exists payments_external_ref_idx
  on public.payments (external_ref);
