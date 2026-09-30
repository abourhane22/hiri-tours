# Hiri Tours — contexte projet

Plateforme intégrée de l'agence touristique **Hiri Tours** (Agadir, Maroc), développée par Bright Strategy.
Vitrine publique, tunnel de réservation et paiement, backoffice complet (ventes, catalogue, achats,
exploitation, finance). En production. Interface et messages **en français**.

---

## Stack

- **Next.js 16** (App Router) — `package.json` : `next ^16.2.6` ; le middleware apparaît au build comme « Proxy ».
  Conventions héritées de Next 15 toujours appliquées : **`await params` / `await searchParams`**.
- **React 19**, **TypeScript** strict, alias `@/*`.
- **Supabase** : PostgreSQL + RLS + Auth, via `@supabase/ssr`.
  - `createClient()` (`lib/supabase/server.ts`) : session utilisateur (cookies) — **par défaut** pour lire et écrire au backoffice.
  - `createAdminClient()` (`lib/supabase/admin.ts`) : service_role, serveur uniquement (tunnel public, webhooks, crons).
- **Tailwind CSS 3.4**, `lucide-react`, `recharts`, `leaflet`, `flag-icons`.
- **Vercel** : crons `vercel.json` — `/api/keep-alive` 06:00, `/api/complete-departed` 06:30, `/api/release-allotments` 07:00.
- Paiement : **Stripe** et **Attijari Payment** ; emails **Resend** ; distribution aérienne **Duffel** (API REST v2, mode test).

### Commandes

```bash
npx tsc --noEmit -p .                              # typecheck
npm run build                                      # build de production (lint inclus)
npx tsx scripts/check-pricing-parity.mjs           # non-régression des prix
npx tsx scripts/check-purchase-rate-resolution.mjs # non-régression des tarifs d'achat
```

Avant tout commit : typecheck + build au vert. Messages de commit en français, préfixes `feat(…)`, `fix(…)`, `chore(…)`.

---

## Design system — backoffice (`/admin`)

Les écrans actuels utilisent des **valeurs hexadécimales** (classes arbitraires `text-[#…]` / `style`), pas les palettes
Tailwind `sand` / `terracotta` / `atlantic` de `tailwind.config.ts` (héritées du scaffold, teintes différentes :
`terracotta-600` = `#C2410C` ≠ `#C84B31`). Tout nouveau code suit les valeurs ci-dessous.

### Couleurs de référence

| Rôle | Valeur |
|---|---|
| Navy — texte principal, boutons primaires, sidebar | `#1A1F2E` (survol `#232939`, actif / hover bouton `#2A3142`) |
| Terracotta — accent, eyebrow, pastilles, liens au survol | `#C84B31` |
| Sand — fonds de survol | `#FAF5F0` |
| Ocean — liens secondaires, informations | `#0C6B8A` |
| Ambre — avertissements, acomptes | `#D98324` |

Neutres et états récurrents :

- Bordures `#E5E0D7` / `#E0DACF` (champs) · séparateurs `#EEE9E0`, `#F1EDE5` · en-têtes de tableau `#FBF9F5`.
- Textes secondaires `#58524A` (libellés), `#6B6862`, `#968F84` (discret).
- Succès `#E1F5EE` / `#085041` (`#0F6E56`) · Erreur `#FCEBEB` / `#791F1F` (bordure `#F7C1C1`) ·
  Alerte `#FFF4E0` / `#7A4B00` (bordure `#EF9F27`) · Info `#E6F1FB` / `#0C447C` · Neutre `#F1EFE8` / `#58524A`.

### Typographie

- **Fraunces** (`font-display`, variable `--font-fraunces`) pour les titres et les grands chiffres — `letter-spacing: -0.02em`.
- **Manrope** (`font-sans`, variable `--font-manrope`) pour le texte.
- Chiffres alignés : `tabular-nums`. Références (dossier, facture, avoir) en `font-mono`.

### Composants et motifs récurrents

- **En-tête de page** : eyebrow `text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium`
  (« Ventes · Dossier de réservation »), puis `h1` `font-display text-3xl text-[#1A1F2E]`, puis une ligne `text-[12px]`/`[13px]` `#6B6862`.
  Classe utilitaire `.eyebrow` dans `app/globals.css` pour les écrans plus anciens.
- **`InfoCard`** (fiche dossier, `app/admin/reservations/[id]/page.tsx`) : carte blanche `border-[#E5E0D7] rounded-xl p-4`,
  libellé en petites capitales `text-[10.5px] tracking-[1.4px] uppercase text-[#968F84]` avec icône 13 px, `headerRight`
  optionnel, prop `anchor` (ancres `#logistique`, `#arrivee`, `#paiements`, `#statut`, `#voyageurs`).
- **`KpiCard`** (`components/kpi-card.tsx`) + `DeltaPill` : libellé petites capitales, valeur `font-display`, sous-ligne.
- **Pills** : `inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-medium` avec un couple fond / texte de la table d'états.
- **Tableaux** : conteneur `bg-white border border-[#E5E0D7] rounded-xl`, `thead` fond `#FBF9F5`,
  `th` `text-[10.5px] tracking-[1px] uppercase font-medium text-[#58524A]`, lignes `divide-[#F1EDE5]`.
- **Boutons** : primaire `bg-[#1A1F2E] text-white hover:bg-[#2A3142] rounded-lg` ; secondaire blanc bordé `#E5E0D7`, survol `#FAF5F0`.
- **Sidebar** (`components/admin-sidebar.tsx`) : fond navy, groupes en petites capitales `#8B92A5`, entrée active `#2A3142` ;
  structure unique dans **`lib/admin-nav.ts`**. Topbar blanche (`components/admin-topbar.tsx`) avec recherche et cloche.
- Bandeaux : `components/ui/alert-banner.tsx` ; erreurs de requête : `components/query-error.tsx`.
- Impression : `print:hidden` sur la navigation et les contrôles ; styles globaux `@media print` dans `app/globals.css`.

### Règles d'interface

- **Aucun liseré coloré à gauche** des items de notification ou de liste : icône dans un carré teinté.
- Couleurs de priorité / d'état distinguables **aussi en luminosité**, contrastes **AA**, cibles tactiles **≥ 44 px** sur les nouveaux écrans.
- Prix via `formatMAD()`, dates via `formatDate()` / `formatDateShort()` (`lib/utils.ts`).
- Dates « métier » (aujourd'hui, J-n, demain 08:00) via **`lib/tz.ts`** (Africa/Casablanca) — jamais `toISOString().slice(0, 10)`.

---

## Identité vitrine — distincte et isolée

- Pages publiques sous `app/(vitrine)/` et chrome du tunnel `app/reserver/layout.tsx`.
- Police **Poppins** (`--font-poppins`), palette **ocean** : `--ocean #0f6d78`, `--ocean-dark #0a4c54`, `--sun #e8894a`,
  `--sand #fbf7f0`, `--ink #1f2a2e` (`app/(vitrine)/vitrine.css`).
- **Isolement** : toutes les règles vivent sous **`.vitrine-scope`** (aplaties par tailwindcss/nesting) pour ne rien
  fuiter vers le backoffice. Ne jamais importer les styles vitrine dans `/admin`, ni l'inverse. Le contenu du tunnel
  `/reserver` reste hors `.vitrine-scope`.

---

## Architecture — autorités uniques

Une règle métier n'a **qu'une** implémentation. Ne jamais la recalculer ailleurs : appeler l'autorité.

| Domaine | Autorité |
|---|---|
| Prix de vente (toutes unités de vente) | `lib/pricing.ts` — `computeLineTotal` |
| Marge (prévisionnelle / réelle) | `lib/margin.ts` (E/S du snapshot : `lib/cost-snapshot.ts`) |
| Coût d'achat (tarifs qui se chevauchent) | `lib/purchasing.ts` — `resolvePurchaseRate` |
| Fidélité (Or / Argent / Bronze) | `lib/loyalty.ts` |
| Profil de dossier (voyageurs requis, logistique, carte spéciale, manifeste) | `lib/dossier-profile.ts` |
| Navigation backoffice | `lib/admin-nav.ts` (permissions : `lib/permissions.ts`) |
| Tâches et informations (cloche, `/admin/actions`) | `lib/notifications.ts` (modèle client-safe : `lib/tasks.ts`) |

Autres références uniques :
- **CA net d'avoirs** : `creditNotesByReservation` (`lib/credit-notes.ts`), nette des imputations de rectification.
- Dates au fuseau de l'agence : `lib/tz.ts`.
- Clients : `lib/customers.ts` (`normalizePhone`, `normalizeEmail`, `SOURCE_LABELS`, `customerDuplicateMessage`).
- Pays : `lib/countries.ts`.
- Distribution aérienne : `lib/duffel.ts` (serveur) / `lib/duffel-types.ts` (client-safe) / `lib/distribution.ts`.
- Factures : `lib/invoices.ts` ; rectification d'avoir : `lib/rectification.ts`.
- Allotements : `lib/allotments.ts`.

Conventions de code : Server Components par défaut, `"use client"` seulement pour l'interactivité ; mutations en
server actions qui **valident puis délèguent** (les transactions sensibles sont des fonctions plpgsql avec verrou
`FOR UPDATE`). Pas de `localStorage` pour l'état métier.

---

## Données et sécurité

- Toute nouvelle table backoffice : RLS activée + policy
  `for all using (public.is_staff()) with check (public.is_staff())`. `is_staff()` = rôles `admin`, `commercial`, `comptable`
  (le rôle `guide` accède au backoffice mais **n'est pas staff**).
- Les server actions appelables depuis le client vérifient la session.
- Données sensibles (passeports des `reservation_travelers`) : jamais lues hors `app/admin`, jamais dans les emails,
  WhatsApp ou le suivi public.
- **Embeds PostgREST** : deux clés étrangères relient `credit_notes` et `invoices` → tout embed entre elles est nommé
  (`invoices!invoice_id(…)`), sinon PGRST201.
- Factures : numéro attribué par trigger (`HT-AAAA-NNNN`, avoirs `AV-AAAA-NNNN`), jamais côté app ; une facture active par
  dossier ; statut `paid` posé par trigger au solde — les factures actives se filtrent par `status in ('issued','paid')`.
- Le schéma de base de `customers`, `company_settings`, `invoices`, `staff_members`, `vehicles`, `expenses` n'est pas
  entièrement versionné (créé dans le SQL Editor) : vérifier en base avant de supposer une colonne ou un index.

---

## Migrations SQL

- **Jamais exécutées par Claude.** Claude propose, l'utilisateur passe le SQL dans le SQL Editor Supabase et renvoie les résultats.
- Présentation en **blocs numérotés**, chacun suivi d'une **requête de vérification** avec les valeurs attendues.
  Un bloc 0 de diagnostic, en lecture seule, précède toute modification incertaine.
- **`ALTER TYPE … ADD VALUE` seul dans sa propre requête**, avant le reste : une valeur d'enum n'est utilisable qu'une fois committée.
- Idempotence : `if not exists`, `create or replace`, `drop … if exists` avant `create policy` / `create trigger`.
- Une fois passés, les blocs sont versionnés dans `supabase/migrations/AAAAMMJJ_nom.sql`, avec l'état en en-tête (passé / à passer).
- Aucun rattrapage de données sans liste préalable en lecture seule et décision humaine.

---

## Principes

- **Documents figés** : factures, avoirs, coût prévisionnel (`cost_snapshot`), taux de change, offre Duffel sont des
  **snapshots** à l'émission. Un document émis ne se modifie jamais ; une correction passe par un avoir, une facture
  rectificative ou un recalcul explicite tracé (`previous[]`).
- **Une erreur de requête s'affiche comme une erreur** (et se logue). `notFound()` uniquement quand la ligne n'existe
  pas (`.maybeSingle()` ; PGRST116). Jamais de liste vide ou de 404 pour masquer une panne.
- **Calculé à la volée plutôt que stocké** quand c'est possible (tâches du centre d'actions, soldes) : une cause
  résolue disparaît partout.
- Vérifier ce qui existe déjà avant de construire, et ne jamais dupliquer une définition métier (tiers, libellés, pays, profils).
- Pour les lots importants : **phase 0 de diagnostic** (constat, SQL proposé, décisions à trancher), puis attendre le go.
- La base de production n'est pas joignable depuis le poste de développement : demander à l'utilisateur d'exécuter
  les requêtes de diagnostic.
