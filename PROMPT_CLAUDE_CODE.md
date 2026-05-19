# 🏗️ Build : Agadir Tourisme — Plateforme de gestion d'agence touristique

Tu vas créer un projet Next.js 15 complet pour une agence touristique à Agadir. Le projet utilise Supabase pour la base de données et l'authentification, et est destiné à être déployé sur Vercel.

## 📋 Contexte métier

Bright Strategy développe une plateforme intégrée pour gérer une agence touristique à Agadir (Maroc). La plateforme couvre 8 modules fonctionnels : réservations, catalogue, base clients, facturation, logistique, reporting, marketing, sécurité.

Ce projet est le **MVP scaffold** qui couvre :
- **Module 1 (partiel)** — Création de dossiers de réservation, gestion des disponibilités
- **Module 2 (partiel)** — CRUD catalogue (circuits, excursions, transferts, séjours)
- **Module 3 (partiel)** — Fiches clients, inscription/connexion, espace client
- **Module 8 (partiel)** — Authentification, rôles (admin/commercial/comptable/guide/client), RLS

Les modules 4 (facturation/paiements CMI), 5 (logistique RH), 6 (reporting BI), 7 (marketing) sont reportés en V2.

## 🛠️ Stack technique

- **Framework** : Next.js 15 (App Router) + TypeScript
- **Base de données + Auth** : Supabase (PostgreSQL managé + Row Level Security)
- **Styles** : Tailwind CSS avec palette personnalisée (sand, terracotta, atlantic)
- **Polices** : Fraunces (display serif) + Manrope (sans body)
- **Icônes** : Lucide React
- **Déploiement** : Vercel

## 🎨 Direction artistique

Aesthetic éditoriale chaleureuse inspirée d'Agadir : tons terre cuite (terracotta), océan Atlantique (atlantic), sable (sand). Pas de purple gradient générique. Typographie serif/sans-serif jumelée. Géométrie sobre, références marocaines discrètes (motifs géométriques en SVG).

## 📁 Étapes d'exécution

1. **Créer le projet** dans le répertoire courant avec la structure exacte ci-dessous
2. **Créer chaque fichier** avec le contenu exact fourni (ne pas inventer, ne pas modifier)
3. **Installer les dépendances** : `npm install`
4. **Configurer Supabase** :
   - Créer un projet sur https://supabase.com
   - Copier `.env.local.example` vers `.env.local` et remplir `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Exécuter le SQL `supabase/migrations/20250115_initial_schema.sql` dans le SQL Editor Supabase
5. **Créer un compte admin** :
   - S'inscrire via `/signup`
   - Dans Supabase SQL Editor : `UPDATE profiles SET role = 'admin' WHERE email = 'votre-email@example.com';`
6. **Lancer** : `npm run dev` → http://localhost:3000
7. **Déployer sur Vercel** :
   - `git init && git add . && git commit -m "initial"`
   - Push sur GitHub
   - Importer le repo dans Vercel et ajouter les variables d'environnement

## 🗂️ Structure du projet

```
agadir-tourisme/
├── app/
│   ├── admin/
│   │   ├── circuits/
│   │   │   ├── [id]/page.tsx       # Édition d'un circuit
│   │   │   ├── new/page.tsx        # Création d'un circuit
│   │   │   └── page.tsx            # Liste des circuits
│   │   ├── clients/page.tsx        # Liste des clients
│   │   ├── reservations/page.tsx   # Liste des réservations
│   │   ├── layout.tsx              # Layout admin avec sidebar
│   │   └── page.tsx                # Dashboard
│   ├── auth/
│   │   ├── callback/route.ts       # Confirmation email Supabase
│   │   └── signout/route.ts        # Déconnexion
│   ├── circuits/
│   │   ├── [slug]/page.tsx         # Détail circuit + formulaire de réservation
│   │   └── page.tsx                # Catalogue public
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    # Homepage
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── input.tsx
│   ├── admin-sidebar.tsx
│   └── public-header.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Client Supabase navigateur
│   │   ├── middleware.ts           # Auth middleware helper
│   │   └── server.ts               # Client Supabase serveur
│   ├── types.ts                    # Types TS du schéma DB
│   └── utils.ts                    # Helpers (cn, formatMAD, formatDate)
├── supabase/
│   └── migrations/
│       └── 20250115_initial_schema.sql  # Schéma DB + RLS + seed
├── .env.local.example
├── .gitignore
├── middleware.ts                   # Auth middleware racine
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## 🔐 Architecture sécurité

- **Row Level Security activée** sur toutes les tables (`profiles`, `circuits`, `reservations`, `payments`, `circuit_seasons`)
- **Fonction helper `is_staff()`** dans Postgres pour vérifier le rôle dans les policies
- **Middleware Next.js** qui redirige vers `/login` si non connecté pour `/admin/*`, et vers `/` si connecté mais pas staff
- **Trigger automatique** créant un profil dans `public.profiles` à l'inscription Supabase Auth

## 📝 Conventions de code à respecter

- Server Components par défaut, `"use client"` uniquement quand nécessaire (interactivité)
- Server Actions inline pour les mutations (`async function xxx(formData) { "use server"; ... }`)
- Pas de `localStorage`, tout passe par Supabase
- Toujours `await` les `searchParams` et `params` dans Next.js 15
- Toutes les couleurs via les palettes Tailwind custom (`sand`, `terracotta`, `atlantic`, `ink`)
- Les prix en MAD via `formatMAD()`, les dates via `formatDate()` / `formatDateShort()`

---

# 📄 Fichiers à créer (contenu exact)

## `package.json`

```json
{
  "name": "agadir-tourisme",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.46.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.460.0",
    "next": "15.0.3",
    "react": "19.0.0-rc-66855b96-20241106",
    "react-dom": "19.0.0-rc-66855b96-20241106",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.14.0",
    "eslint-config-next": "15.0.3",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3"
  }
}

```

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}

```

## `next.config.js`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

module.exports = nextConfig;

```

## `postcss.config.js`

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

## `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Inspired by Agadir: Atlantic ocean, sand dunes, terracotta walls, palm green
        sand: {
          50: "#FBF7F1",
          100: "#F5EDDD",
          200: "#EAD9B7",
          300: "#DBBE85",
          400: "#C99F58",
          500: "#B88239",
          600: "#9C6829",
          700: "#7C5022",
          800: "#5A3A1A",
          900: "#3D2812",
        },
        terracotta: {
          50: "#FDF4EE",
          100: "#FAE5D3",
          200: "#F4C7A4",
          300: "#ECA06C",
          400: "#E27842",
          500: "#D85A24",
          600: "#C2410C",
          700: "#A03309",
          800: "#7E290B",
          900: "#65240D",
        },
        atlantic: {
          50: "#EFF8FC",
          100: "#DAEEF6",
          200: "#B6DDEE",
          300: "#82C2E0",
          400: "#48A2CD",
          500: "#2986B6",
          600: "#1A6A99",
          700: "#15547B",
          800: "#134866",
          900: "#0F3A53",
        },
        ink: "#1C1917",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

```

## `.gitignore`

```
node_modules/
.next/
out/
build/
.env*.local
.vercel
*.log
.DS_Store
next-env.d.ts

```

## `.env.local.example`

```bash
# Copy this file to .env.local and fill in your Supabase project values.
# Get these from https://supabase.com/dashboard/project/_/settings/api

NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional — used only by server-side admin scripts (NEVER expose to the browser)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

```

## `supabase/migrations/20250115_initial_schema.sql`

```sql
-- =====================================================================
-- Agadir Tourisme - Initial schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`)
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- Enums ----------
create type user_role as enum ('admin', 'commercial', 'comptable', 'guide', 'client');
create type circuit_category as enum ('circuit', 'excursion', 'transfert', 'sejour');
create type reservation_status as enum ('pending', 'confirmed', 'paid', 'cancelled', 'completed');
create type payment_method as enum ('cmi', 'stripe', 'paypal', 'cash', 'transfer');

-- ---------- Profiles (extends auth.users) ----------
-- Every Supabase auth user has a row here, created automatically by the trigger below.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role user_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Circuits (catalog) ----------
create table public.circuits (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  category circuit_category not null default 'circuit',
  short_description text,
  description text,
  duration_days int not null default 1,
  duration_hours int,
  base_price_mad numeric(10, 2) not null,
  child_price_mad numeric(10, 2),
  max_participants int not null default 20,
  meeting_point text,
  included text[],
  excluded text[],
  itinerary jsonb, -- [{ day: 1, title: "...", description: "..." }]
  hero_image_url text,
  gallery_urls text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index circuits_active_idx on public.circuits (is_active) where is_active = true;
create index circuits_category_idx on public.circuits (category);

-- ---------- Seasonal pricing (optional override) ----------
create table public.circuit_seasons (
  id uuid primary key default uuid_generate_v4(),
  circuit_id uuid not null references public.circuits(id) on delete cascade,
  name text not null, -- "Haute saison", "Ramadan", etc.
  starts_on date not null,
  ends_on date not null,
  price_multiplier numeric(4, 2) not null default 1.0
);

create index circuit_seasons_circuit_idx on public.circuit_seasons (circuit_id);

-- ---------- Reservations (dossiers) ----------
create table public.reservations (
  id uuid primary key default uuid_generate_v4(),
  reference text unique not null, -- AG-2026-00001 (generated via trigger)
  client_id uuid references public.profiles(id) on delete set null,

  -- Guest booking fallback (when no account)
  guest_email text,
  guest_full_name text,
  guest_phone text,

  circuit_id uuid not null references public.circuits(id) on delete restrict,
  departure_date date not null,
  adults int not null default 1 check (adults >= 1),
  children int not null default 0 check (children >= 0),

  status reservation_status not null default 'pending',
  total_amount_mad numeric(10, 2) not null,
  paid_amount_mad numeric(10, 2) not null default 0,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reservations_client_idx on public.reservations (client_id);
create index reservations_circuit_idx on public.reservations (circuit_id);
create index reservations_status_idx on public.reservations (status);
create index reservations_departure_idx on public.reservations (departure_date);

-- Auto-generate a sequential reference like AG-2026-00001
create sequence reservation_ref_seq start 1;

create or replace function public.generate_reservation_reference()
returns trigger as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'AG-' || to_char(now(), 'YYYY') || '-' ||
                     lpad(nextval('reservation_ref_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger set_reservation_reference
  before insert on public.reservations
  for each row execute function public.generate_reservation_reference();

-- ---------- Payments ----------
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  method payment_method not null,
  amount_mad numeric(10, 2) not null,
  transaction_ref text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index payments_reservation_idx on public.payments (reservation_id);

-- ---------- updated_at trigger helper ----------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger circuits_updated_at before update on public.circuits
  for each row execute function public.set_updated_at();
create trigger reservations_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Row Level Security (RLS) — critical with Supabase
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.circuits enable row level security;
alter table public.circuit_seasons enable row level security;
alter table public.reservations enable row level security;
alter table public.payments enable row level security;

-- Helper: check if current user is staff (admin/commercial/comptable)
create or replace function public.is_staff()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'commercial', 'comptable')
  );
$$ language sql security definer stable;

-- ---- profiles ----
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_staff_read" on public.profiles
  for select using (public.is_staff());
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_staff_update" on public.profiles
  for update using (public.is_staff());

-- ---- circuits (catalog is public-readable when active) ----
create policy "circuits_public_read" on public.circuits
  for select using (is_active = true or public.is_staff());
create policy "circuits_staff_write" on public.circuits
  for all using (public.is_staff()) with check (public.is_staff());

-- ---- circuit_seasons ----
create policy "seasons_public_read" on public.circuit_seasons
  for select using (true);
create policy "seasons_staff_write" on public.circuit_seasons
  for all using (public.is_staff()) with check (public.is_staff());

-- ---- reservations ----
create policy "reservations_owner_read" on public.reservations
  for select using (auth.uid() = client_id or public.is_staff());
create policy "reservations_public_insert" on public.reservations
  for insert with check (true); -- anyone can create a booking (guest or logged)
create policy "reservations_staff_update" on public.reservations
  for update using (public.is_staff());

-- ---- payments ----
create policy "payments_staff_all" on public.payments
  for all using (public.is_staff()) with check (public.is_staff());
create policy "payments_owner_read" on public.payments
  for select using (
    exists (
      select 1 from public.reservations r
      where r.id = payments.reservation_id and r.client_id = auth.uid()
    )
  );

-- =====================================================================
-- Seed data — sample circuits to test with
-- =====================================================================

insert into public.circuits (slug, title, category, short_description, description, duration_days, duration_hours, base_price_mad, child_price_mad, max_participants, meeting_point, included, excluded, itinerary, hero_image_url) values
(
  'paradise-valley-tafraout',
  'Paradise Valley & Tafraout',
  'circuit',
  'Deux jours entre oasis cachée et villages berbères, au cœur de l''Anti-Atlas.',
  'Évadez-vous de la côte pour découvrir les piscines naturelles de Paradise Valley puis les villages roses de la région de Tafraout. Un itinéraire de deux jours en petit groupe, encadré par un guide francophone.',
  2, null, 1850.00, 1200.00, 12,
  'Bureau Bright Strategy, Boulevard du 20 Août, Agadir',
  array['Transport en 4x4 climatisé', 'Guide francophone', 'Hébergement gîte 1 nuit', 'Petit-déjeuner et dîner berbère'],
  array['Déjeuners', 'Boissons', 'Pourboires'],
  '[{"day": 1, "title": "Paradise Valley", "description": "Départ matinal vers la palmeraie d''Aourir, randonnée jusqu''aux piscines naturelles, baignade et déjeuner libre."}, {"day": 2, "title": "Tafraout & rochers peints", "description": "Route vers Tafraout via les gorges d''Aït Mansour, visite des rochers peints de Jean Vérame, retour à Agadir en fin d''après-midi."}]',
  'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=1600'
),
(
  'souk-medina-agadir',
  'Souk El Had & Médina d''Agadir',
  'excursion',
  'Demi-journée pour goûter l''Agadir authentique : épices, artisanat, thé à la menthe.',
  'Plongée dans le plus grand souk du sud marocain (6000 échoppes), puis visite de la médina reconstruite par Coco Polizzi. Notre guide vous initie au marchandage et vous fait découvrir les meilleures adresses d''épices et de produits locaux.',
  1, 4, 350.00, 200.00, 15,
  'Hall des hôtels participants ou Bureau Bright Strategy',
  array['Guide francophone', 'Transport aller-retour', 'Thé à la menthe traditionnel', 'Dégustation d''épices'],
  array['Achats personnels', 'Déjeuner'],
  '[{"day": 1, "title": "Souk & Médina", "description": "9h départ, 10h souk El Had (1h30 de visite guidée), 12h médina d''Agadir et thé chez un artisan, 13h retour."}]',
  'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1600'
),
(
  'transfert-aeroport-massira',
  'Transfert aéroport Al Massira',
  'transfert',
  'Navette privée depuis ou vers l''aéroport Agadir Al Massira.',
  'Service de transfert privé entre l''aéroport Agadir Al Massira (AGA) et votre hôtel à Agadir ou Taghazout. Véhicule climatisé, chauffeur professionnel, accueil personnalisé avec pancarte.',
  1, 1, 250.00, null, 4,
  'Aéroport Agadir Al Massira, Terminal arrivées',
  array['Chauffeur', 'Véhicule climatisé', 'Accueil avec pancarte', 'Eau minérale'],
  array['Bagages excédentaires'],
  null,
  'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=1600'
),
(
  'surf-taghazout-decouverte',
  'Initiation surf à Taghazout',
  'excursion',
  'Une journée surf sur les vagues légendaires de Taghazout, leçon comprise.',
  'Journée surf à Taghazout, capitale marocaine du surf. Cours collectif de 2h avec moniteur diplômé, planche et combinaison fournies, déjeuner en bord de mer.',
  1, 8, 550.00, 400.00, 8,
  'Bureau Bright Strategy ou directement à Taghazout',
  array['Transport A/R', 'Cours de surf 2h', 'Matériel (planche + combi)', 'Déjeuner local'],
  array['Crème solaire', 'Serviette'],
  '[{"day": 1, "title": "Journée surf", "description": "9h départ Agadir, 10h arrivée Taghazout, 10h30 cours surf, 13h déjeuner, 15h surf libre, 17h retour."}]',
  'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1600'
);

```

## `middleware.ts`

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - image files
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

```

## `lib/supabase/client.ts`

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

```

## `lib/supabase/server.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies can't be set here,
            // but middleware will refresh them on the next request.
          }
        },
      },
    }
  );
}

```

## `lib/supabase/middleware.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: this call refreshes the session if expired.
  // Do not remove it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /admin routes — must be logged in AND staff
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Verify staff role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const staffRoles = ["admin", "commercial", "comptable"];
    if (!profile || !staffRoles.includes(profile.role)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

```

## `lib/utils.ts`

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMAD(amount: number | string): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

```

## `lib/types.ts`

```ts
export type UserRole = "admin" | "commercial" | "comptable" | "guide" | "client";
export type CircuitCategory = "circuit" | "excursion" | "transfert" | "sejour";
export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "cancelled"
  | "completed";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type ItineraryDay = {
  day: number;
  title: string;
  description: string;
};

export type Circuit = {
  id: string;
  slug: string;
  title: string;
  category: CircuitCategory;
  short_description: string | null;
  description: string | null;
  duration_days: number;
  duration_hours: number | null;
  base_price_mad: number;
  child_price_mad: number | null;
  max_participants: number;
  meeting_point: string | null;
  included: string[] | null;
  excluded: string[] | null;
  itinerary: ItineraryDay[] | null;
  hero_image_url: string | null;
  gallery_urls: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Reservation = {
  id: string;
  reference: string;
  client_id: string | null;
  guest_email: string | null;
  guest_full_name: string | null;
  guest_phone: string | null;
  circuit_id: string;
  departure_date: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  total_amount_mad: number;
  paid_amount_mad: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReservationWithCircuit = Reservation & {
  circuits: Pick<Circuit, "title" | "slug" | "category"> | null;
};

```

## `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    @apply bg-sand-50 text-ink font-sans;
  }

  /* Heading display font + tighter tracking */
  h1, h2, h3, h4 {
    @apply font-display tracking-tight;
    font-feature-settings: "ss01", "ss02";
  }

  /* Number rendering: tabular for tables, lining where possible */
  .tabular-nums {
    font-variant-numeric: tabular-nums lining-nums;
  }

  /* Selection color */
  ::selection {
    @apply bg-terracotta-200 text-terracotta-900;
  }
}

@layer components {
  /* Subtle paper-like surface */
  .surface {
    @apply bg-white border border-sand-200 rounded-lg;
  }

  .surface-elevated {
    @apply bg-white border border-sand-200 rounded-lg shadow-sm;
  }

  /* Editorial section divider with a small terracotta mark */
  .eyebrow {
    @apply text-xs uppercase tracking-[0.2em] font-medium text-terracotta-600;
  }
}

```

## `app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agadir Tourisme — Circuits, excursions et séjours",
  description:
    "Découvrez Agadir et le Souss-Massa avec une agence locale. Circuits, excursions, transferts aéroport.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}

```

## `components/ui/button.tsx`

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50";

    const variants = {
      primary:
        "bg-terracotta-600 text-white hover:bg-terracotta-700 active:bg-terracotta-800",
      secondary:
        "bg-white text-ink border border-sand-300 hover:bg-sand-100 hover:border-sand-400",
      ghost: "text-ink hover:bg-sand-100",
      danger: "bg-red-600 text-white hover:bg-red-700",
    };

    const sizes = {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

```

## `components/ui/input.tsx`

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-md border border-sand-300 bg-white px-3 text-sm text-ink placeholder:text-sand-500 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20 disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[100px] w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-sand-500 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20 disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("block text-sm font-medium text-ink mb-1.5", className)}
    {...props}
  />
));
Label.displayName = "Label";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-10 w-full rounded-md border border-sand-300 bg-white px-3 text-sm text-ink focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20",
      className
    )}
    {...props}
  />
));
Select.displayName = "Select";

```

## `components/ui/card.tsx`

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-white border border-sand-200 rounded-lg overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-5 py-4 border-b border-sand-200 flex items-center justify-between",
        className
      )}
      {...props}
    />
  );
}

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  const tones = {
    neutral: "bg-sand-100 text-sand-800 border-sand-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-red-50 text-red-800 border-red-200",
    info: "bg-atlantic-50 text-atlantic-800 border-atlantic-200",
    accent: "bg-terracotta-50 text-terracotta-800 border-terracotta-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

```

## `components/public-header.tsx`

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export async function PublicHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isStaff = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isStaff =
      !!profile &&
      ["admin", "commercial", "comptable"].includes(profile.role);
  }

  return (
    <header className="border-b border-sand-200 bg-sand-50/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2 group">
          <span className="font-display text-2xl font-medium tracking-tight text-ink">
            Agadir
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-terracotta-600 font-medium">
            Tourisme
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link
            href="/circuits"
            className="text-ink hover:text-terracotta-600 transition-colors"
          >
            Catalogue
          </Link>
          <Link
            href="/circuits?category=excursion"
            className="text-ink hover:text-terracotta-600 transition-colors"
          >
            Excursions
          </Link>
          <Link
            href="/circuits?category=transfert"
            className="text-ink hover:text-terracotta-600 transition-colors"
          >
            Transferts
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {isStaff && (
                <Link href="/admin">
                  <Button variant="secondary" size="sm">
                    Espace admin
                  </Button>
                </Link>
              )}
              <form action="/auth/signout" method="post">
                <Button variant="ghost" size="sm">
                  Déconnexion
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Connexion
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" size="sm">
                  Créer un compte
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

```

## `components/admin-sidebar.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  Calendar,
  Users,
  Receipt,
  Truck,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/admin/reservations", label: "Réservations", icon: Calendar },
  { href: "/admin/circuits", label: "Catalogue", icon: Map },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/factures", label: "Factures", icon: Receipt, soon: true },
  { href: "/admin/logistique", label: "Logistique", icon: Truck, soon: true },
  { href: "/admin/rapports", label: "Rapports", icon: BarChart3, soon: true },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings, soon: true },
];

export function AdminSidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-sand-200 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-sand-200">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-xl font-medium text-ink">
            Agadir
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta-600 font-medium">
            Admin
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.soon ? "#" : item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-terracotta-50 text-terracotta-700 font-medium"
                  : "text-ink hover:bg-sand-100",
                item.soon && "opacity-50 cursor-not-allowed"
              )}
              onClick={(e) => item.soon && e.preventDefault()}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.soon && (
                <span className="text-[10px] text-sand-500 font-normal">
                  bientôt
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sand-200 p-3">
        {userEmail && (
          <div className="text-xs text-sand-700 px-3 py-2 truncate">
            {userEmail}
          </div>
        )}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-ink hover:bg-sand-100 transition-colors"
          >
            <LogOut className="size-4" />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}

```

## `app/page.tsx`

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { formatMAD } from "@/lib/utils";
import type { Circuit } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: circuits } = await supabase
    .from("circuits")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(4);

  return (
    <>
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-sand-200">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sand-50 via-sand-100 to-terracotta-50/40" />
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <p className="eyebrow mb-5">Agence locale · Agadir, Souss-Massa</p>
            <h1 className="font-display text-5xl md:text-7xl leading-[1.05] text-ink mb-6">
              L&apos;Atlantique,
              <br />
              <span className="text-terracotta-600 italic">l&apos;Atlas</span>,
              <br />
              et tout ce qu&apos;il y a entre.
            </h1>
            <p className="text-lg text-sand-800 max-w-xl mb-8 leading-relaxed">
              Circuits, excursions et transferts pensés par une équipe d&apos;Agadir.
              Pas d&apos;intermédiaire, pas de surprise — juste le Sud marocain comme
              il se vit.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/circuits">
                <Button size="lg">Découvrir le catalogue</Button>
              </Link>
              <Link href="/circuits?category=transfert">
                <Button variant="secondary" size="lg">
                  Transferts aéroport
                </Button>
              </Link>
            </div>
          </div>

          {/* Decorative geometric panel (Moroccan pattern inspired) */}
          <div className="hidden md:block md:col-span-5">
            <div className="aspect-[4/5] relative">
              <div className="absolute inset-0 bg-terracotta-100 rounded-lg rotate-2" />
              <div className="absolute inset-0 bg-atlantic-100 rounded-lg -rotate-1 translate-x-4 translate-y-4" />
              <div className="absolute inset-0 bg-sand-200 rounded-lg translate-x-8 translate-y-8 flex items-center justify-center">
                <svg
                  viewBox="0 0 200 200"
                  className="w-3/4 h-3/4 text-terracotta-700"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                >
                  <circle cx="100" cy="100" r="80" />
                  <circle cx="100" cy="100" r="60" />
                  <circle cx="100" cy="100" r="40" />
                  <path d="M100 20 L100 180 M20 100 L180 100 M40 40 L160 160 M40 160 L160 40" />
                  <path d="M100 20 Q140 100 100 180 Q60 100 100 20 Z" />
                  <path d="M20 100 Q100 140 180 100 Q100 60 20 100 Z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured circuits */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="eyebrow mb-3">Nos circuits</p>
            <h2 className="font-display text-4xl text-ink">
              Choisis avec soin, vécus en petit groupe
            </h2>
          </div>
          <Link
            href="/circuits"
            className="hidden md:inline-block text-sm text-terracotta-600 hover:text-terracotta-700 font-medium"
          >
            Voir tout le catalogue →
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {(circuits as Circuit[] | null)?.map((c) => (
            <Link
              key={c.id}
              href={`/circuits/${c.slug}`}
              className="group bg-white border border-sand-200 rounded-lg overflow-hidden hover:border-terracotta-300 transition-colors"
            >
              <div className="aspect-[5/3] bg-sand-200 relative overflow-hidden">
                {c.hero_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.hero_image_url}
                    alt={c.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <Badge tone="accent">{labelForCategory(c.category)}</Badge>
                  <span className="text-xs text-sand-600">
                    {c.duration_days > 1
                      ? `${c.duration_days} jours`
                      : c.duration_hours
                        ? `${c.duration_hours} h`
                        : "1 jour"}
                  </span>
                </div>
                <h3 className="font-display text-xl text-ink mb-2 leading-snug">
                  {c.title}
                </h3>
                <p className="text-sm text-sand-700 line-clamp-2 mb-4">
                  {c.short_description}
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-sand-600">À partir de</span>
                  <span className="font-display text-2xl text-terracotta-600 tabular-nums">
                    {formatMAD(c.base_price_mad)}
                  </span>
                </div>
              </div>
            </Link>
          )) || (
            <p className="text-sand-700 col-span-2">
              Aucun circuit pour le moment. Allez en créer dans l&apos;espace admin.
            </p>
          )}
        </div>
      </section>

      <footer className="border-t border-sand-200 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-10 text-sm text-sand-700 flex flex-col md:flex-row justify-between gap-4">
          <p>© 2026 Agadir Tourisme · Une création Bright Strategy</p>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-ink">CGV</Link>
            <Link href="/" className="hover:text-ink">Mentions légales</Link>
            <Link href="/" className="hover:text-ink">Contact</Link>
          </div>
        </div>
      </footer>
    </>
  );
}

function labelForCategory(cat: string) {
  return { circuit: "Circuit", excursion: "Excursion", transfert: "Transfert", sejour: "Séjour" }[cat] || cat;
}

```

## `app/login/page.tsx`

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  async function signIn(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const nextPath = (formData.get("next") as string) || "/";

    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      redirect(`/login?error=${encodeURIComponent(authError.message)}`);
    }
    redirect(nextPath);
  }

  return (
    <main className="min-h-screen bg-sand-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-baseline gap-2">
            <span className="font-display text-3xl text-ink">Agadir</span>
            <span className="text-xs uppercase tracking-[0.2em] text-terracotta-600 font-medium">
              Tourisme
            </span>
          </Link>
        </div>

        <div className="bg-white border border-sand-200 rounded-lg p-8">
          <h1 className="font-display text-2xl text-ink mb-2">Connexion</h1>
          <p className="text-sm text-sand-700 mb-6">
            Accédez à votre espace client ou admin.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={signIn} className="space-y-4">
            <input type="hidden" name="next" value={next || "/"} />
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" size="lg">
              Se connecter
            </Button>
          </form>

          <p className="text-sm text-sand-700 mt-6 text-center">
            Pas encore de compte ?{" "}
            <Link
              href="/signup"
              className="text-terracotta-600 hover:text-terracotta-700 font-medium"
            >
              Créez-en un
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

```

## `app/signup/page.tsx`

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  async function signUp(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("full_name") as string;

    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (authError) {
      redirect(`/signup?error=${encodeURIComponent(authError.message)}`);
    }
    redirect("/signup?success=1");
  }

  return (
    <main className="min-h-screen bg-sand-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-baseline gap-2">
            <span className="font-display text-3xl text-ink">Agadir</span>
            <span className="text-xs uppercase tracking-[0.2em] text-terracotta-600 font-medium">
              Tourisme
            </span>
          </Link>
        </div>

        <div className="bg-white border border-sand-200 rounded-lg p-8">
          <h1 className="font-display text-2xl text-ink mb-2">Créer un compte</h1>
          <p className="text-sm text-sand-700 mb-6">
            Accédez à vos réservations et préparez vos prochaines escapades.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
              {decodeURIComponent(error)}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
              Compte créé. Vérifiez votre boîte mail pour confirmer.
            </div>
          )}

          <form action={signUp} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Nom complet</Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                required
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-sand-600 mt-1">8 caractères minimum.</p>
            </div>
            <Button type="submit" className="w-full" size="lg">
              Créer mon compte
            </Button>
          </form>

          <p className="text-sm text-sand-700 mt-6 text-center">
            Déjà inscrit ?{" "}
            <Link
              href="/login"
              className="text-terracotta-600 hover:text-terracotta-700 font-medium"
            >
              Connectez-vous
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

```

## `app/auth/callback/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Auth%20failed`);
}

```

## `app/auth/signout/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}

```

## `app/circuits/page.tsx`

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PublicHeader } from "@/components/public-header";
import { Badge } from "@/components/ui/card";
import { formatMAD } from "@/lib/utils";
import type { Circuit, CircuitCategory } from "@/lib/types";

const CATEGORY_LABELS: Record<CircuitCategory | "all", string> = {
  all: "Tout",
  circuit: "Circuits",
  excursion: "Excursions",
  transfert: "Transferts",
  sejour: "Séjours",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("circuits")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data: circuits } = await query;
  const activeCategory = (category as CircuitCategory) || "all";

  return (
    <>
      <PublicHeader />

      <section className="border-b border-sand-200 bg-sand-50">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <p className="eyebrow mb-3">Notre catalogue</p>
          <h1 className="font-display text-5xl text-ink mb-4">
            Trouvez votre prochain départ
          </h1>
          <p className="text-lg text-sand-800 max-w-2xl">
            De la balade en souk au trek dans l&apos;Atlas, en passant par les transferts depuis l&apos;aéroport Al Massira.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-10">
        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => (
            <Link
              key={cat}
              href={cat === "all" ? "/circuits" : `/circuits?category=${cat}`}
              className={
                activeCategory === cat
                  ? "px-4 py-2 rounded-full bg-terracotta-600 text-white text-sm font-medium"
                  : "px-4 py-2 rounded-full bg-white border border-sand-300 text-sand-800 text-sm hover:border-terracotta-300 hover:text-terracotta-700 transition-colors"
              }
            >
              {CATEGORY_LABELS[cat]}
            </Link>
          ))}
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(circuits as Circuit[] | null)?.map((c) => (
            <Link
              key={c.id}
              href={`/circuits/${c.slug}`}
              className="group bg-white border border-sand-200 rounded-lg overflow-hidden hover:border-terracotta-300 transition-colors"
            >
              <div className="aspect-[5/3] bg-sand-200 relative overflow-hidden">
                {c.hero_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.hero_image_url}
                    alt={c.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <Badge tone="accent">{CATEGORY_LABELS[c.category]}</Badge>
                  <span className="text-xs text-sand-600">
                    {c.duration_days > 1
                      ? `${c.duration_days} jours`
                      : c.duration_hours
                        ? `${c.duration_hours} h`
                        : "1 jour"}
                  </span>
                </div>
                <h3 className="font-display text-xl text-ink mb-2 leading-snug">
                  {c.title}
                </h3>
                <p className="text-sm text-sand-700 line-clamp-2 mb-4">
                  {c.short_description}
                </p>
                <div className="flex items-baseline justify-between pt-3 border-t border-sand-200">
                  <span className="text-xs text-sand-600">À partir de</span>
                  <span className="font-display text-xl text-terracotta-600 tabular-nums">
                    {formatMAD(c.base_price_mad)}
                  </span>
                </div>
              </div>
            </Link>
          )) || null}
        </div>

        {(!circuits || circuits.length === 0) && (
          <div className="text-center py-20 text-sand-700">
            Aucun résultat pour cette catégorie.
          </div>
        )}
      </section>
    </>
  );
}

```

## `app/circuits/[slug]/page.tsx`

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { formatMAD } from "@/lib/utils";
import { Check, X, MapPin, Clock, Users } from "lucide-react";
import type { Circuit, ItineraryDay } from "@/lib/types";

const CATEGORY_LABEL: Record<string, string> = {
  circuit: "Circuit",
  excursion: "Excursion",
  transfert: "Transfert",
  sejour: "Séjour",
};

export default async function CircuitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ booked?: string; ref?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { booked, ref, error } = await searchParams;

  const supabase = await createClient();
  const { data: circuit } = await supabase
    .from("circuits")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!circuit) notFound();

  const c = circuit as Circuit;

  async function createReservation(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adults = parseInt(formData.get("adults") as string, 10) || 1;
    const children = parseInt(formData.get("children") as string, 10) || 0;
    const departureDate = formData.get("departure_date") as string;

    const total =
      adults * Number(c.base_price_mad) +
      children * Number(c.child_price_mad ?? c.base_price_mad);

    const payload: any = {
      circuit_id: c.id,
      departure_date: departureDate,
      adults,
      children,
      total_amount_mad: total,
      status: "pending",
    };

    if (user) {
      payload.client_id = user.id;
    } else {
      payload.guest_full_name = formData.get("full_name") as string;
      payload.guest_email = formData.get("email") as string;
      payload.guest_phone = formData.get("phone") as string;
    }

    const { data, error: insertError } = await supabase
      .from("reservations")
      .insert(payload)
      .select("reference")
      .single();

    if (insertError) {
      redirect(`/circuits/${slug}?error=${encodeURIComponent(insertError.message)}`);
    }
    redirect(`/circuits/${slug}?booked=1&ref=${data.reference}`);
  }

  return (
    <>
      <PublicHeader />

      {/* Hero image */}
      <section className="relative h-[55vh] min-h-[400px] bg-sand-200 overflow-hidden border-b border-sand-200">
        {c.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.hero_image_url}
            alt={c.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 max-w-6xl mx-auto px-6 pb-10">
          <Badge tone="accent" className="mb-3">
            {CATEGORY_LABEL[c.category] ?? c.category}
          </Badge>
          <h1 className="font-display text-4xl md:text-6xl text-white leading-[1.1] max-w-3xl">
            {c.title}
          </h1>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12 grid lg:grid-cols-3 gap-10">
        {/* Left: content */}
        <div className="lg:col-span-2 space-y-10">
          <div className="flex flex-wrap gap-6 text-sm text-sand-800">
            <span className="inline-flex items-center gap-2">
              <Clock className="size-4 text-terracotta-600" />
              {c.duration_days > 1
                ? `${c.duration_days} jours`
                : c.duration_hours
                  ? `${c.duration_hours} heures`
                  : "1 jour"}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="size-4 text-terracotta-600" />
              {c.max_participants} participants max
            </span>
            {c.meeting_point && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-terracotta-600" />
                {c.meeting_point}
              </span>
            )}
          </div>

          {c.description && (
            <section>
              <h2 className="font-display text-2xl text-ink mb-3">À propos</h2>
              <p className="text-ink leading-relaxed whitespace-pre-line">
                {c.description}
              </p>
            </section>
          )}

          {c.itinerary && Array.isArray(c.itinerary) && c.itinerary.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-ink mb-4">Itinéraire</h2>
              <ol className="space-y-4">
                {(c.itinerary as ItineraryDay[]).map((day) => (
                  <li key={day.day} className="flex gap-4">
                    <div className="shrink-0 size-10 rounded-full bg-terracotta-100 text-terracotta-700 flex items-center justify-center font-display text-lg">
                      {day.day}
                    </div>
                    <div className="flex-1 pt-1">
                      <h3 className="font-display text-lg text-ink mb-1">
                        {day.title}
                      </h3>
                      <p className="text-sm text-sand-800 leading-relaxed">
                        {day.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            {c.included && c.included.length > 0 && (
              <section>
                <h3 className="font-display text-lg text-ink mb-3">Inclus</h3>
                <ul className="space-y-1.5 text-sm text-ink">
                  {c.included.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {c.excluded && c.excluded.length > 0 && (
              <section>
                <h3 className="font-display text-lg text-ink mb-3">Non inclus</h3>
                <ul className="space-y-1.5 text-sm text-ink">
                  {c.excluded.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <X className="size-4 text-sand-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {/* Right: booking form */}
        <aside className="lg:col-span-1">
          <div className="bg-white border border-sand-200 rounded-lg p-6 sticky top-24">
            <div className="mb-5 pb-5 border-b border-sand-200">
              <div className="text-xs text-sand-600 mb-1">À partir de</div>
              <div className="font-display text-3xl text-terracotta-600 tabular-nums">
                {formatMAD(c.base_price_mad)}
                <span className="text-sm text-sand-700 font-sans ml-1">
                  / adulte
                </span>
              </div>
              {c.child_price_mad && (
                <div className="text-sm text-sand-700 mt-1">
                  Enfant : {formatMAD(c.child_price_mad)}
                </div>
              )}
            </div>

            {booked && (
              <div className="mb-5 p-4 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
                <strong>Réservation enregistrée !</strong>
                <div className="mt-1">
                  Référence :{" "}
                  <span className="font-mono">{ref}</span>
                </div>
                <div className="mt-1 text-emerald-800">
                  Vous recevrez un email de confirmation sous peu.
                </div>
              </div>
            )}

            {error && (
              <div className="mb-5 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
                {decodeURIComponent(error)}
              </div>
            )}

            <form action={createReservation} className="space-y-4">
              <div>
                <Label htmlFor="departure_date">Date de départ</Label>
                <Input
                  id="departure_date"
                  name="departure_date"
                  type="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="adults">Adultes</Label>
                  <Input
                    id="adults"
                    name="adults"
                    type="number"
                    min="1"
                    defaultValue="1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="children">Enfants</Label>
                  <Input
                    id="children"
                    name="children"
                    type="number"
                    min="0"
                    defaultValue="0"
                  />
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-sand-200 space-y-3">
                <p className="text-xs text-sand-600">
                  Vous n&apos;avez pas de compte ? Réservez en invité :
                </p>
                <div>
                  <Label htmlFor="full_name">Nom complet</Label>
                  <Input id="full_name" name="full_name" type="text" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" name="phone" type="tel" />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg">
                Réserver
              </Button>
              <p className="text-xs text-center text-sand-600">
                Un email de confirmation vous sera envoyé.{" "}
                <Link href="/login" className="text-terracotta-600 hover:underline">
                  Connectez-vous
                </Link>{" "}
                pour suivre vos réservations.
              </p>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}

```

## `app/admin/layout.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already enforces staff access; this just gets the email for display
  return (
    <div className="flex bg-sand-50 min-h-screen">
      <AdminSidebar userEmail={user?.email} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

```

## `app/admin/page.tsx`

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMAD, formatDateShort } from "@/lib/utils";
import { Plus, ArrowRight } from "lucide-react";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ count: reservationsCount }, { count: circuitsCount }, { count: clientsCount }, { data: recentReservations }] =
    await Promise.all([
      supabase.from("reservations").select("*", { count: "exact", head: true }),
      supabase
        .from("circuits")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "client"),
      supabase
        .from("reservations")
        .select("*, circuits(title, slug)")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  // Sum total revenue from paid reservations
  const { data: revenueData } = await supabase
    .from("reservations")
    .select("total_amount_mad")
    .in("status", ["paid", "completed"]);
  const totalRevenue =
    revenueData?.reduce((sum, r) => sum + Number(r.total_amount_mad), 0) ?? 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Vue d&apos;ensemble</p>
          <h1 className="font-display text-3xl text-ink">Tableau de bord</h1>
        </div>
        <Link href="/admin/circuits/new">
          <Button>
            <Plus className="size-4" />
            Nouveau circuit
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Réservations"
          value={reservationsCount ?? 0}
          href="/admin/reservations"
        />
        <StatCard
          label="Circuits actifs"
          value={circuitsCount ?? 0}
          href="/admin/circuits"
        />
        <StatCard
          label="Clients inscrits"
          value={clientsCount ?? 0}
          href="/admin/clients"
        />
        <StatCard
          label="Revenu encaissé"
          value={formatMAD(totalRevenue)}
          accent
        />
      </div>

      {/* Recent reservations */}
      <Card>
        <div className="px-5 py-4 border-b border-sand-200 flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">
            Réservations récentes
          </h2>
          <Link
            href="/admin/reservations"
            className="text-sm text-terracotta-600 hover:text-terracotta-700 inline-flex items-center gap-1"
          >
            Tout voir <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {recentReservations && recentReservations.length > 0 ? (
          <div className="divide-y divide-sand-200">
            {recentReservations.map((r) => (
              <div
                key={r.id}
                className="px-5 py-4 flex items-center justify-between hover:bg-sand-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-sand-800">
                      {r.reference}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-sm text-ink truncate">
                    {(r as any).circuits?.title ?? "—"}
                  </div>
                  <div className="text-xs text-sand-600">
                    {r.guest_full_name ?? "Client enregistré"} ·{" "}
                    {formatDateShort(r.departure_date)} · {r.adults} adulte
                    {r.adults > 1 ? "s" : ""}
                    {r.children > 0 ? `, ${r.children} enfant${r.children > 1 ? "s" : ""}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="font-display text-lg text-terracotta-600 tabular-nums">
                    {formatMAD(r.total_amount_mad)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <CardBody>
            <p className="text-sm text-sand-700">
              Pas encore de réservation. Quand un client réservera un circuit
              depuis le site public, vous le verrez ici.
            </p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: string | number;
  href?: string;
  accent?: boolean;
}) {
  const Wrapper = href ? Link : "div";
  return (
    <Wrapper
      href={href as string}
      className={
        href
          ? "block bg-white border border-sand-200 rounded-lg p-5 hover:border-terracotta-300 transition-colors"
          : "bg-white border border-sand-200 rounded-lg p-5"
      }
    >
      <div className="text-xs uppercase tracking-wide text-sand-600 mb-2">
        {label}
      </div>
      <div
        className={
          accent
            ? "font-display text-3xl text-terracotta-600 tabular-nums"
            : "font-display text-3xl text-ink tabular-nums"
        }
      >
        {value}
      </div>
    </Wrapper>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { tone: any; label: string }> = {
    pending: { tone: "warning", label: "En attente" },
    confirmed: { tone: "info", label: "Confirmée" },
    paid: { tone: "success", label: "Payée" },
    cancelled: { tone: "danger", label: "Annulée" },
    completed: { tone: "neutral", label: "Terminée" },
  };
  const c = config[status] ?? { tone: "neutral", label: status };
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

```

## `app/admin/circuits/page.tsx`

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { formatMAD } from "@/lib/utils";
import { Plus, Pencil } from "lucide-react";

export default async function AdminCircuitsPage() {
  const supabase = await createClient();
  const { data: circuits } = await supabase
    .from("circuits")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Module 2 — Catalogue</p>
          <h1 className="font-display text-3xl text-ink">Circuits & excursions</h1>
        </div>
        <Link href="/admin/circuits/new">
          <Button>
            <Plus className="size-4" />
            Nouveau circuit
          </Button>
        </Link>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Titre</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Catégorie</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Durée</th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">Prix</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Statut</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {circuits && circuits.length > 0 ? (
              circuits.map((c) => (
                <tr key={c.id} className="hover:bg-sand-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-medium text-ink">{c.title}</div>
                    <div className="text-xs text-sand-600 font-mono">{c.slug}</div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone="accent">
                      {labelForCategory(c.category)}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-sand-800">
                    {c.duration_days > 1
                      ? `${c.duration_days} jours`
                      : c.duration_hours
                        ? `${c.duration_hours} h`
                        : "1 jour"}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {formatMAD(c.base_price_mad)}
                  </td>
                  <td className="px-5 py-4">
                    {c.is_active ? (
                      <Badge tone="success">Actif</Badge>
                    ) : (
                      <Badge tone="neutral">Inactif</Badge>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/circuits/${c.id}`}
                      className="inline-flex items-center gap-1 text-sm text-terracotta-600 hover:text-terracotta-700"
                    >
                      <Pencil className="size-3.5" />
                      Modifier
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sand-700">
                  Aucun circuit. Créez-en un pour commencer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function labelForCategory(cat: string) {
  return (
    { circuit: "Circuit", excursion: "Excursion", transfert: "Transfert", sejour: "Séjour" }[cat] || cat
  );
}

```

## `app/admin/circuits/new/page.tsx`

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

export default function NewCircuitPage() {
  async function createCircuit(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const slug = (formData.get("slug") as string).trim().toLowerCase();
    const payload = {
      slug,
      title: formData.get("title") as string,
      category: formData.get("category") as string,
      short_description: formData.get("short_description") as string,
      description: formData.get("description") as string,
      duration_days: parseInt(formData.get("duration_days") as string, 10) || 1,
      duration_hours: formData.get("duration_hours")
        ? parseInt(formData.get("duration_hours") as string, 10)
        : null,
      base_price_mad: parseFloat(formData.get("base_price_mad") as string),
      child_price_mad: formData.get("child_price_mad")
        ? parseFloat(formData.get("child_price_mad") as string)
        : null,
      max_participants:
        parseInt(formData.get("max_participants") as string, 10) || 20,
      meeting_point: formData.get("meeting_point") as string,
      hero_image_url: formData.get("hero_image_url") as string,
      is_active: formData.get("is_active") === "on",
    };

    const { error } = await supabase.from("circuits").insert(payload);
    if (error) {
      // In production: surface the error properly via redirect or form state
      throw new Error(error.message);
    }
    redirect("/admin/circuits");
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/admin/circuits"
        className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4"
      >
        <ArrowLeft className="size-4" /> Retour au catalogue
      </Link>

      <div className="mb-8">
        <p className="eyebrow mb-2">Module 2 — Catalogue</p>
        <h1 className="font-display text-3xl text-ink">Nouveau circuit</h1>
      </div>

      <form action={createCircuit} className="bg-white border border-sand-200 rounded-lg p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" required placeholder="Paradise Valley & Tafraout" />
          </div>
          <div>
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              name="slug"
              required
              pattern="[a-z0-9\-]+"
              placeholder="paradise-valley-tafraout"
            />
          </div>
          <div>
            <Label htmlFor="category">Catégorie</Label>
            <Select id="category" name="category" required defaultValue="circuit">
              <option value="circuit">Circuit</option>
              <option value="excursion">Excursion</option>
              <option value="transfert">Transfert</option>
              <option value="sejour">Séjour</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="short_description">Description courte</Label>
          <Input
            id="short_description"
            name="short_description"
            placeholder="Une phrase qui donne envie."
          />
        </div>

        <div>
          <Label htmlFor="description">Description longue</Label>
          <Textarea id="description" name="description" rows={5} />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="duration_days">Durée (jours)</Label>
            <Input
              id="duration_days"
              name="duration_days"
              type="number"
              min="1"
              defaultValue="1"
              required
            />
          </div>
          <div>
            <Label htmlFor="duration_hours">Ou durée (heures)</Label>
            <Input
              id="duration_hours"
              name="duration_hours"
              type="number"
              min="1"
              placeholder="Pour les excursions"
            />
          </div>
          <div>
            <Label htmlFor="max_participants">Max participants</Label>
            <Input
              id="max_participants"
              name="max_participants"
              type="number"
              min="1"
              defaultValue="20"
              required
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="base_price_mad">Prix adulte (MAD)</Label>
            <Input
              id="base_price_mad"
              name="base_price_mad"
              type="number"
              min="0"
              step="0.01"
              required
            />
          </div>
          <div>
            <Label htmlFor="child_price_mad">Prix enfant (MAD)</Label>
            <Input
              id="child_price_mad"
              name="child_price_mad"
              type="number"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="meeting_point">Point de rendez-vous</Label>
          <Input
            id="meeting_point"
            name="meeting_point"
            placeholder="Bureau Bright Strategy, Boulevard du 20 Août, Agadir"
          />
        </div>

        <div>
          <Label htmlFor="hero_image_url">URL image principale</Label>
          <Input
            id="hero_image_url"
            name="hero_image_url"
            type="url"
            placeholder="https://images.unsplash.com/..."
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked
            className="size-4 rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500"
          />
          <span className="text-sm text-ink">
            Actif (visible sur le site public)
          </span>
        </label>

        <div className="flex justify-end gap-3 pt-2 border-t border-sand-200">
          <Link href="/admin/circuits">
            <Button type="button" variant="secondary">
              Annuler
            </Button>
          </Link>
          <Button type="submit">Créer le circuit</Button>
        </div>
      </form>
    </div>
  );
}

```

## `app/admin/circuits/[id]/page.tsx`

```tsx
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ArrowLeft, Trash2 } from "lucide-react";

export default async function EditCircuitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: circuit } = await supabase
    .from("circuits")
    .select("*")
    .eq("id", id)
    .single();

  if (!circuit) notFound();

  async function updateCircuit(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const payload = {
      title: formData.get("title") as string,
      slug: (formData.get("slug") as string).trim().toLowerCase(),
      category: formData.get("category") as string,
      short_description: formData.get("short_description") as string,
      description: formData.get("description") as string,
      duration_days: parseInt(formData.get("duration_days") as string, 10) || 1,
      duration_hours: formData.get("duration_hours")
        ? parseInt(formData.get("duration_hours") as string, 10)
        : null,
      base_price_mad: parseFloat(formData.get("base_price_mad") as string),
      child_price_mad: formData.get("child_price_mad")
        ? parseFloat(formData.get("child_price_mad") as string)
        : null,
      max_participants:
        parseInt(formData.get("max_participants") as string, 10) || 20,
      meeting_point: formData.get("meeting_point") as string,
      hero_image_url: formData.get("hero_image_url") as string,
      is_active: formData.get("is_active") === "on",
    };

    const { error } = await supabase.from("circuits").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    redirect("/admin/circuits");
  }

  async function deleteCircuit() {
    "use server";
    const supabase = await createClient();
    await supabase.from("circuits").delete().eq("id", id);
    redirect("/admin/circuits");
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/admin/circuits"
        className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4"
      >
        <ArrowLeft className="size-4" /> Retour au catalogue
      </Link>

      <div className="mb-8">
        <p className="eyebrow mb-2">Module 2 — Catalogue</p>
        <h1 className="font-display text-3xl text-ink">Modifier le circuit</h1>
      </div>

      <form action={updateCircuit} className="bg-white border border-sand-200 rounded-lg p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" required defaultValue={circuit.title} />
          </div>
          <div>
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              name="slug"
              required
              pattern="[a-z0-9\-]+"
              defaultValue={circuit.slug}
            />
          </div>
          <div>
            <Label htmlFor="category">Catégorie</Label>
            <Select id="category" name="category" required defaultValue={circuit.category}>
              <option value="circuit">Circuit</option>
              <option value="excursion">Excursion</option>
              <option value="transfert">Transfert</option>
              <option value="sejour">Séjour</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="short_description">Description courte</Label>
          <Input
            id="short_description"
            name="short_description"
            defaultValue={circuit.short_description || ""}
          />
        </div>

        <div>
          <Label htmlFor="description">Description longue</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={circuit.description || ""}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="duration_days">Durée (jours)</Label>
            <Input
              id="duration_days"
              name="duration_days"
              type="number"
              min="1"
              defaultValue={circuit.duration_days}
              required
            />
          </div>
          <div>
            <Label htmlFor="duration_hours">Ou durée (heures)</Label>
            <Input
              id="duration_hours"
              name="duration_hours"
              type="number"
              min="1"
              defaultValue={circuit.duration_hours ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="max_participants">Max participants</Label>
            <Input
              id="max_participants"
              name="max_participants"
              type="number"
              min="1"
              defaultValue={circuit.max_participants}
              required
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="base_price_mad">Prix adulte (MAD)</Label>
            <Input
              id="base_price_mad"
              name="base_price_mad"
              type="number"
              min="0"
              step="0.01"
              defaultValue={circuit.base_price_mad}
              required
            />
          </div>
          <div>
            <Label htmlFor="child_price_mad">Prix enfant (MAD)</Label>
            <Input
              id="child_price_mad"
              name="child_price_mad"
              type="number"
              min="0"
              step="0.01"
              defaultValue={circuit.child_price_mad ?? ""}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="meeting_point">Point de rendez-vous</Label>
          <Input
            id="meeting_point"
            name="meeting_point"
            defaultValue={circuit.meeting_point || ""}
          />
        </div>

        <div>
          <Label htmlFor="hero_image_url">URL image principale</Label>
          <Input
            id="hero_image_url"
            name="hero_image_url"
            type="url"
            defaultValue={circuit.hero_image_url || ""}
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={circuit.is_active}
            className="size-4 rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500"
          />
          <span className="text-sm text-ink">
            Actif (visible sur le site public)
          </span>
        </label>

        <div className="flex justify-end items-center gap-3 pt-2 border-t border-sand-200">
          <Link href="/admin/circuits">
            <Button type="button" variant="secondary">
              Annuler
            </Button>
          </Link>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>

      <form action={deleteCircuit} className="mt-6 bg-white border border-red-200 rounded-lg p-6 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-ink">Zone de danger</h3>
          <p className="text-sm text-sand-700">
            La suppression est définitive et entraînera l&apos;échec des réservations associées.
          </p>
        </div>
        <Button type="submit" variant="danger" size="sm">
          <Trash2 className="size-3.5" />
          Supprimer
        </Button>
      </form>
    </div>
  );
}

```

## `app/admin/reservations/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/card";
import { formatMAD, formatDateShort } from "@/lib/utils";

export default async function AdminReservationsPage() {
  const supabase = await createClient();
  const { data: reservations } = await supabase
    .from("reservations")
    .select("*, circuits(title, slug, category)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="eyebrow mb-2">Module 1 — Réservations</p>
        <h1 className="font-display text-3xl text-ink">Dossiers de réservation</h1>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Référence</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Circuit</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Client</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Départ</th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">Pax</th>
              <th className="text-right px-5 py-3 font-medium text-sand-800">Total</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {reservations && reservations.length > 0 ? (
              reservations.map((r) => (
                <tr key={r.id} className="hover:bg-sand-50 transition-colors">
                  <td className="px-5 py-4 font-mono text-sm">{r.reference}</td>
                  <td className="px-5 py-4">
                    <div className="text-ink">{(r as any).circuits?.title ?? "—"}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-ink">
                      {r.guest_full_name ?? "Client enregistré"}
                    </div>
                    {r.guest_email && (
                      <div className="text-xs text-sand-600">{r.guest_email}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sand-800">
                    {formatDateShort(r.departure_date)}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {r.adults + r.children}
                    <span className="text-xs text-sand-600 ml-1">
                      ({r.adults}A
                      {r.children > 0 ? `/${r.children}E` : ""})
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums font-medium">
                    {formatMAD(r.total_amount_mad)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sand-700">
                  Aucune réservation pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { tone: any; label: string }> = {
    pending: { tone: "warning", label: "En attente" },
    confirmed: { tone: "info", label: "Confirmée" },
    paid: { tone: "success", label: "Payée" },
    cancelled: { tone: "danger", label: "Annulée" },
    completed: { tone: "neutral", label: "Terminée" },
  };
  const c = config[status] ?? { tone: "neutral", label: status };
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

```

## `app/admin/clients/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { formatDateShort } from "@/lib/utils";
import { Badge } from "@/components/ui/card";

export default async function AdminClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="eyebrow mb-2">Module 3 — Base clients</p>
        <h1 className="font-display text-3xl text-ink">Clients</h1>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Nom</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Email</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Téléphone</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Rôle</th>
              <th className="text-left px-5 py-3 font-medium text-sand-800">Inscrit le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {clients && clients.length > 0 ? (
              clients.map((c) => (
                <tr key={c.id} className="hover:bg-sand-50">
                  <td className="px-5 py-4 text-ink">{c.full_name ?? "—"}</td>
                  <td className="px-5 py-4 text-sand-800">{c.email}</td>
                  <td className="px-5 py-4 text-sand-800">{c.phone ?? "—"}</td>
                  <td className="px-5 py-4">
                    <Badge tone="info">{c.role}</Badge>
                  </td>
                  <td className="px-5 py-4 text-sand-800">
                    {formatDateShort(c.created_at)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sand-700">
                  Aucun client inscrit pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

```

---

# ✅ Checklist post-installation

- [ ] `npm install` terminé sans erreur
- [ ] Projet Supabase créé et URL + anon key dans `.env.local`
- [ ] Migration SQL exécutée (4 circuits de test visibles dans `select * from circuits;`)
- [ ] `npm run dev` lance http://localhost:3000 sans erreur
- [ ] Homepage affiche les 4 circuits de démo
- [ ] `/signup` permet de créer un compte
- [ ] Après promotion en admin via SQL, `/admin` est accessible
- [ ] Une réservation depuis `/circuits/paradise-valley-tafraout` apparaît bien dans `/admin/reservations`

# 🚀 Roadmap V2 (à coder ensuite)

Une fois le MVP en main, voici les prochains modules à attaquer dans l'ordre :

1. **Module 4 — Facturation & paiements**
   - Génération de factures PDF (lib `pdfme` ou `react-pdf`)
   - Intégration CMI Maroc (le point dur — prévoir 1-2 semaines)
   - Intégration Stripe pour les paiements internationaux
   - Gestion des acomptes (30%/solde) avec relances automatiques

2. **Module 1 (complétion) — Réservations avancées**
   - Calendrier de disponibilité par circuit
   - Liste d'attente automatique
   - Manifestes passagers PDF
   - Affectation guides/véhicules avec détection conflits

3. **Module 5 — Logistique RH**
   - Planning guides & chauffeurs
   - Parc véhicules + entretien préventif
   - Suivi GPS transferts aéroport

4. **Module 6 — Reporting BI**
   - Dashboard commercial avec KPIs avancés (recharts)
   - Analyse de rentabilité par prestation
   - Export PDF/Excel

5. **Module 7 — Marketing**
   - Campagnes email automatisées (Resend + React Email)
   - Intégration WhatsApp Business API
   - Gestion des avis clients
