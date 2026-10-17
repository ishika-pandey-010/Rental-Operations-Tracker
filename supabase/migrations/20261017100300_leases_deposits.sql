-- US-05 Create a lease (FR-05) · US-06 No active lease without a deposit
-- decision (FR-06) · US-17 Record a deposit (FR-14) · US-03 archive rules.

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unit_id uuid not null,
  tenant_id uuid not null,
  start_date date not null,
  end_date date not null,
  due_day smallint not null,
  status text not null default 'draft' constraint leases_status_values check (status in ('draft', 'active', 'ended')),
  move_out_date date,
  renewed_from_id uuid,
  deposit_waived_on date,
  deposit_waiver_reason text,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  -- US-05 AC2: "End date must be after start date".
  constraint leases_end_after_start check (end_date > start_date),
  -- Day 29-31 doesn't exist in every month, so a due day stops at 28.
  constraint leases_due_day_range check (due_day between 1 and 28),
  -- US-06 AC3: a waiver is a date and a reason, never half of one.
  constraint leases_waiver_complete check (
    (deposit_waived_on is null and deposit_waiver_reason is null)
    or (deposit_waived_on is not null and btrim(coalesce(deposit_waiver_reason, '')) <> '')
  ),
  constraint leases_move_out_in_term check (move_out_date is null or move_out_date between start_date and end_date),
  constraint leases_ended_has_move_out check (status <> 'ended' or move_out_date is not null),
  constraint leases_unit_fk foreign key (unit_id, owner_id) references public.units (id, owner_id),
  constraint leases_tenant_fk foreign key (tenant_id, owner_id) references public.tenants (id, owner_id),
  constraint leases_renewed_from_fk foreign key (renewed_from_id, owner_id) references public.leases (id, owner_id),
  constraint leases_id_owner_key unique (id, owner_id),
  -- US-05 AC3, FR-05: one unit never has two active leases over the same days.
  constraint leases_one_active_per_unit exclude using gist (
    unit_id extensions.gist_uuid_ops with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status = 'active')
);
create index leases_owner_idx on public.leases (owner_id);
create index leases_unit_idx on public.leases (unit_id);
create index leases_tenant_idx on public.leases (tenant_id);

-- D-05: rent lives in an effective-dated schedule so a change never rewrites old charges.
create table public.lease_rent_schedule (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lease_id uuid not null,
  effective_period date not null
    constraint lease_rent_schedule_period_is_month check (effective_period = date_trunc('month', effective_period)::date),
  monthly_rent_cents bigint not null constraint lease_rent_schedule_rent_positive check (monthly_rent_cents > 0),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  constraint lease_rent_schedule_lease_fk foreign key (lease_id, owner_id) references public.leases (id, owner_id),
  constraint lease_rent_schedule_lease_period_key unique (lease_id, effective_period)
);

-- US-17, D-08: deposits are their own ledger, one row per instalment, never rent.
create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lease_id uuid not null,
  amount_cents bigint not null constraint deposits_amount_positive check (amount_cents > 0),
  received_on date not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  constraint deposits_lease_fk foreign key (lease_id, owner_id) references public.leases (id, owner_id)
);
create index deposits_lease_idx on public.deposits (lease_id);

create trigger leases_stamp before insert on public.leases for each row execute function public.stamp_row();
create trigger lease_rent_schedule_stamp before insert on public.lease_rent_schedule for each row execute function public.stamp_row();
create trigger deposits_stamp before insert on public.deposits for each row execute function public.stamp_row();

-- NFR-02: the rent schedule and deposits only grow.
create trigger lease_rent_schedule_append_only before update or delete on public.lease_rent_schedule
  for each row execute function public.reject_ledger_change();
create trigger lease_rent_schedule_no_truncate before truncate on public.lease_rent_schedule
  for each statement execute function public.reject_truncate();
create trigger deposits_append_only before update or delete on public.deposits
  for each row execute function public.reject_ledger_change();
create trigger deposits_no_truncate before truncate on public.deposits
  for each statement execute function public.reject_truncate();

-- US-05, US-06: lease lifecycle. Runs for every writer, including the SQL
-- editor, so the deposit gate can't be skipped (US-06 AC4, TC-LEASE-07).
create or replace function public.enforce_lease_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'A new lease starts as draft';
    end if;
    if exists (select 1 from public.units where id = new.unit_id and archived_at is not null) then
      raise exception 'Unit is archived';
    end if;
    if exists (select 1 from public.tenants where id = new.tenant_id and archived_at is not null) then
      raise exception 'Tenant is archived';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not ((old.status = 'draft' and new.status = 'active') or (old.status = 'active' and new.status = 'ended')) then
      raise exception 'A lease goes from draft to active to ended, never back';
    end if;
    if new.status = 'active' then
      if new.deposit_waived_on is null and not exists (select 1 from public.deposits where lease_id = new.id) then
        raise exception 'Record a deposit or a waiver first';
      end if;
      if exists (select 1 from public.units where id = new.unit_id and archived_at is not null) then
        raise exception 'Unit is archived';
      end if;
    end if;
  end if;

  if old.status <> 'draft' then
    if (new.unit_id, new.tenant_id, new.start_date, new.end_date, new.due_day)
       is distinct from (old.unit_id, old.tenant_id, old.start_date, old.end_date, old.due_day) then
      raise exception 'An active lease''s unit, tenant, dates and due day can''t change; renew it instead';
    end if;
    if (new.deposit_waived_on, new.deposit_waiver_reason) is distinct from (old.deposit_waived_on, old.deposit_waiver_reason) then
      raise exception 'The deposit decision is fixed once a lease is active';
    end if;
  end if;

  if new.move_out_date is distinct from old.move_out_date and not (old.status = 'active' and new.status = 'ended') then
    raise exception 'A move-out date is set only when the lease ends';
  end if;
  return new;
end;
$$;
create trigger leases_rules before insert or update on public.leases
  for each row execute function public.enforce_lease_rules();

-- OQ-14: a deposit is taken before or during the tenancy, not after it ends.
create or replace function public.enforce_deposit_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.leases where id = new.lease_id and status = 'ended') then
    raise exception 'This lease has ended, so no more deposit can be added';
  end if;
  return new;
end;
$$;
create trigger deposits_rules before insert on public.deposits
  for each row execute function public.enforce_deposit_rules();

-- US-03 AC2 and OQ-09: nothing with an active lease can be archived.
create or replace function public.guard_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is null or old.archived_at is not null then
    return new;
  end if;
  if tg_table_name = 'units' and exists (
    select 1 from public.leases where unit_id = new.id and status = 'active'
  ) then
    raise exception 'Unit has an active lease';
  elsif tg_table_name = 'tenants' and exists (
    select 1 from public.leases where tenant_id = new.id and status = 'active'
  ) then
    raise exception 'Tenant has an active lease';
  elsif tg_table_name = 'properties' and exists (
    select 1 from public.leases l join public.units u on u.id = l.unit_id
    where u.property_id = new.id and l.status = 'active'
  ) then
    raise exception 'Property has a unit with an active lease';
  end if;
  return new;
end;
$$;
create trigger units_guard_archive before update of archived_at on public.units
  for each row execute function public.guard_archive();
create trigger tenants_guard_archive before update of archived_at on public.tenants
  for each row execute function public.guard_archive();
create trigger properties_guard_archive before update of archived_at on public.properties
  for each row execute function public.guard_archive();

-- US-05 AC1: a lease and its first rent row are written together or not at all.
create or replace function public.create_lease(
  p_unit_id uuid,
  p_tenant_id uuid,
  p_start date,
  p_end date,
  p_monthly_rent_cents bigint,
  p_due_day int
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.leases (unit_id, tenant_id, start_date, end_date, due_day)
  values (p_unit_id, p_tenant_id, p_start, p_end, p_due_day)
  returning id into v_id;

  insert into public.lease_rent_schedule (lease_id, effective_period, monthly_rent_cents)
  values (v_id, date_trunc('month', p_start)::date, p_monthly_rent_cents);

  return v_id;
end;
$$;

-- US-17: what's been received and what's held. Derived, never stored (NFR-04).
create view public.lease_deposit_summary with (security_invoker = true) as
select
  l.id as lease_id,
  l.owner_id,
  coalesce(sum(d.amount_cents), 0)::bigint as received_cents,
  coalesce(sum(d.amount_cents), 0)::bigint as held_cents
from public.leases l
left join public.deposits d on d.lease_id = l.id
group by l.id, l.owner_id;

alter table public.leases enable row level security;
alter table public.lease_rent_schedule enable row level security;
alter table public.deposits enable row level security;

create policy "own leases: read" on public.leases for select to authenticated using (owner_id = (select auth.uid()));
create policy "own leases: add" on public.leases for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own leases: edit" on public.leases for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "own rent schedule: read" on public.lease_rent_schedule for select to authenticated using (owner_id = (select auth.uid()));
create policy "own rent schedule: add" on public.lease_rent_schedule for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own deposits: read" on public.deposits for select to authenticated using (owner_id = (select auth.uid()));
create policy "own deposits: add" on public.deposits for insert to authenticated with check (owner_id = (select auth.uid()));

grant select, insert, update on public.leases to authenticated;
grant select, insert on public.lease_rent_schedule, public.deposits to authenticated;
grant select on public.lease_deposit_summary to authenticated;
grant execute on function public.create_lease(uuid, uuid, date, date, bigint, int) to authenticated;
revoke all on public.leases, public.lease_rent_schedule, public.deposits, public.lease_deposit_summary from anon;
