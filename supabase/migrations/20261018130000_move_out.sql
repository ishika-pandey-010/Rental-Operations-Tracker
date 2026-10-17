-- US-09 Early move-out (FR-17, FR-09): adjustments, not edits (D-03, NFR-02)

create table public.charge_adjustments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  charge_id uuid not null,
  amount_cents bigint not null constraint charge_adjustments_amount_nonzero check (amount_cents <> 0),
  reason text not null constraint charge_adjustments_reason_not_blank check (btrim(reason) <> ''),
  effective_on date not null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  constraint charge_adjustments_charge_fk foreign key (charge_id, owner_id) references public.charges (id, owner_id)
);
create index charge_adjustments_charge_idx on public.charge_adjustments (charge_id);

create trigger charge_adjustments_stamp before insert on public.charge_adjustments for each row execute function public.stamp_row();
create trigger charge_adjustments_append_only before update or delete on public.charge_adjustments
  for each row execute function public.reject_ledger_change();
create trigger charge_adjustments_no_truncate before truncate on public.charge_adjustments
  for each statement execute function public.reject_truncate();

alter table public.charge_adjustments enable row level security;
create policy "own adjustments: read" on public.charge_adjustments for select to authenticated using (owner_id = (select auth.uid()));
create policy "own adjustments: add" on public.charge_adjustments for insert to authenticated with check (owner_id = (select auth.uid()));
grant select, insert on public.charge_adjustments to authenticated;
revoke all on public.charge_adjustments from anon;

-- A charge is worth its amount plus its adjustments. Every view and the
-- allocation trigger read this, so they all learn about adjustments here.
create or replace function public.charge_value_cents(p_charge_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select c.amount_cents + coalesce((select sum(a.amount_cents) from public.charge_adjustments a where a.charge_id = c.id), 0)
  from public.charges c where c.id = p_charge_id;
$$;

-- An adjustment can't take a charge below zero, or below what's been paid
-- toward it. Callers release the excess first (move_out does).
create or replace function public.enforce_adjustment_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_lease uuid;
  v_value bigint;
  v_allocated bigint;
begin
  select lease_id into v_lease from public.charges where id = new.charge_id;
  perform public.lock_lease(v_lease);
  v_value := public.charge_value_cents(new.charge_id) + new.amount_cents;
  select coalesce(sum(amount_cents), 0) into v_allocated from public.payment_allocations where charge_id = new.charge_id;
  if v_value < 0 then
    raise exception 'An adjustment can''t take a charge below zero';
  end if;
  if v_value < v_allocated then
    raise exception 'This adjustment would leave the charge worth less than has been paid toward it';
  end if;
  return new;
end;
$$;
create trigger charge_adjustments_rules before insert on public.charge_adjustments
  for each row execute function public.enforce_adjustment_rules();

-- Releases money from a charge until no more than p_keep_cents is allocated
-- to it, newest payment first. Released money becomes credit.
create or replace function public.release_down_to(p_charge_id uuid, p_keep_cents bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_excess bigint;
  v_pair record;
  v_take bigint;
begin
  select coalesce(sum(amount_cents), 0) - p_keep_cents into v_excess
  from public.payment_allocations where charge_id = p_charge_id;
  for v_pair in
    select a.payment_id, sum(a.amount_cents) as net
    from public.payment_allocations a join public.payments p on p.id = a.payment_id
    where a.charge_id = p_charge_id
    group by a.payment_id, p.paid_on, p.created_at
    having sum(a.amount_cents) > 0
    order by p.paid_on desc, p.created_at desc
  loop
    exit when v_excess <= 0;
    v_take := least(v_excess, v_pair.net);
    insert into public.payment_allocations (payment_id, charge_id, amount_cents)
    values (v_pair.payment_id, p_charge_id, -v_take);
    v_excess := v_excess - v_take;
  end loop;
end;
$$;

-- US-09: record a move-out. The lease ends; the move-out month is prorated
-- (an adjustment if it was already charged, or the right amount when it's
-- generated later, D-27); later months already charged are cancelled; any
-- money that frees up becomes credit and pays older charges first.
create or replace function public.move_out(p_lease_id uuid, p_move_out_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lease public.leases;
  v_charge record;
  v_new bigint;
  v_value bigint;
  v_reason text;
begin
  perform public.lock_lease(p_lease_id);
  select * into v_lease from public.leases where id = p_lease_id;
  if v_lease.id is null or v_lease.status <> 'active' then
    raise exception 'Only an active lease can have a move-out recorded';
  end if;

  update public.leases set move_out_date = p_move_out_date, status = 'ended' where id = p_lease_id
  returning * into v_lease;

  for v_charge in
    select id, period from public.charges
    where lease_id = p_lease_id and kind = 'rent' and period >= date_trunc('month', p_move_out_date)::date
    order by period
  loop
    v_new := public.rent_charge_cents(v_lease, v_charge.period);
    v_value := public.charge_value_cents(v_charge.id);
    continue when v_new >= v_value;
    perform public.release_down_to(v_charge.id, v_new);
    v_reason := case
      when v_new = 0 then 'Moved out ' || p_move_out_date || ': no rent after the move-out'
      else 'Moved out ' || p_move_out_date || ': prorated to ' || public.occupied_days(v_lease, v_charge.period)
           || ' of ' || public.days_in_month(v_charge.period) || ' days'
    end;
    insert into public.charge_adjustments (charge_id, amount_cents, reason, effective_on)
    values (v_charge.id, v_new - v_value, v_reason, p_move_out_date);
  end loop;

  perform public.apply_credit(p_lease_id);
end;
$$;
grant execute on function public.move_out(uuid, date) to authenticated;

-- The ledger gains adjustment rows, and money released by an adjustment is
-- dated on the adjustment's day.
create or replace view public.lease_ledger with (security_invoker = true) as
with entries as (
  select c.lease_id, c.owner_id, c.due_date as entry_date, 1 as sort_order, 'charge'::text as entry_type,
         c.description, c.id as ref_id, c.amount_cents, null::bigint as allocation_cents, c.created_at, c.created_by
  from public.charges c
  union all
  select c.lease_id, ad.owner_id, ad.effective_on, 1, 'adjustment',
         ad.reason, ad.id, ad.amount_cents, null, ad.created_at, ad.created_by
  from public.charge_adjustments ad
  join public.charges c on c.id = ad.charge_id
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
         case when a.amount_cents < 0
              then coalesce(
                r.reversed_on,
                (select max(ad.effective_on) from public.charge_adjustments ad
                  where ad.charge_id = a.charge_id and ad.created_at = a.created_at),
                greatest(p.paid_on, c.due_date))
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
