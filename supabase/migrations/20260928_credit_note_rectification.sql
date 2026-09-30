-- ============================================================================
-- Avoir total suivi d'une facture rectificative (30/09/2026)
-- ============================================================================
-- Blocs 1 et 2 PASSÉS dans le SQL Editor le 30/09/2026 et vérifiés.
--
-- Problème : une facture payée annulée par un avoir total, puis refacturée sur le
-- même dossier (mêmes encaissements) laissait l'avoir « émis » avec tout son
-- solde → crédit client indu, et CA du dossier ramené à 0 par la règle « CA net
-- d'avoirs ». Correctif : mouvement `rectification` (imputation SANS paiement),
-- neutralisé dans creditNotesByReservation (lib/credit-notes.ts).
--
-- Rattrapage (lecture seule, décision humaine, imputation via le bouton de la page
-- avoir — la garde is_staff() échoue depuis le SQL Editor) : voir la requête 0.2
-- en fin de fichier.

-- 1. Schéma
alter table public.credit_note_movements drop constraint if exists credit_note_movements_kind_check;
alter table public.credit_note_movements add constraint credit_note_movements_kind_check
  check (kind in ('use', 'refund', 'rectification'));

alter table public.credit_note_movements
  add column if not exists target_invoice_id uuid references public.invoices(id);  -- kind = rectification
create index if not exists credit_note_movements_target_invoice_idx
  on public.credit_note_movements (target_invoice_id);

alter table public.invoices add column if not exists rectification_snapshot jsonb;
comment on column public.invoices.rectification_snapshot is
  'Facture rectificative : {invoice_id, invoice_number, credit_note_id, credit_note_number} de la facture annulée par avoir. Figé à l''émission.';
comment on column public.credit_note_movements.target_invoice_id is
  'kind = rectification : facture rectificative sur laquelle l''avoir est imputé (aucun paiement créé).';

-- 2. Imputation (une transaction, verrous, garde staff)
create or replace function public.impute_credit_note_rectification(
  p_credit_note_id uuid, p_invoice_id uuid
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_note credit_notes%rowtype;
  v_inv  invoices%rowtype;
  v_orig invoices%rowtype;
  v_mv   uuid;
begin
  if not public.is_staff() then raise exception 'Accès réservé au staff.'; end if;
  select * into v_note from credit_notes where id = p_credit_note_id for update;
  if not found then raise exception 'Avoir introuvable.'; end if;
  if v_note.status <> 'issued' or v_note.remaining_mad <= 0 then
    raise exception 'L''avoir % n''est plus ouvert.', v_note.credit_note_number;
  end if;
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found then raise exception 'Facture introuvable.'; end if;
  if v_inv.status = 'cancelled' then raise exception 'La facture % est annulée.', v_inv.invoice_number; end if;
  if v_inv.reservation_id <> v_note.reservation_id then
    raise exception 'La facture et l''avoir ne portent pas sur le même dossier.';
  end if;
  if v_inv.issued_at < v_note.created_at then
    raise exception 'La facture % est antérieure à l''avoir : ce n''est pas une rectificative.', v_inv.invoice_number;
  end if;
  select * into v_orig from invoices where id = v_note.invoice_id;
  if v_orig.status <> 'cancelled' or v_orig.cancelled_by_credit_note_id is distinct from v_note.id then
    raise exception 'L''avoir % n''a pas annulé la facture d''origine : imputation de rectification impossible.', v_note.credit_note_number;
  end if;

  insert into credit_note_movements (credit_note_id, kind, amount_mad, target_reservation_id, target_invoice_id, notes)
  values (v_note.id, 'rectification', v_note.remaining_mad, v_note.reservation_id, v_inv.id,
          'Imputé sur la facture rectificative ' || v_inv.invoice_number
          || ' — sans encaissement : les règlements du dossier couvrent la nouvelle facture.')
  returning id into v_mv;

  update credit_notes set remaining_mad = 0, status = 'consumed' where id = v_note.id;
  return v_mv;
end $$;

-- 0.2 Rattrapage (lecture seule) : avoirs ouverts dont le dossier porte une facture active émise après l'avoir.
-- select cn.credit_note_number, cn.id, cn.amount_mad, cn.remaining_mad, cn.created_at::date,
--        orig.invoice_number as facture_annulee, (orig.cancelled_by_credit_note_id = cn.id) as avoir_a_annule_la_facture,
--        i.invoice_number as facture_active, i.status, i.issued_at::date, i.paid_at::date, r.reference
-- from credit_notes cn
-- join invoices orig on orig.id = cn.invoice_id
-- join reservations r on r.id = cn.reservation_id
-- join invoices i on i.reservation_id = cn.reservation_id and i.status <> 'cancelled' and i.issued_at > cn.created_at
-- where cn.status = 'issued' and cn.remaining_mad > 0
-- order by cn.created_at;
