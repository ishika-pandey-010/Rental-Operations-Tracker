-- US-18 Deposit deductions (FR-15) · US-19 Refund or amount owed (FR-16)
-- D-08 deposits stay out of the rent ledger · D-09 excess becomes a charge
-- D-20 a refunds row records the refund being paid; pending is derived

create table public.deposit_deductions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lease_id uuid not null,
  amount_cents bigint not null constraint deposit_deductions_amount_positive check (amount_cents > 0),
  reason text not null constraint deposit_deductions_reason_not_blank check (btrim(reason) <> ''),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  constraint deposit_deductions_lease_fk foreign key (lease_id, owner_id) references public.leases (id, owner_id)
);
create index deposit_deductions_lease_idx on public.deposit_deductions (lease_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lease_id uuid not null constraint refunds_lease_id_key unique,
  amount_cents bigint not null constraint refunds_amount_not_negative check (amount_cents >= 0),
  paid_on date not null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  constraint refunds_lease_fk foreign key (lease_id, owner_id) references public.leases (id, owner_id)
);

create trigger deposit_deductions_stamp before insert on public.deposit_deductions for each row execute function public.stamp_row();
create trigger refunds_stamp before insert on public.refunds for each row execute function public.stamp_row();
create trigger deposit_deductions_append_only before update or delete on public.deposit_deductions
  for each row execute function public.reject_ledger_change();
create trigger deposit_deductions_no_truncate before truncate on public.deposit_deductions
  for each statement execute function public.reject_truncate();
create trigger refunds_append_only before update or delete on public.refunds
  for each row execute function public.reject_ledger_change();
create trigger refunds_no_truncate before truncate on public.refunds
  for each statement execute function public.reject_truncate();

alter table public.deposit_deductions enable row level security;
alter table public.refunds enable row level security;
create policy "own deductions: read" on public.deposit_deductions for select to authenticated using (owner_id = (select auth.uid()));
create policy "own deductions: add" on public.deposit_deductions for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own refunds: read" on public.refunds for select to authenticated using (owner_id = (select auth.uid()));
create policy "own refunds: add" on public.refunds for insert to authenticated with check (owner_id = (select auth.uid()));
grant select, insert on public.deposit_deductions, public.refunds to authenticated;
revoke all on public.deposit_deductions, public.refunds from anon;

create or replace function public.deposit_held_cents(p_lease_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select held_cents from public.lease_deposit_summary where lease_id = p_lease_id;
$$;

create or replace function public.deductions_cents(p_lease_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(amount_cents), 0)::bigint from public.deposit_deductions where lease_id = p_lease_id;
$$;

-- US-19, D-09: refund = max(0, held − deductions); the excess is owed.
create or replace function public.refund_due_cents(p_lease_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select greatest(0, public.deposit_held_cents(p_lease_id) - public.deductions_cents(p_lease_id));
$$;

create or replace function public.cents_text(p_cents bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select (case when p_cents < 0 then '-' else '' end) || (abs(p_cents) / 100)::text || '.' || lpad((abs(p_cents) % 100)::text, 2, '0');
$$;

-- US-18: deductions only once the lease has ended and before the refund is paid.
create or replace function public.enforce_deduction_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.lock_lease(new.lease_id);
  if not exists (select 1 from public.leases where id = new.lease_id and status = 'ended') then
    raise exception 'Deductions are recorded after the lease ends';
  end if;
  if exists (select 1 from public.refunds where lease_id = new.lease_id) then
    raise exception 'The refund is already paid, so the deposit is closed';
  end if;
  return new;
end;
$$;
create trigger deposit_deductions_rules before insert on public.deposit_deductions
  for each row execute function public.enforce_deduction_rules();

-- US-19 AC2, D-09: deductions above the deposit become a charge for the
-- part not charged yet, and any credit the tenant has pays it.
create or replace function public.charge_deposit_shortfall()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owed bigint;
  v_charged bigint;
begin
  v_owed := greatest(0, public.deductions_cents(new.lease_id) - public.deposit_held_cents(new.lease_id));
  select coalesce(sum(amount_cents), 0) into v_charged
  from public.charges where lease_id = new.lease_id and kind = 'deposit_shortfall';
  if v_owed > v_charged then
    insert into public.charges (owner_id, lease_id, kind, amount_cents, due_date, description)
    values (new.owner_id, new.lease_id, 'deposit_shortfall', v_owed - v_charged, current_date, 'Deductions above deposit');
    perform public.apply_credit(new.lease_id);
  end if;
  return null;
end;
$$;
create trigger deposit_deductions_shortfall after insert on public.deposit_deductions
  for each row execute function public.charge_deposit_shortfall();

-- US-19 AC3: a refund row must carry exactly the amount due, on an ended lease.
create or replace function public.enforce_refund_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_due bigint;
begin
  perform public.lock_lease(new.lease_id);
  if not exists (select 1 from public.leases where id = new.lease_id and status = 'ended') then
    raise exception 'A refund is paid after the lease ends';
  end if;
  v_due := public.refund_due_cents(new.lease_id);
  if new.amount_cents <> v_due then
    raise exception 'The refund must be exactly the deposit held minus deductions: %', public.cents_text(v_due);
  end if;
  return new;
end;
$$;
create trigger refunds_rules before insert on public.refunds
  for each row execute function public.enforce_refund_rules();

create or replace function public.pay_refund(p_lease_id uuid, p_amount_cents bigint, p_paid_on date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.refunds (lease_id, amount_cents, paid_on) values (p_lease_id, p_amount_cents, p_paid_on)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.pay_refund(uuid, bigint, date) to authenticated;

-- US-19, D-20: where each lease's deposit stands. Derived, never stored.
create view public.lease_refund_status with (security_invoker = true) as
select
  l.id as lease_id,
  l.owner_id,
  ds.held_cents,
  coalesce(dd.total, 0)::bigint as deductions_cents,
  greatest(0, ds.held_cents - coalesce(dd.total, 0))::bigint as refund_due_cents,
  greatest(0, coalesce(dd.total, 0) - ds.held_cents)::bigint as owed_cents,
  case
    when r.id is not null then 'paid'
    when l.status <> 'ended' then 'not_due'
    when ds.held_cents = 0 then 'nothing_held'
    else 'pending'
  end as status,
  r.paid_on,
  r.amount_cents as refunded_cents
from public.leases l
join public.lease_deposit_summary ds on ds.lease_id = l.id
left join (select lease_id, sum(amount_cents) as total from public.deposit_deductions group by lease_id) dd on dd.lease_id = l.id
left join public.refunds r on r.lease_id = l.id;

grant select on public.lease_refund_status to authenticated;
revoke all on public.lease_refund_status from anon;
