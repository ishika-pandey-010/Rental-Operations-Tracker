-- US-12 Record a payment (FR-10) · US-13 Partial payments (FR-11)
-- US-14 Overpayment becomes credit (FR-12) · US-16 Lease ledger (FR-21)

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lease_id uuid not null,
  amount_cents bigint not null constraint payments_amount_positive check (amount_cents > 0),
  paid_on date not null,
  method text not null constraint payments_method_values check (method in ('bank_transfer', 'cash', 'cheque', 'card', 'other')),
  reference text constraint payments_reference_not_blank check (reference is null or btrim(reference) <> ''),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  constraint payments_lease_fk foreign key (lease_id, owner_id) references public.leases (id, owner_id),
  constraint payments_id_owner_key unique (id, owner_id)
);
-- US-12 AC2, D-24: a reference can't repeat within a lease. Compared trimmed
-- and case-blind, so "TRX-881" and "trx-881 " are the same transfer.
create unique index payments_reference_per_lease on public.payments (lease_id, lower(btrim(reference)))
  where reference is not null;
create index payments_lease_idx on public.payments (lease_id, paid_on);

-- One row per slice of a payment applied to a charge. Negative rows release
-- money back to credit (reversals, move-outs); nothing is ever edited.
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  payment_id uuid not null,
  charge_id uuid not null,
  amount_cents bigint not null constraint payment_allocations_amount_nonzero check (amount_cents <> 0),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  constraint payment_allocations_payment_fk foreign key (payment_id, owner_id) references public.payments (id, owner_id),
  constraint payment_allocations_charge_fk foreign key (charge_id, owner_id) references public.charges (id, owner_id)
);
create index payment_allocations_payment_idx on public.payment_allocations (payment_id);
create index payment_allocations_charge_idx on public.payment_allocations (charge_id);

create trigger payments_stamp before insert on public.payments for each row execute function public.stamp_row();
create trigger payment_allocations_stamp before insert on public.payment_allocations for each row execute function public.stamp_row();
create trigger payments_append_only before update or delete on public.payments
  for each row execute function public.reject_ledger_change();
create trigger payments_no_truncate before truncate on public.payments
  for each statement execute function public.reject_truncate();
create trigger payment_allocations_append_only before update or delete on public.payment_allocations
  for each row execute function public.reject_ledger_change();
create trigger payment_allocations_no_truncate before truncate on public.payment_allocations
  for each statement execute function public.reject_truncate();

create or replace function public.enforce_payment_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.leases where id = new.lease_id and status in ('active', 'ended')) then
    raise exception 'Activate the lease before recording payments';
  end if;
  return new;
end;
$$;
create trigger payments_rules before insert on public.payments
  for each row execute function public.enforce_payment_rules();

-- What a charge is worth after corrections. Adjustments arrive with US-09;
-- this is the single place that will learn about them.
create or replace function public.charge_value_cents(p_charge_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select amount_cents from public.charges where id = p_charge_id;
$$;

-- What a payment can still give. Reversals arrive with US-15.
create or replace function public.payment_value_cents(p_payment_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select amount_cents from public.payments where id = p_payment_id;
$$;

-- US-13 AC4, R-02: net allocations to a charge stay between 0 and its value,
-- net allocations from a payment stay between 0 and the payment, and a
-- payment only pays its own lease. Locks the lease first (D-26) so two
-- transactions can't both pass the check.
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

  select coalesce(sum(amount_cents), 0) + new.amount_cents into v_to_charge
  from public.payment_allocations where charge_id = new.charge_id;
  select coalesce(sum(amount_cents), 0) + new.amount_cents into v_from_payment
  from public.payment_allocations where payment_id = new.payment_id;
  select coalesce(sum(amount_cents), 0) + new.amount_cents into v_pair
  from public.payment_allocations where payment_id = new.payment_id and charge_id = new.charge_id;

  if v_to_charge > public.charge_value_cents(new.charge_id) then
    raise exception 'This would allocate more to the charge than it''s worth';
  end if;
  if v_from_payment > public.payment_value_cents(new.payment_id) then
    raise exception 'This would allocate more of the payment than it''s worth';
  end if;
  if v_pair < 0 then
    raise exception 'Only money this payment put on this charge can be released from it';
  end if;
  return new;
end;
$$;
create trigger payment_allocations_rules before insert on public.payment_allocations
  for each row execute function public.enforce_allocation_rules();

alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
create policy "own payments: read" on public.payments for select to authenticated using (owner_id = (select auth.uid()));
create policy "own payments: add" on public.payments for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own allocations: read" on public.payment_allocations for select to authenticated using (owner_id = (select auth.uid()));
create policy "own allocations: add" on public.payment_allocations for insert to authenticated with check (owner_id = (select auth.uid()));
grant select, insert on public.payments, public.payment_allocations to authenticated;
revoke all on public.payments, public.payment_allocations from anon;

-- NFR-04: balances and statuses are derived here, never stored.
create view public.charge_balances with (security_invoker = true) as
select
  c.id as charge_id,
  c.lease_id,
  c.owner_id,
  c.kind,
  c.period,
  c.description,
  c.due_date,
  c.amount_cents,
  (public.charge_value_cents(c.id) - c.amount_cents)::bigint as adjustments_cents,
  public.charge_value_cents(c.id) as value_cents,
  coalesce(a.allocated, 0)::bigint as allocated_cents,
  (public.charge_value_cents(c.id) - coalesce(a.allocated, 0))::bigint as balance_cents,
  case
    when public.charge_value_cents(c.id) = 0 then 'cancelled'
    when coalesce(a.allocated, 0) = 0 then 'open'
    when coalesce(a.allocated, 0) >= public.charge_value_cents(c.id) then 'paid'
    else 'partial'
  end as status
from public.charges c
left join (
  select charge_id, sum(amount_cents) as allocated from public.payment_allocations group by charge_id
) a on a.charge_id = c.id;

create view public.payment_balances with (security_invoker = true) as
select
  p.id as payment_id,
  p.lease_id,
  p.owner_id,
  p.amount_cents,
  public.payment_value_cents(p.id) as value_cents,
  coalesce(a.allocated, 0)::bigint as allocated_cents,
  (public.payment_value_cents(p.id) - coalesce(a.allocated, 0))::bigint as unallocated_cents
from public.payments p
left join (
  select payment_id, sum(amount_cents) as allocated from public.payment_allocations group by payment_id
) a on a.payment_id = p.id;

-- US-14: credit is money received and not yet applied to any charge.
create view public.lease_credit with (security_invoker = true) as
select
  l.id as lease_id,
  l.owner_id,
  coalesce(sum(pb.unallocated_cents), 0)::bigint as credit_cents
from public.leases l
left join public.payment_balances pb on pb.lease_id = l.id
group by l.id, l.owner_id;

-- D-07, US-13 AC2, US-14 AC2: spend available credit on open charges, oldest
-- payment's money first, oldest due charge first. Returns cents applied.
create or replace function public.apply_credit(p_lease_id uuid)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_charge record;
  v_payment record;
  v_need bigint;
  v_take bigint;
  v_applied bigint := 0;
begin
  perform public.lock_lease(p_lease_id);
  for v_charge in
    select charge_id, balance_cents from public.charge_balances
    where lease_id = p_lease_id and balance_cents > 0
    order by due_date, period nulls last, charge_id
  loop
    v_need := v_charge.balance_cents;
    for v_payment in
      select pb.payment_id, pb.unallocated_cents
      from public.payment_balances pb join public.payments p on p.id = pb.payment_id
      where pb.lease_id = p_lease_id and pb.unallocated_cents > 0
      order by p.paid_on, p.created_at, p.id
    loop
      exit when v_need = 0;
      v_take := least(v_need, v_payment.unallocated_cents);
      insert into public.payment_allocations (payment_id, charge_id, amount_cents)
      values (v_payment.payment_id, v_charge.charge_id, v_take);
      v_need := v_need - v_take;
      v_applied := v_applied + v_take;
    end loop;
  end loop;
  return v_applied;
end;
$$;

-- US-12, US-13: record a payment. With no allocations given, available credit
-- (this payment included) is applied oldest first. With allocations given
-- ([{"charge_id": …, "amount_cents": …}]), exactly those are made and the
-- rest is held as credit (manual override).
create or replace function public.record_payment(
  p_lease_id uuid,
  p_amount_cents bigint,
  p_paid_on date,
  p_method text,
  p_reference text,
  p_allocations jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_alloc jsonb;
begin
  perform public.lock_lease(p_lease_id);
  insert into public.payments (lease_id, amount_cents, paid_on, method, reference)
  values (p_lease_id, p_amount_cents, p_paid_on, p_method, nullif(btrim(coalesce(p_reference, '')), ''))
  returning id into v_id;

  if p_allocations is null then
    perform public.apply_credit(p_lease_id);
  else
    for v_alloc in select * from jsonb_array_elements(p_allocations)
    loop
      continue when coalesce((v_alloc ->> 'amount_cents')::bigint, 0) = 0;
      insert into public.payment_allocations (payment_id, charge_id, amount_cents)
      values (v_id, (v_alloc ->> 'charge_id')::uuid, (v_alloc ->> 'amount_cents')::bigint);
    end loop;
  end if;
  return v_id;
end;
$$;

-- US-14 AC2: generating a month now also spends any credit on the new charge.
create or replace function public.generate_rent_charges(p_period date)
returns table (created int, existing int)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_last date := (date_trunc('month', p_period) + interval '1 month' - interval '1 day')::date;
  v_lease public.leases;
  v_amount bigint;
  v_created int := 0;
  v_eligible int := 0;
  v_rows int;
begin
  for v_lease in
    select * from public.leases l
    where l.status in ('active', 'ended')
      and l.start_date <= v_last
      and coalesce(l.move_out_date, l.end_date) >= v_period
    order by l.id
  loop
    v_amount := public.rent_charge_cents(v_lease, v_period);
    continue when v_amount <= 0;
    v_eligible := v_eligible + 1;
    perform public.lock_lease(v_lease.id);
    insert into public.charges (lease_id, kind, period, amount_cents, due_date, description)
    values (
      v_lease.id, 'rent', v_period, v_amount, public.rent_due_date(v_lease, v_period),
      public.rent_charge_description(v_lease, v_period)
    )
    on conflict (lease_id, period) where kind = 'rent' do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      perform public.apply_credit(v_lease.id);
    end if;
    v_created := v_created + v_rows;
  end loop;
  return query select v_created, v_eligible - v_created;
end;
$$;

-- US-16: everything on a lease in date order with a running balance.
-- Positive means the tenant owes (OQ-20). Allocation rows show where money
-- went and don't move the balance. Later migrations add adjustment and
-- reversal rows to the same shape.
create view public.lease_ledger with (security_invoker = true) as
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
  select c.lease_id, a.owner_id, greatest(p.paid_on, c.due_date), 3, 'allocation',
         case
           when a.amount_cents < 0 then 'Released from ' || c.description
           when a.created_at <> p.created_at then 'Credit applied to ' || c.description
           else 'Applied to ' || c.description
         end,
         a.id, 0, a.amount_cents, a.created_at, a.created_by
  from public.payment_allocations a
  join public.payments p on p.id = a.payment_id
  join public.charges c on c.id = a.charge_id
)
select
  lease_id, owner_id, entry_date, entry_type, description, ref_id, amount_cents, allocation_cents,
  sum(amount_cents) over w::bigint as balance_cents,
  row_number() over w as seq,
  created_at,
  created_by
from entries
window w as (partition by lease_id order by entry_date, sort_order, created_at, ref_id);

grant select on public.charge_balances, public.payment_balances, public.lease_credit, public.lease_ledger to authenticated;
revoke all on public.charge_balances, public.payment_balances, public.lease_credit, public.lease_ledger from anon;
grant execute on function public.record_payment(uuid, bigint, date, text, text, jsonb) to authenticated;
grant execute on function public.apply_credit(uuid) to authenticated;
