-- Journal léger des requêtes publiques (rate-limit du tunnel /reserver).
-- Écrit uniquement via la clé service-role (les server actions publiques) ;
-- RLS activé sans policy → aucun accès via les clés anon/authentifiées.

create table if not exists public.public_request_log (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  kind text not null default 'reservation',
  created_at timestamptz not null default now()
);

create index if not exists public_request_log_ip_created_idx
  on public.public_request_log (ip, created_at desc);

alter table public.public_request_log enable row level security;

-- Purge manuelle possible : delete from public_request_log where created_at < now() - interval '7 days';
