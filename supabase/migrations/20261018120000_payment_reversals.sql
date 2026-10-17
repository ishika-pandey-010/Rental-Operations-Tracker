-- US-15 Reverse a bounced payment (FR-13, NFR-02, R-06)

create table public.payment_reversals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  payment_id uuid not null constraint payment_reversals_payment_id_key unique,
  reversed_on date not null,
  reason text not null constraint payment_reversals_reason_not_blank check (btrim(reason) <> ''),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  constraint payment_reversals_payment_fk foreign key (payment_id, owner_id) references public.payments (id, owner_id)
);

create trigger payment_reversals_stamp before insert on public.payment_reversals for each row execute function public.stamp_row();
create trigger payment_reversals_append_only before update or delete on public.payment_reversals
  for each row execute function public.reject_ledger_change();
create trigger payment_reversals_no_truncate before truncate on public.payment_reversals
  for each statement execute function public.reject_truncate();

alter table public.payment_reversals enable row level security;
create policy "own reversals: read" on public.payment_reversals for select to authenticated using (owner_id = (select auth.uid()));
create policy "own reversals: add" on public.payment_reversals for insert to authenticated with check (owner_id = (select auth.uid()));
grant select, insert on public.payment_reversals to authenticated;
revoke all on public.payment_reversals from anon;

-- A reversed payment is worth nothing from now on.
create or replace function public.payment_value_cents(p_payment_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select case when exists (select 1 from public.payment_reversals r where r.payment_id = p.id) then 0 else p.amount_cents end
  from public.payments p where p.id = p_payment_id;
$$;

-- Allocation rules, now split by direction. Adding money checks both caps
-- and refuses a reversed payment. Releasing money (negative rows) only has
-- to stay within what that payment put on that charge.
create or replace function public.enforce_allocation_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_payment_lease uuid;
  v_charge_lease uuid;
  v_to_charge bigint;
  v_from_payment bigint;
  v_pair bigint;
begin
  select lease_id into v_payment_lease from public.payments where id = new.payment_id;
  select lease_id into v_charge_lease from public.charges where id = new.charge_id;
  if v_payment_lease is distinct from v_charge_lease then
    raise exception 'A payment can only pay charges on its own lease';
  end if;
  perform public.lock_lease(v_charge_lease);

  select coalesce(sum(amount_cents), 0) + new.amount_cents into v_pair
  from public.payment_allocations where payment_id = new.payment_id and charge_id = new.charge_id;
  if v_pair < 0 then
    raise exception 'Only money this payment put on this charge can be released from it';
  end if;
  if new.amount_cents < 0 then
    return new;
  end if;

  if exists (select 1 from public.payment_reversals where payment_id = new.payment_id) then
    raise exception 'This payment was reversed, so it can''t pay anything';
  end if;
  select coalesce(sum(amount_cents), 0) + new.amount_cents into v_to_charge
  from public.payment_allocations where charge_id = new.charge_id;
  select coalesce(sum(amount_cents), 0) + new.amount_cents into v_from_payment
  from public.payment_allocations where payment_id = new.payment_id;
  if v_to_charge > public.charge_value_cents(new.charge_id) then
    raise exception 'This would allocate more to the charge than it''s worth';
  end if;
  if v_from_payment > public.payment_value_cents(new.payment_id) then
    raise exception 'This would allocate more of the payment than it''s worth';
  end if;
  return new;
end;
$$;

-- US-15 AC1: a reversal releases everything the payment paid, however the
-- reversal row was written, then lets other credit fill the reopened charges.
create or replace function public.release_reversed_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_lease uuid;
  v_pair record;
begin
  select lease_id into v_lease from public.payments where id = new.payment_id;
  perform public.lock_lease(v_lease);
  for v_pair in
    select charge_id, sum(amount_cents) as net
    from public.payment_allocations where payment_id = new.payment_id
    group by charge_id having sum(amount_cents) > 0
  loop
    insert into public.payment_allocations (owner_id, payment_id, charge_id, amount_cents)
    values (new.owner_id, new.payment_id, v_pair.charge_id, -v_pair.net);
  end loop;
  perform public.apply_credit(v_lease);
  return new;
end;
$$;
create trigger payment_reversals_release after insert on public.payment_reversals
  for each row execute function public.release_reversed_payment();

create or replace function public.reverse_payment(p_payment_id uuid, p_reversed_on date, p_reason text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.payment_reversals (payment_id, reversed_on, reason)
  values (p_payment_id, p_reversed_on, btrim(p_reason))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.reverse_payment(uuid, date, text) to authenticated;

create or replace view public.payment_balances with (security_invoker = true) as
select
  p.id as payment_id,
  p.lease_id,
  p.owner_id,
  p.amount_cents,
  public.payment_value_cents(p.id) as value_cents,
  coalesce(a.allocated, 0)::bigint as allocated_cents,
  (public.payment_value_cents(p.id) - coalesce(a.allocated, 0))::bigint as unallocated_cents,
  exists (select 1 from public.payment_reversals r where r.payment_id = p.id) as reversed
from public.payments p
left join (
  select payment_id, sum(amount_cents) as allocated from public.payment_allocations group by payment_id
) a on a.payment_id = p.id;

-- US-16 + US-15: the ledger gains reversal rows, and released money is dated
-- on the day it was released.
create or replace view public.lease_ledger with (security_invoker = true) as
with entries as (
  select c.lease_id, c.owner_id, c.due_date as entry_date, 1 as sort_order, 'charge'::text as entry_type,
         c.description, c.id as ref_id, c.amount_cents, null::bigint as allocation_cents, c.created_at, c.created_by
  from public.charges c
  union all
  select p.lease_id, p.owner_id, p.paid_on, 2, 'payment',
         'Payment, ' || replace(p.method, '_', ' ') || coalesce(', ref ' || p.reference, ''),
         p.id, -p.amount_cents, null, p.created_at, p.created_by
  from public.payments p
  union all
  select p.lease_id, r.owner_id, r.reversed_on, 2, 'reversal',
         'Payment reversed: ' || r.reason,
         r.id, p.amount_cents, null, r.created_at, r.created_by
  from public.payment_reversals r
  join public.payments p on p.id = r.payment_id
  union all
  select c.lease_id, a.owner_id,
         case when a.amount_cents < 0 then coalesce(r.reversed_on, greatest(p.paid_on, c.due_date))
              else greatest(p.paid_on, c.due_date) end,
         3, 'allocation',
         case
           when a.amount_cents < 0 then 'Released from ' || c.description
           when a.created_at <> p.created_at then 'Credit applied to ' || c.description
           else 'Applied to ' || c.description
         end,
         a.id, 0, a.amount_cents, a.created_at, a.created_by
  from public.payment_allocations a
  join public.payments p on p.id = a.payment_id
  join public.charges c on c.id = a.charge_id
  left join public.payment_reversals r on r.payment_id = a.payment_id and a.amount_cents < 0
)
select
  lease_id, owner_id, entry_date, entry_type, description, ref_id, amount_cents, allocation_cents,
  sum(amount_cents) over w::bigint as balance_cents,
  row_number() over w as seq,
  created_at,
  created_by
from entries
window w as (partition by lease_id order by entry_date, sort_order, created_at, ref_id);
