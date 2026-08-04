-- =====================================================================
-- Rattache l'ordre de paiement au lien tokenisé dont il est issu, pour
-- pouvoir revérifier la validité du lien (révocation / expiration) au
-- moment de la confirmation — pas seulement à l'ouverture.
-- =====================================================================

alter table public.payment_orders
  add column if not exists payment_link_id uuid references public.payment_links(id);

create index if not exists payment_orders_link_idx on public.payment_orders (payment_link_id);
