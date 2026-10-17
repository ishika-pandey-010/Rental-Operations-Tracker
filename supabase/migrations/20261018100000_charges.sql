-- US-10 Generate monthly charges (FR-08) · US-11 Prorate the first month (FR-09)

-- What a tenant owes. Rent rows have a period (the 1st of the month);
-- 'deposit_shortfall' rows (US-19, D-09) don't.
create table public.charges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lease_id uuid not null,
  kind text not null constraint charges_kind_values check (kind in ('rent', 'deposit_shortfall')),
  period date,
  amount_cents bigint not null constraint charges_amount_positive check (amount_cents > 0),
  due_date date not null,
  description text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  constraint charges_rent_has_period check (
    kind <> 'rent' or (period is not null and period = date_trunc('month', period)::date)
  ),
  constraint charges_lease_fk foreign key (lease_id, owner_id) references public.leases (id, owner_id),
  constraint charges_id_owner_key unique (id, owner_id)
);
-- US-10, R-01, D-06: one rent charge per lease per month, whatever runs it.
create unique index charges_one_rent_per_period on public.charges (lease_id, period) where kind = 'rent';
create index charges_owner_due_idx on public.charges (owner_id, due_date);

create trigger charges_stamp before insert on public.charges for each row execute function public.stamp_row();
create trigger charges_append_only before update or delete on public.charges
  for each row execute function public.reject_ledger_change();
create trigger charges_no_truncate before truncate on public.charges
  for each statement execute function public.reject_truncate();

alter table public.charges enable row level security;
create policy "own charges: read" on public.charges for select to authenticated using (owner_id = (select auth.uid()));
create policy "own charges: add" on public.charges for insert to authenticated with check (owner_id = (select auth.uid()));
grant select, insert on public.charges to authenticated;
revoke all on public.charges from anon;

-- D-04, R-05, R-09: the one proration rule. rent × days ÷ days in month,
-- half-up to the cent, in integer arithmetic. A full month is the full rent.
create or replace function public.prorate_cents(p_monthly_cents bigint, p_days int, p_days_in_month int)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_days <= 0 then 0::bigint
    when p_days >= p_days_in_month then p_monthly_cents
    else (p_monthly_cents * p_days * 2 + p_days_in_month) / (p_days_in_month * 2)
  end;
$$;

-- D-05: the rent in force for a month is the latest schedule row on or before it.
create or replace function public.rent_for_period(p_lease_id uuid, p_period date)
returns bigint
language sql
stable
set search_path = ''
as $$
  select monthly_rent_cents
  from public.lease_rent_schedule
  where lease_id = p_lease_id and effective_period <= p_period
  order by effective_period desc
  limit 1;
$$;

-- US-11, US-09, D-27: days a lease occupies in a month. They run from the
-- later of the start and the 1st to the earlier of the move-out (or end)
-- and the month's last day, both inclusive.
create or replace function public.occupied_days(p_lease public.leases, p_period date)
returns int
language sql
stable
set search_path = ''
as $$
  select greatest(
    0,
    least(coalesce(p_lease.move_out_date, p_lease.end_date), (p_period + interval '1 month' - interval '1 day')::date)
      - greatest(p_lease.start_date, p_period) + 1
  )::int;
$$;

create or replace function public.days_in_month(p_period date)
returns int
language sql
immutable
set search_path = ''
as $$
  select extract(day from (date_trunc('month', p_period) + interval '1 month' - interval '1 day'))::int;
$$;

-- What a lease owes for one month.
create or replace function public.rent_charge_cents(p_lease public.leases, p_period date)
returns bigint
language sql
stable
set search_path = ''
as $$
  select public.prorate_cents(
    public.rent_for_period(p_lease.id, p_period),
    public.occupied_days(p_lease, p_period),
    public.days_in_month(p_period)
  );
$$;

-- The landlord-facing description, saying when and why a month is prorated.
create or replace function public.rent_charge_description(p_lease public.leases, p_period date)
returns text
language sql
stable
set search_path = ''
as $$
  select 'Rent ' || to_char(p_period, 'FMMonth YYYY')
    || case
         when public.occupied_days(p_lease, p_period) < public.days_in_month(p_period)
         then '. Prorated: ' || public.occupied_days(p_lease, p_period) || ' of ' || public.days_in_month(p_period) || ' days'
         else ''
       end;
$$;

-- D-23: due on the lease's due day, but never before the tenant moves in.
create or replace function public.rent_due_date(p_lease public.leases, p_period date)
returns date
language sql
stable
set search_path = ''
as $$
  select greatest(p_period + (p_lease.due_day - 1), p_lease.start_date);
$$;

-- D-26: every money operation on a lease takes this lock first.
create or replace function public.lock_lease(p_lease_id uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended(p_lease_id::text, 0));
$$;

-- US-10: create the month's rent for every lease that covers it. Running it
-- again, or twice at once, creates nothing new (AC2, AC3). Runs as the
-- caller, so RLS limits it to the caller's leases.
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
    v_created := v_created + v_rows;
  end loop;
  return query select v_created, v_eligible - v_created;
end;
$$;

grant execute on function public.generate_rent_charges(date) to authenticated;
grant execute on function public.prorate_cents(bigint, int, int) to authenticated;
