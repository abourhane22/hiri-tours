-- Re-backfill de customers.phone_normalized après ajout de la règle
-- « 0X national marocain → 212X » (et retrait du préfixe d'appel 00…),
-- pour que deux formats du même numéro (0661… et +212 661…) partagent la
-- même clé de comparaison. Doit rester aligné avec normalizePhone()
-- (lib/customers.ts).
--
-- ⚠ ORDRE D'EXÉCUTION
--   1. Lancer d'abord la requête de DÉTECTION ci-dessous : si elle renvoie
--      des lignes, deux fiches vont converger vers la même clé et l'index
--      unique fera échouer l'UPDATE. Fusionner/corriger ces fiches d'abord.
--   2. Puis lancer l'UPDATE.

-- 1) DÉTECTION des collisions potentielles (à lancer avant l'UPDATE)
WITH normalized AS (
  SELECT
    id,
    NULLIF(
      CASE
        WHEN left(regexp_replace(phone, '\D', '', 'g'), 2) = '00'
          THEN substr(regexp_replace(phone, '\D', '', 'g'), 3)
        WHEN left(regexp_replace(phone, '\D', '', 'g'), 1) = '0'
          THEN '212' || substr(regexp_replace(phone, '\D', '', 'g'), 2)
        ELSE regexp_replace(phone, '\D', '', 'g')
      END,
      ''
    ) AS norm
  FROM customers
  WHERE phone IS NOT NULL
)
SELECT norm, count(*) AS n, array_agg(id) AS customer_ids
FROM normalized
WHERE norm IS NOT NULL
GROUP BY norm
HAVING count(*) > 1;

-- 2) RE-BACKFILL (à lancer une fois la détection revenue vide)
UPDATE customers
SET phone_normalized = NULLIF(
  CASE
    WHEN left(regexp_replace(phone, '\D', '', 'g'), 2) = '00'
      THEN substr(regexp_replace(phone, '\D', '', 'g'), 3)
    WHEN left(regexp_replace(phone, '\D', '', 'g'), 1) = '0'
      THEN '212' || substr(regexp_replace(phone, '\D', '', 'g'), 2)
    ELSE regexp_replace(phone, '\D', '', 'g')
  END,
  ''
)
WHERE phone IS NOT NULL;

-- Fiches sans téléphone : clé vidée (les NULL restent distincts pour l'index).
UPDATE customers SET phone_normalized = NULL WHERE phone IS NULL;
