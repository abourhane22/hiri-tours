-- Fiche client : identité du voyageur réutilisable (pré-remplissage des voyageurs — copie, jamais lien).
-- DÉJÀ APPLIQUÉE en production (Blocs 1 et 2 de la phase 0, passés et vérifiés) : fichier versionné pour l'historique.
-- Données réservées à l'équipe : RLS staff inchangée ; jamais exposées côté public, suivi, voucher, manifeste ni emails.

-- Bloc 1 — customers
alter table public.customers
  add column if not exists nationality            text,
  add column if not exists date_of_birth          date,
  add column if not exists gender                 text check (gender in ('m','f')),
  add column if not exists id_document_type       text check (id_document_type in ('cin','passeport')),
  add column if not exists id_document_number     text,
  add column if not exists id_document_expires_on date;

comment on column public.customers.id_document_number is
  'Pièce d''identité du client (backoffice uniquement, masquée à l''affichage). Recopiée — jamais liée — vers les voyageurs selon le profil du dossier.';
comment on column public.customers.date_of_birth is
  'Identité du voyageur : pré-remplit les voyageurs des prochaines réservations (copie).';

-- Bloc 2 — reservation_travelers.is_payer
alter table public.reservation_travelers
  add column if not exists is_payer boolean not null default false;
comment on column public.reservation_travelers.is_payer is
  'Ce voyageur est le client payeur du dossier (posé par le raccourci et la billetterie) : propose « Enregistrer aussi sur la fiche client ».';
