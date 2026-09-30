-- ============================================================================
-- Centre d'actions (30/09/2026) — état autour des tâches calculées à la volée
-- ============================================================================
-- Blocs 1 à 4 PASSÉS dans le SQL Editor le 30/09/2026 et vérifiés (3 / 3 / 3).
-- Les tâches elles-mêmes ne sont PAS stockées (lib/notifications.ts) : ces tables
-- ne portent que le report, l'assignation et le journal, rattachés à la clé
-- stable `règle:reservation_id`.

-- 1. Report par utilisateur (« Plus tard », défaut : demain 08:00 Africa/Casablanca)
create table if not exists public.task_snoozes (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  task_key      text        not null,
  snoozed_until timestamptz not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, task_key)
);
alter table public.task_snoozes enable row level security;
drop policy if exists "task_snoozes_own" on public.task_snoozes;
create policy "task_snoozes_own" on public.task_snoozes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id and public.is_staff());

-- 2. Assignation (commune à l'équipe, une personne par tâche)
create table if not exists public.task_assignments (
  task_key    text        primary key,
  assignee_id uuid        not null references auth.users(id) on delete cascade,
  assigned_by uuid        references auth.users(id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now()
);
create index if not exists task_assignments_assignee_idx on public.task_assignments (assignee_id);
alter table public.task_assignments enable row level security;
drop policy if exists "task_assignments_staff_all" on public.task_assignments;
create policy "task_assignments_staff_all" on public.task_assignments
  for all using (public.is_staff()) with check (public.is_staff());

-- 3. Journal (« Résolues aujourd'hui ») — tenu en différentiel par le calcul complet d'un membre du staff
create table if not exists public.task_log (
  task_key       text        primary key,
  reservation_id uuid        references public.reservations(id) on delete cascade,
  family         text        not null check (family in ('logistique','paiements','reservations','stock')),
  title          text        not null,
  reference      text,
  first_seen_at  timestamptz not null default now(),
  resolved_at    timestamptz,
  outcome        text        check (outcome in ('resolved','cancelled','expired')),
  assignee_id    uuid        references auth.users(id) on delete set null,
  check ((resolved_at is null) = (outcome is null))
);
create index if not exists task_log_open_idx     on public.task_log (task_key) where resolved_at is null;
create index if not exists task_log_resolved_idx on public.task_log (resolved_at) where resolved_at is not null;
alter table public.task_log enable row level security;
drop policy if exists "task_log_staff_all" on public.task_log;
create policy "task_log_staff_all" on public.task_log
  for all using (public.is_staff()) with check (public.is_staff());

-- 4. Purge des marqueurs « lu » posés sur des tâches (seules les informations ont un état lu)
delete from public.notification_reads
 where split_part(notification_key, ':', 1)
       in ('logistique-j2','solde-j7','lien-expire','resa-web','attente-48h','hors-allotement');
