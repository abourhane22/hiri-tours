-- =====================================================================
-- LOT C1 — Catalogue PRODUITS typé
-- La table reste `circuits` et la colonne reste `category` : le renommage
-- mettrait en jeu le tunnel de paiement (36 fichiers consommateurs, dont 10
-- publics) pour un gain cosmétique. Le vocabulaire « Produits » est porté
-- par l'interface.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BLOC A — à exécuter SEUL, en premier, et à valider avant le bloc B.
-- PostgreSQL interdit d'utiliser une valeur d'enum dans la transaction qui
-- la crée (précédent sur ce projet : 'attijari', puis 'credit_note').
-- ---------------------------------------------------------------------
alter type circuit_category add value if not exists 'hebergement';
alter type circuit_category add value if not exists 'billetterie';
alter type circuit_category add value if not exists 'prestation';

-- ---------------------------------------------------------------------
-- BLOC B — après validation du bloc A.
-- ---------------------------------------------------------------------
-- Unité de vente : jusqu'ici TOUT était facturé par personne, y compris les
-- transferts. `per_person` par défaut ⇒ aucun prix ne change au déploiement.
-- text + CHECK plutôt qu'un enum : même choix que traveler_type et
-- credit_notes.status, et une valeur s'ajoute sans transaction séparée.
alter table public.circuits
  add column if not exists sale_unit text not null default 'per_person'
    check (sale_unit in ('per_person', 'per_night_room', 'per_trip', 'per_unit')),
  add column if not exists pricing_mode text not null default 'fixed'
    check (pricing_mode in ('fixed', 'on_request'));

comment on column public.circuits.sale_unit is
  'Base de facturation : per_person (adultes+enfants) · per_night_room (nuits × chambres) · per_trip (par trajet, indépendant du pax) · per_unit (quantité). Autorité de calcul : lib/pricing.ts.';
comment on column public.circuits.pricing_mode is
  'fixed = prix catalogue réservable en ligne · on_request = prix sur demande (devis), non réservable dans le tunnel.';

-- ---------------------------------------------------------------------
-- BLOC C — bascule du transfert en tarification au trajet.
-- Autorisée explicitement le 2026-09-19 après audit : le produit est une
-- navette PRIVÉE facturée 250 MAD, mais vendue par personne (4 pax = 1 000 MAD).
-- 15 réservations de démonstration à 12 525 MAD au lieu de 3 750 MAD.
--
-- ⚠ Ne modifie AUCUN dossier ni AUCUNE facture : `reservations.total_amount_mad`
-- est un montant figé à la création, et les factures sont des snapshots.
-- Seuls les prix des FUTURES réservations changent.
--
-- Vérification avant / après :
--   select title, category, sale_unit, base_price_mad
--     from public.circuits where category = 'transfert';
-- ---------------------------------------------------------------------
update public.circuits
   set sale_unit = 'per_trip'
 where category = 'transfert'
   and sale_unit = 'per_person';
