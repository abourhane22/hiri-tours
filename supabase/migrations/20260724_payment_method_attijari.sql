-- =====================================================================
-- Ajoute la valeur 'attijari' à l'enum payment_method.
-- L'ancienne valeur 'cmi' reste dans l'enum (on ne peut pas retirer une
-- valeur d'enum PostgreSQL sans recréer le type) mais n'est plus écrite :
-- les nouveaux paiements par carte marocaine sont enregistrés en 'attijari'.
--
-- IMPORTANT : PostgreSQL interdit d'utiliser une nouvelle valeur d'enum
-- dans la MÊME transaction que son ajout. La normalisation des données
-- existantes (ci-dessous) doit donc être exécutée SÉPARÉMENT, après que
-- ce ALTER TYPE a été committé.
-- =====================================================================

alter type payment_method add value if not exists 'attijari';

-- --- À exécuter ensuite, dans une requête distincte -----------------
-- Normalise les paiements existants stockés en 'cmi' vers 'attijari' :
--
--   update public.payments set method = 'attijari' where method = 'cmi';
--
-- --------------------------------------------------------------------
