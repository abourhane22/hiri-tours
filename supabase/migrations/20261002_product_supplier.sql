-- ============================================================================
-- Formulaire produit (01/10/2026) — établissement d'un hébergement = fournisseur.
-- ============================================================================
-- Blocs 1, 2 et 3 PASSÉS dans le SQL Editor et vérifiés.
-- Rattrapage réalisé : 4 hébergements rattachés (fournisseurs « Riad Dar Amal » et
-- « Hôtel Taghazout Bay » renommés, « Hôtel la Belle Etoile » et « Hôtel Mogador
-- Essaouira » créés ; Taghazout Bay rattaché via le fournisseur lié par tarif d'achat),
-- property_name aligné sur le nom du fournisseur, sans_etablissement = 0.
-- Seul produit hors matrice d'unités : « Hôtel la Belle Etoile », passé de per_person
-- à per_night_room (1 dossier, montant inchangé).

-- 1. Fournisseur du produit (générique ; obligatoire pour un hébergement)
alter table public.circuits
  add column if not exists supplier_id uuid references public.suppliers(id);
create index if not exists circuits_supplier_idx on public.circuits (supplier_id) where supplier_id is not null;
comment on column public.circuits.supplier_id is
  'Fournisseur du produit (générique). OBLIGATOIRE pour un hébergement : l''établissement. category_fields.property_name en est une copie dérivée (recopiée à chaque enregistrement).';

-- 2. Rattrapage : correspondances sûres (nom identique, un seul candidat hôtel) ;
--    les autres cas ont été tranchés à la main.
update public.circuits c
   set supplier_id = s.id
  from public.suppliers s
 where c.category = 'hebergement'
   and c.supplier_id is null
   and s.supplier_type = 'hotel'
   and lower(btrim(s.name)) = lower(btrim(c.category_fields->>'property_name'))
   and (select count(*) from public.suppliers s2
         where s2.supplier_type = 'hotel'
           and lower(btrim(s2.name)) = lower(btrim(c.category_fields->>'property_name'))) = 1;

-- 3. Garantie en base
alter table public.circuits drop constraint if exists circuits_lodging_supplier_chk;
alter table public.circuits add constraint circuits_lodging_supplier_chk
  check (category <> 'hebergement' or supplier_id is not null);
