-- ============================================================================
-- Refonte des dépenses (01/10/2026) — fournisseur, moyen de paiement, départ
-- concerné, justificatif privé, rattachement principal exclusif.
-- ============================================================================
-- Blocs 1, 3 (version modifiée ci-dessous), 4 (avec image/webp) et 5 PASSÉS dans le
-- SQL Editor le 01/10/2026 et vérifiés. Le bloc 2 (rattrapage) n'a PAS été passé :
-- inutile avec le modèle révisé (aucun cas dossier + produit en base ; les 2 dépenses
-- dossier + véhicule sont légitimes et restent intactes).
--
-- Constat (bloc 0) : expenses / cost_categories conformes ; cost_categories.description
-- existait déjà ; type = enum cost_category_type (direct / overhead) ; RLS active,
-- policies *_staff_all. Combinaisons au 01/10 : aucun rattachement 80 · véhicule seul
-- 107 · produit seul 1 · dossier seul 44 · dossier + véhicule 2.
--
-- MODÈLE : rattachement PRINCIPAL exclusif (dossier XOR produit XOR aucun) ; le
-- véhicule est une dimension OPTIONNELLE indépendante (le plein du minibus pour un
-- départ précis est légitimement dossier + véhicule).


-- 1. Nouvelles colonnes
alter table public.expenses
  add column if not exists supplier_id    uuid references public.suppliers(id),
  add column if not exists payment_method text
       check (payment_method in ('transfer','cash','card','cheque')),  -- virement, espèces, carte, chèque
  add column if not exists departure_date date,
  add column if not exists receipt_path   text;  -- {expense_id}/{fichier} dans le bucket privé expense-receipts

create index if not exists expenses_supplier_idx    on public.expenses (supplier_id);
create index if not exists expenses_date_idx        on public.expenses (expense_date desc);
create index if not exists expenses_circuit_dep_idx on public.expenses (circuit_id, departure_date) where circuit_id is not null;

comment on column public.expenses.departure_date is
  'Dépense produit : départ concerné. Prioritaire pour les « dépenses produit non ventilées » de la carte Marge (sinon expense_date ± 3 j).';


-- 3. Contraintes (version passée : le véhicule n'entre PAS dans l'exclusivité)
alter table public.expenses drop constraint if exists expenses_single_attachment_chk;
alter table public.expenses add constraint expenses_single_attachment_chk
  check (num_nonnulls(reservation_id, circuit_id) <= 1);  -- 0 = véhicule seul ou frais généraux

alter table public.expenses drop constraint if exists expenses_departure_needs_product_chk;
alter table public.expenses add constraint expenses_departure_needs_product_chk
  check (departure_date is null or circuit_id is not null);


-- 4. Bucket PRIVÉ des justificatifs (lecture par URL signée de courte durée)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "expense_receipts_staff_select" on storage.objects;
create policy "expense_receipts_staff_select" on storage.objects
  for select to authenticated using (bucket_id = 'expense-receipts' and public.is_staff());
drop policy if exists "expense_receipts_staff_insert" on storage.objects;
create policy "expense_receipts_staff_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'expense-receipts' and public.is_staff());
drop policy if exists "expense_receipts_staff_update" on storage.objects;
create policy "expense_receipts_staff_update" on storage.objects
  for update to authenticated using (bucket_id = 'expense-receipts' and public.is_staff())
  with check (bucket_id = 'expense-receipts' and public.is_staff());
drop policy if exists "expense_receipts_staff_delete" on storage.objects;
create policy "expense_receipts_staff_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'expense-receipts' and public.is_staff());


-- 5. Descriptions des catégories : écrites directement par l'utilisateur pour les
--    14 catégories (dont « Hébergement », direct, sort_order 9, créée le 01/10/2026).
--    Données, pas de schéma : non reproduites ici ; modifiables dans l'onglet Catégories.


-- ⚠ LOT SUIVANT (sécurité, NON traité ici) : le bucket vehicle-documents est PUBLIC
--   (documents de véhicules lisibles par URL publique) et staff-documents n'existe pas
--   alors que components/documents-manager.tsx y écrit. À passer en privé avec URL signées.
