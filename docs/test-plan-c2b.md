# Plan de test C2b — Allotements (T1 → T7)

À exécuter **après** déploiement du code, migration déjà passée (blocs 4–7,
vérifications a–d au vert). Chaque test dit quoi faire, quoi observer, et
quelle requête SQL le prouve. Aucun test n'écrit hors d'un allotement de
test que tu crées et supprimes toi-même.

Prérequis : un produit **de test** actif (ex. « Test allotement » à 100 MAD,
capacité 10) — ne pas utiliser un produit vendu.

---

## T1 — Non-régression : produit SANS allotement

**But** : prouver qu'un produit non piloté se réserve exactement comme avant.

1. Choisir un produit **sans** allotement (n'importe lequel au déploiement).
2. Réserver depuis le tunnel public `/reserver/<produit>` pour une date future,
   2 passagers, canal « virement ». Noter la référence `AG-…`.
3. Attendu : dossier créé, même total qu'avant, même écran de confirmation,
   **sans** mention « sous réserve ».

```sql
-- Aucune trace côté allotement : attendu 0 / 0
select
  (select count(*) from allotment_movements
    where reservation_id = (select id from reservations where reference = 'AG-…')) as mouvements,
  (select count(*) from allotment_days) as jours_materialises;
```

---

## T2 — Concurrence : deux réservations simultanées sur la dernière place

**But** : une seule passe, `sold` ne dépasse jamais `quota`.

1. Créer un allotement **capacité propre** sur le produit de test :
   période = demain → demain + 7, quota **2**, `on_exhausted = block`.
2. Vérifier la matérialisation :

```sql
select day, quota, sold, released from allotment_days
 where allotment_id = '<id>' order by day;            -- attendu : 8 lignes, sold = 0
```

3. Consommer **1** place normalement (réservation tunnel, 1 pax, jour J = demain).
   Il reste 1 place.
4. Ouvrir **deux onglets** du tunnel sur le même produit et la même date J,
   1 pax chacun, remplir jusqu'au bouton final, puis cliquer les deux
   **en même temps** (ou dans la même seconde).
5. Attendu : **un** onglet reçoit sa référence ; **l'autre** affiche
   « Ce départ est complet. » (ou « Il ne reste qu'une place… » s'il a été
   évalué avant la première).

```sql
-- Le compteur n'a JAMAIS dépassé : attendu sold = 2, quota = 2
select day, quota, sold from allotment_days where allotment_id = '<id>' and day = '<J>';

-- Exactement 2 dossiers non annulés ce jour sur ce produit : attendu 2
select count(*) from reservations
 where circuit_id = '<produit>' and departure_date = '<J>' and status <> 'cancelled';

-- Aucun dossier « fantôme » (créé puis compensé) : la référence refusée
-- ne doit PAS exister : attendu 0
select count(*) from reservations where reference = '<référence affichée par l''onglet refusé, si une était visible>';
```

**Variante base (sans navigateur)** — même preuve, en deux sessions SQL Editor
ouvertes côte à côte :

```sql
-- Session A
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select * from consume_allotment('<produit>', '<J>', 1, null, 'manual');
select pg_sleep(8);      -- garde le verrou 8 s
commit;

-- Session B, lancée pendant les 8 s
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select * from consume_allotment('<produit>', '<J>', 1, null, 'manual');   -- ATTEND, puis 'blocked' | 0
rollback;
```

La session B se fige jusqu'au commit de A, puis renvoie `blocked`. C'est le
verrou `FOR UPDATE` observé à l'œil nu.

---

## T3 — Annulation : la place est rendue

1. Annuler depuis la fiche l'un des deux dossiers de T2 (zone de danger).
2. Attendu sur la fiche : statut « Annulée ».

```sql
-- attendu : sold = 1
select sold from allotment_days where allotment_id = '<id>' and day = '<J>';

-- attendu : 1 ligne 'release', qty 1, reason 'cancellation'
select kind, qty, reason from allotment_movements
 where reservation_id = '<dossier annulé>' order by created_at;

-- Idempotence : rejouer l'annulation ne rend rien deux fois
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select release_allotment('<dossier annulé>');   -- attendu : 0
rollback;
```

---

## T4 — Réduction d'un quota sous le vendu : refus nommant les jours

1. Sur l'allotement de test, `sold = 1` le jour J. Éditer le quota à **0**…
   impossible (min 1) — éditer plutôt : consommer une 2ᵉ place (sold = 2),
   puis tenter de ramener le quota à **1**.
2. Attendu : le formulaire refuse avec le message
   *« Quota impossible à ramener à 1 : déjà vendu au-delà sur ces jours — JJ/MM/AAAA (2 vendus). »*
3. Tenter de réduire la **période** pour exclure le jour J.
4. Attendu : *« Période impossible à réduire : des ventes existent sur des jours qui en sortiraient — JJ/MM/AAAA (2). »*

```sql
-- Rien n'a bougé : attendu quota inchangé, 8 jours toujours présents
select count(*), min(quota), max(quota) from allotment_days where allotment_id = '<id>';
```

5. Désactiver l'allotement (case « actif »), puis créer un **nouvel** allotement
   sur le même produit et la même période.
6. Attendu : refus *« Un allotement « <label> » (désactivé) couvre déjà cette
   période pour ce produit. Supprimez-le ou réduisez sa période avant d'en
   créer un nouveau. »* — l'historique n'est pas perdu.

---

## T5 — Release automatique à J−n

1. Créer un allotement de test **B** : période = aujourd'hui + 3 → + 10,
   quota 5, `release_days = 4`.
2. Le jour J+3 est à 3 jours ; `J+3 − 4 ≤ aujourd'hui` ⇒ **déjà dû**.
3. Déclencher le cron manuellement :

```
curl -H "Authorization: Bearer $CRON_SECRET" https://<domaine>/api/release-allotments
```

   Attendu : `{"ok":true,"released":1}` (ou plus si d'autres jours sont dus).

```sql
-- attendu : le jour J+3 released = true, les suivants false
select day, released from allotment_days where allotment_id = '<B>' order by day;
```

4. Tenter une réservation tunnel sur B au jour J+3.
   Attendu : *« Ce départ n'est plus ouvert à la vente. »* et aucun dossier créé.
5. Réserver au jour J+4 : passe normalement.

Canari clé Vercel : si la clé n'était pas `service_role`, l'étape 3 renverrait
une erreur 500 explicite (`permission denied for function release_due_allotments`).

---

## T6 — Parité des prix : C2b ne touche à aucun prix de vente

```
npx tsx scripts/check-pricing-parity.mjs            # attendu : 2 711 cas, OK
npx tsx scripts/check-purchase-rate-resolution.mjs  # attendu : 36 cas, OK
```

---

## T7 — Réconciliation : la notification remonte les dossiers hors stock

1. Sur l'allotement de test, passer `on_exhausted = request`, quota atteint
   (sold = quota) au jour J.
2. Réserver depuis le tunnel au jour J.
   Attendu : dossier **créé**, écran de confirmation avec la mention
   *« Sous réserve de confirmation… »*.
3. Ouvrir le centre de notifications (cloche) → onglet **Stock**.
   Attendu : *« Dossier hors allotement — AG-… »*, priorité ambre, lien vers la fiche.

```sql
-- La requête que la notification exécute : attendu 1 ligne (le dossier de l'étape 2)
select r.reference, r.departure_date, r.adults + r.children as pax
  from reservations r
  join allotment_days d on d.product_id = r.circuit_id and d.day = r.departure_date
 where r.status <> 'cancelled'
   and r.departure_date >= current_date
   and not exists (select 1 from allotment_movements m
                    where m.reservation_id = r.id and m.kind = 'consume');
```

4. Annuler ce dossier. Attendu : la notification disparaît (elle est dérivée,
   pas stockée).

---

## Nettoyage

Supprimer les allotements de test : impossible tant que des mouvements
existent (T4 l'a prouvé). Annuler d'abord tous les dossiers de test, puis
supprimer les mouvements et les allotements en SQL :

```sql
delete from allotment_movements where allotment_day_id in
  (select id from allotment_days where allotment_id in ('<id>','<B>'));
delete from allotments where id in ('<id>','<B>');   -- cascade sur allotment_days
```

Puis vérifier `select count(*) from allotment_days;` = 0 si aucun allotement réel n'a encore été créé.
