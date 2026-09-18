-- =====================================================================
-- LOT C2b — Allotements : capacité par jour, anti-surbooking, release.
-- Blocs 4 à 7 passés dans le SQL Editor le 2026-09-18, vérifications
-- (a) à (d) au vert. Le bloc 8 est une recommandation NON passée.
--
-- Non-régression : au déploiement, allotment_days est vide ⇒ chaque appel
-- de consume_allotment sort en 'no_allotment' sans rien écrire. Le contrôle
-- s'active produit par produit, à la création d'un allotement, et
-- on_exhausted vaut 'request' par défaut (ne bloque rien).
-- =====================================================================

-- ---------------------------------------------------------------------
-- BLOC 4 — extension btree_gist (nécessaire à l'EXCLUDE du bloc 5)
-- ---------------------------------------------------------------------
create extension if not exists btree_gist;

-- VÉRIFICATION 4 — attendu : 1 ligne
-- select extname, extversion from pg_extension where extname = 'btree_gist';


-- ---------------------------------------------------------------------
-- BLOC 5 — allotments
-- ---------------------------------------------------------------------
create table if not exists public.allotments (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.circuits(id) on delete restrict,
  -- NULL = CAPACITÉ PROPRE : l'agence est son propre fournisseur (excursions maison).
  contract_id    uuid references public.supplier_contracts(id) on delete restrict,
  label          text not null,
  starts_on      date not null,
  ends_on        date not null,
  quota_per_day  int  not null check (quota_per_day > 0),
  -- NULL = tous les jours. Sinon 0 = dimanche … 6 = samedi (extract(dow)).
  weekdays       smallint[],
  -- 0 = pas de release : le stock reste vendable jusqu'au jour même.
  release_days   int  not null default 0 check (release_days >= 0),
  commitment     text not null default 'guaranteed'
                 check (commitment in ('guaranteed','on_request','free_sale')),
  -- 'request' par défaut : NE BLOQUE RIEN tant que tu ne passes pas en 'block'.
  on_exhausted   text not null default 'request'
                 check (on_exhausted in ('block','request')),
  is_active      boolean not null default true,
  notes          text,
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint allotments_period_chk check (starts_on <= ends_on),

  -- Une capacité propre est nécessairement garantie : on ne « demande » pas
  -- à soi-même et on ne vend pas sa propre flotte en free sale.
  constraint allotments_own_capacity_chk
    check (contract_id is not null or commitment = 'guaranteed'),

  -- Deux allotements ACTIFS ne peuvent pas se chevaucher sur le même produit :
  -- sinon « quel quota s'applique le 14 juillet ? » n'aurait pas de réponse.
  constraint allotments_no_overlap exclude using gist (
    product_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  ) where (is_active)
);

create index if not exists allotments_product_idx  on public.allotments (product_id);
create index if not exists allotments_contract_idx on public.allotments (contract_id);

drop trigger if exists allotments_updated_at on public.allotments;
create trigger allotments_updated_at before update on public.allotments
  for each row execute function public.set_updated_at();

alter table public.allotments enable row level security;
drop policy if exists "allotments_staff_all" on public.allotments;
create policy "allotments_staff_all" on public.allotments
  for all using (public.is_staff()) with check (public.is_staff());

-- VÉRIFICATION 5 — attendu : colonnes=16, fk=3, exclude_constraint=1,
--                  contraintes_nommees=2, policies=1, rls=t
-- select
--   (select count(*) from information_schema.columns where table_schema='public' and table_name='allotments') as colonnes,
--   (select count(*) from pg_constraint where conrelid='public.allotments'::regclass and contype='f')          as fk,
--   (select count(*) from pg_constraint where conrelid='public.allotments'::regclass and contype='x')          as exclude_constraint,
--   (select count(*) from pg_constraint where conrelid='public.allotments'::regclass
--      and conname in ('allotments_period_chk','allotments_own_capacity_chk'))                                 as contraintes_nommees,
--   (select count(*) from pg_policies where schemaname='public' and tablename='allotments')                    as policies,
--   (select relrowsecurity from pg_class where oid='public.allotments'::regclass)                              as rls;


-- ---------------------------------------------------------------------
-- BLOC 6 — allotment_days et allotment_movements
-- ---------------------------------------------------------------------
create table if not exists public.allotment_days (
  id           uuid primary key default gen_random_uuid(),
  allotment_id uuid not null references public.allotments(id) on delete cascade,
  -- Dénormalisé : permet l'unique (product_id, day) et une lecture directe
  -- par consume_allotment sans jointure.
  product_id   uuid not null references public.circuits(id) on delete cascade,
  day          date not null,
  quota        int  not null check (quota >= 0),
  sold         int  not null default 0 check (sold >= 0),
  released     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- INVARIANT CENTRAL — défense en profondeur. Même si une future fonction
  -- se trompait, la base refuserait de survendre.
  constraint allotment_days_sold_chk check (sold <= quota),

  -- Un seul compteur par produit et par jour (cohérent avec l'EXCLUDE du bloc 5).
  constraint allotment_days_unique_day unique (product_id, day)
);

create index if not exists allotment_days_allotment_idx on public.allotment_days (allotment_id);
create index if not exists allotment_days_open_idx      on public.allotment_days (day) where not released;

drop trigger if exists allotment_days_updated_at on public.allotment_days;
create trigger allotment_days_updated_at before update on public.allotment_days
  for each row execute function public.set_updated_at();

-- Journal append-only : `sold` reste reconstituable (Σ consume − Σ release).
-- Volontairement SANS updated_at ni trigger : un mouvement ne se modifie pas.
create table if not exists public.allotment_movements (
  id               uuid primary key default gen_random_uuid(),
  allotment_day_id uuid not null references public.allotment_days(id) on delete cascade,
  reservation_id   uuid references public.reservations(id) on delete set null,
  kind             text not null check (kind in ('consume','release')),
  qty              int  not null check (qty > 0),
  reason           text not null default 'booking'
                   check (reason in ('booking','cancellation','pax_change','manual')),
  notes            text,
  created_by       uuid references auth.users(id) default auth.uid(),
  created_at       timestamptz not null default now()
);

create index if not exists allotment_movements_day_idx  on public.allotment_movements (allotment_day_id);
create index if not exists allotment_movements_resa_idx on public.allotment_movements (reservation_id);

alter table public.allotment_days enable row level security;
drop policy if exists "allotment_days_staff_all" on public.allotment_days;
create policy "allotment_days_staff_all" on public.allotment_days
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.allotment_movements enable row level security;
drop policy if exists "allotment_movements_staff_all" on public.allotment_movements;
create policy "allotment_movements_staff_all" on public.allotment_movements
  for all using (public.is_staff()) with check (public.is_staff());

-- VÉRIFICATION 6 — attendu : jours_colonnes=9, jours_fk=2, sold_chk=1, unique_day=1,
--                  mvt_colonnes=9, mvt_fk=3, rls_jours=t, rls_mvt=t
-- select
--   (select count(*) from information_schema.columns where table_schema='public' and table_name='allotment_days')      as jours_colonnes,
--   (select count(*) from pg_constraint where conrelid='public.allotment_days'::regclass and contype='f')               as jours_fk,
--   (select count(*) from pg_constraint where conrelid='public.allotment_days'::regclass and conname='allotment_days_sold_chk')   as sold_chk,
--   (select count(*) from pg_constraint where conrelid='public.allotment_days'::regclass and conname='allotment_days_unique_day') as unique_day,
--   (select count(*) from information_schema.columns where table_schema='public' and table_name='allotment_movements') as mvt_colonnes,
--   (select count(*) from pg_constraint where conrelid='public.allotment_movements'::regclass and contype='f')          as mvt_fk,
--   (select relrowsecurity from pg_class where oid='public.allotment_days'::regclass)                                   as rls_jours,
--   (select relrowsecurity from pg_class where oid='public.allotment_movements'::regclass)                              as rls_mvt;


-- ---------------------------------------------------------------------
-- BLOC 7 — Fonctions
--
-- Garde d'accès : is_staff() OR auth.role() = 'service_role'.
-- Le service_role est indispensable car consume_allotment est appelée
-- depuis le tunnel public via createAdminClient(), où auth.uid() est NULL.
-- Le code appelant (lib/allotments.ts) traite toute EXCEPTION comme
-- « contrôle d'allotement indisponible » : la réservation se crée quand
-- même, l'erreur est journalisée, la réconciliation la fait remonter.
-- ---------------------------------------------------------------------

-- 7.1 — sync_allotment_days : matérialisation des compteurs, refus explicites.
create or replace function public.sync_allotment_days(p_allotment_id uuid)
returns int
language plpgsql
security invoker                 -- la RLS de allotments/allotment_days fait le contrôle
set search_path = public
as $$
declare
  a          allotments%rowtype;
  v_days     date[];
  v_blocking text;
  v_conflict text;
  v_count    int;
begin
  select * into a from allotments where id = p_allotment_id for update;
  if not found then
    raise exception 'Allotement introuvable.';   -- erreur de programmation
  end if;

  -- 1) Jours cibles : la période, filtrée par weekdays (NULL = tous les jours).
  select array_agg(d::date order by d)
    into v_days
    from generate_series(a.starts_on, a.ends_on, interval '1 day') as d
   where a.weekdays is null
      or extract(dow from d)::smallint = any (a.weekdays);
  v_days := coalesce(v_days, '{}'::date[]);

  -- 2) REFUS : un jour conservé verrait son quota passer SOUS le vendu.
  --    On ne rogne pas silencieusement — l'écran doit dire la vérité.
  select string_agg(
           to_char(day, 'DD/MM/YYYY') || ' (' || sold || ' vendu' ||
           case when sold > 1 then 's' else '' end || ')',
           ', ' order by day)
    into v_blocking
    from allotment_days
   where allotment_id = p_allotment_id
     and day = any (v_days)
     and sold > a.quota_per_day;

  if v_blocking is not null then
    raise exception
      'Quota impossible à ramener à % : déjà vendu au-delà sur ces jours — %.',
      a.quota_per_day, v_blocking;
  end if;

  -- 3) REFUS : un jour SORTANT de la période a déjà été vendu.
  select string_agg(to_char(day, 'DD/MM/YYYY') || ' (' || sold || ')', ', ' order by day)
    into v_blocking
    from allotment_days
   where allotment_id = p_allotment_id
     and not (day = any (v_days))
     and sold > 0;

  if v_blocking is not null then
    raise exception
      'Période impossible à réduire : des ventes existent sur des jours qui en sortiraient — %.',
      v_blocking;
  end if;

  -- 4) REFUS : un AUTRE allotement occupe déjà (produit, jour).
  --    Cas courant : un allotement désactivé garde ses compteurs (on ne perd
  --    pas l'historique) ; l'EXCLUDE du bloc 5 ne joue que sur les actifs.
  --    Cas résiduel : un allotement créé INACTIF tombe sur un actif, puisque
  --    l'EXCLUDE ne s'applique pas — d'où le statut dans le message.
  select string_agg(
           distinct other.label ||
           case when other.is_active then ' (actif)' else ' (désactivé)' end,
           ', ')
    into v_conflict
    from allotment_days d
    join allotments other on other.id = d.allotment_id
   where d.product_id = a.product_id
     and d.day = any (v_days)
     and d.allotment_id <> p_allotment_id;

  if v_conflict is not null then
    raise exception
      'Un allotement % couvre déjà cette période pour ce produit. Supprimez-le ou réduisez sa période avant d''en créer un nouveau.',
      v_conflict;
  end if;

  -- 5) Jours sortants : sold = 0 garanti par l'étape 3, suppression sûre.
  delete from allotment_days
   where allotment_id = p_allotment_id
     and not (day = any (v_days));

  -- 6) Matérialisation. `sold` n'est JAMAIS touché ici.
  insert into allotment_days (allotment_id, product_id, day, quota)
  select p_allotment_id, a.product_id, d, a.quota_per_day
    from unnest(v_days) as d
  on conflict (product_id, day) do update
     set quota = excluded.quota;

  select count(*) into v_count from allotment_days where allotment_id = p_allotment_id;
  return v_count;
end $$;

-- Un allotement a TOUJOURS ses compteurs : la synchronisation est un trigger,
-- pas un appel que l'application pourrait oublier. Les refus ci-dessus
-- remontent alors à la server action, qui affiche le message tel quel.
create or replace function public.allotments_sync_trigger()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.sync_allotment_days(new.id);
  return new;
end $$;

drop trigger if exists allotments_sync_days on public.allotments;
create trigger allotments_sync_days
  after insert or update of starts_on, ends_on, quota_per_day, weekdays, product_id
  on public.allotments
  for each row execute function public.allotments_sync_trigger();


-- 7.2 — consume_allotment : issue typée, verrou de ligne.
create or replace function public.consume_allotment(
  p_product_id     uuid,
  p_day            date,
  p_qty            int,
  p_reservation_id uuid default null,
  p_reason         text default 'booking'
)
returns table (outcome text, remaining int)
language plpgsql
security invoker
set search_path = public
as $$
declare
  d allotment_days%rowtype;
  a allotments%rowtype;
begin
  -- Appelée par le backoffice (session staff) ET par le tunnel public
  -- (service_role, auth.uid() NULL) : les deux doivent passer.
  if not (public.is_staff() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Accès réservé au staff.';
  end if;

  -- Seules les erreurs de PROGRAMMATION lèvent. Les cas métier renvoient
  -- une issue typée, pour que 'on_request' puisse laisser passer.
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantité invalide (%).', p_qty;
  end if;

  -- NON-RÉGRESSION : produit non piloté par un allotement ⇒ sortie immédiate,
  -- AUCUNE écriture. Table vide au déploiement ⇒ tous les appels passent ici.
  select * into d
    from allotment_days
   where product_id = p_product_id and day = p_day
   for update;                                   -- verrou de ligne : sérialise

  if not found then
    return query select 'no_allotment'::text, null::int;
    return;
  end if;

  if d.released then
    return query select 'released'::text, 0;
    return;
  end if;

  if d.sold + p_qty > d.quota then
    select * into a from allotments where id = d.allotment_id;
    return query select
      case when a.on_exhausted = 'block' then 'blocked' else 'on_request' end::text,
      (d.quota - d.sold);
    return;
  end if;

  update allotment_days set sold = sold + p_qty where id = d.id;

  insert into allotment_movements (allotment_day_id, reservation_id, kind, qty, reason)
  values (d.id, p_reservation_id, 'consume', p_qty, coalesce(p_reason, 'booking'));

  return query select 'consumed'::text, (d.quota - d.sold - p_qty);
end $$;


-- 7.3 — release_allotment : libère tout ce qu'un dossier a consommé. Idempotente.
create or replace function public.release_allotment(
  p_reservation_id uuid,
  p_reason         text default 'cancellation'
)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  r       record;
  v_total int := 0;
begin
  if not (public.is_staff() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Accès réservé au staff.';
  end if;

  -- Net réellement consommé par ce dossier, jour par jour. Un second appel
  -- trouve un net nul et ne fait rien.
  for r in
    select m.allotment_day_id as day_id,
           sum(case when m.kind = 'consume' then m.qty else -m.qty end) as net
      from allotment_movements m
     where m.reservation_id = p_reservation_id
     group by m.allotment_day_id
    having sum(case when m.kind = 'consume' then m.qty else -m.qty end) > 0
  loop
    perform 1 from allotment_days where id = r.day_id for update;   -- verrou

    update allotment_days
       set sold = greatest(0, sold - r.net)
     where id = r.day_id;

    insert into allotment_movements (allotment_day_id, reservation_id, kind, qty, reason)
    values (r.day_id, p_reservation_id, 'release', r.net, coalesce(p_reason, 'cancellation'));

    v_total := v_total + r.net;
  end loop;

  return v_total;
end $$;


-- 7.4 — release_due_allotments : traitement de lot du cron.
--       PAS de garde applicative : l'accès est verrouillé par le GRANT
--       ci-dessous, seul le service_role peut l'exécuter.
create or replace function public.release_due_allotments()
returns int
language plpgsql
security invoker                 -- le cron passe en service_role, qui contourne la RLS
set search_path = public
as $$
declare
  v_count int;
begin
  with due as (
    update allotment_days d
       set released = true
      from allotments a
     where a.id = d.allotment_id
       and not d.released
       and a.is_active
       and a.release_days > 0                    -- 0 = pas de release
       and d.day - a.release_days <= current_date
    returning d.id
  )
  select count(*) into v_count from due;
  return v_count;
end $$;

-- Traitement de lot global : un agent ne doit pas pouvoir le déclencher.
revoke all on function public.release_due_allotments() from public, anon, authenticated;
grant execute on function public.release_due_allotments() to service_role;

-- VÉRIFICATION 7
-- (a) 5 lignes, security_definer = f partout :
-- select p.proname, pg_get_function_arguments(p.oid), pg_get_function_result(p.oid), p.prosecdef
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public' and p.proname in ('sync_allotment_days','consume_allotment',
--        'release_allotment','release_due_allotments','allotments_sync_trigger') order by 1;
-- (b) 2 triggers sur allotments : allotments_sync_days, allotments_updated_at
-- select tgname from pg_trigger where tgrelid='public.allotments'::regclass and not tgisinternal order by 1;
-- (c) sans JWT (éditeur SQL) → erreur « Accès réservé au staff. » : la garde fonctionne
-- select * from public.consume_allotment((select id from public.circuits limit 1), current_date, 1, null, 'booking');
-- (d) NON-RÉGRESSION — no_allotment | NULL, puis 0 mouvement, le tout annulé :
-- begin;
-- select set_config('request.jwt.claims', '{"role":"service_role"}', true);
-- select * from public.consume_allotment((select id from public.circuits limit 1), current_date, 1, null, 'booking');
-- select count(*) as mouvements_ecrits from public.allotment_movements;
-- rollback;


-- ---------------------------------------------------------------------
-- BLOC 8 — RECOMMANDÉ, NON PASSÉ : verrou du produit d'un allotement.
-- Les compteurs matérialisés portent product_id ; la synchronisation ne
-- nettoierait pas ceux de l'ancien produit. Un allotement est lié à son
-- produit : pour changer, on supprime et on recrée. Le formulaire et la
-- server action ne permettent déjà pas ce changement ; ce trigger le rend
-- impossible même en SQL direct (défense en profondeur).
-- ---------------------------------------------------------------------
-- create or replace function public.allotments_lock_product()
-- returns trigger language plpgsql as $$
-- begin
--   if new.product_id is distinct from old.product_id then
--     raise exception 'Le produit d''un allotement ne peut pas être modifié. Supprimez l''allotement et recréez-le.';
--   end if;
--   return new;
-- end $$;
--
-- drop trigger if exists allotments_lock_product on public.allotments;
-- create trigger allotments_lock_product
--   before update of product_id on public.allotments
--   for each row execute function public.allotments_lock_product();
--
-- VÉRIFICATION 8 — attendu : 3 triggers sur allotments
-- select tgname from pg_trigger where tgrelid='public.allotments'::regclass and not tgisinternal order by 1;
