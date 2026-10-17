-- US-08 Renew a lease (FR-18, D-10): a new lease linked to the old one; the
-- deposit can carry over, in which case the old lease holds nothing and has
-- no refund to pay.

alter table public.deposits add column carried_from_lease_id uuid;
alter table public.deposits add constraint deposits_carried_from_fk
  foreign key (carried_from_lease_id, owner_id) references public.leases (id, owner_id);
create index deposits_carried_from_idx on public.deposits (carried_from_lease_id) where carried_from_lease_id is not null;

-- Held = received on this lease − carried over to a renewal.
create or replace view public.lease_deposit_summary with (security_invoker = true) as
select
  l.id as lease_id,
  l.owner_id,
  coalesce((select sum(d.amount_cents) from public.deposits d where d.lease_id = l.id), 0)::bigint as received_cents,
  (coalesce((select sum(d.amount_cents) from public.deposits d where d.lease_id = l.id), 0)
   - coalesce((select sum(d.amount_cents) from public.deposits d where d.carried_from_lease_id = l.id), 0))::bigint as held_cents
from public.leases l;

create or replace function public.renew_lease(
  p_lease_id uuid,
  p_start date,
  p_end date,
  p_monthly_rent_cents bigint,
  p_carry_deposit boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old public.leases;
  v_held bigint;
  v_new uuid;
begin
  perform public.lock_lease(p_lease_id);
  select * into v_old from public.leases where id = p_lease_id;
  if v_old.id is null or v_old.status <> 'active' then
    raise exception 'Only an active lease can be renewed';
  end if;
  if p_start <= v_old.end_date then
    raise exception 'A renewal starts after the current lease ends (%)', v_old.end_date;
  end if;
  v_held := public.deposit_held_cents(p_lease_id);

  v_new := public.create_lease(v_old.unit_id, v_old.tenant_id, p_start, p_end, p_monthly_rent_cents, v_old.due_day);
  update public.leases set renewed_from_id = p_lease_id where id = v_new;

  -- The old lease runs to its end date; charges up to then are unaffected.
  perform public.move_out(p_lease_id, v_old.end_date);

  if p_carry_deposit and v_held > 0 then
    insert into public.deposits (lease_id, amount_cents, received_on, note, carried_from_lease_id)
    values (v_new, v_held, current_date, 'Carried over from the previous lease', p_lease_id);
    update public.leases set status = 'active' where id = v_new;
  end if;
  return v_new;
end;
$$;
grant execute on function public.renew_lease(uuid, date, date, bigint, boolean) to authenticated;
