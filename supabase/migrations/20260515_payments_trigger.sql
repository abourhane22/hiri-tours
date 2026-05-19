-- Trigger : mettre à jour paid_amount_mad sur la réservation
-- quand un paiement est inséré, et auto-promouvoir le statut en 'paid'
-- si le total est entièrement encaissé.

create or replace function public.update_reservation_paid_amount()
returns trigger as $$
begin
  update public.reservations
  set
    paid_amount_mad = paid_amount_mad + new.amount_mad,
    status = case
      when (paid_amount_mad + new.amount_mad) >= total_amount_mad
           and status not in ('paid', 'completed', 'cancelled')
      then 'paid'::reservation_status
      else status
    end
  where id = new.reservation_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists payment_updates_reservation on public.payments;

create trigger payment_updates_reservation
  after insert on public.payments
  for each row execute function public.update_reservation_paid_amount();
