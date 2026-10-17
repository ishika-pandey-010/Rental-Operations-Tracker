-- US-20 Overdue rent (FR-19) · US-21 Pending refunds (FR-20)
-- Both take an as-of date, so "today" is decided by the caller (OQ-19) and
-- UAT can fix the date (uat-plan.md §4). Both run as the caller, so RLS
-- limits them to the caller's own leases.

-- US-20: every charge past its due date with money still owed. A charge is
-- overdue from the day after it's due (OQ-05).
create or replace function public.overdue_rent(p_as_of date)
returns table (
  charge_id uuid,
  lease_id uuid,
  tenant_name text,
  unit_name text,
  description text,
  due_date date,
  balance_cents bigint,
  days_overdue int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select cb.charge_id, cb.lease_id, t.full_name, p.name || ' · ' || u.label, cb.description, cb.due_date,
         cb.balance_cents, (p_as_of - cb.due_date)::int
  from public.charge_balances cb
  join public.leases l on l.id = cb.lease_id
  join public.tenants t on t.id = l.tenant_id
  join public.units u on u.id = l.unit_id
  join public.properties p on p.id = u.property_id
  where cb.balance_cents > 0 and cb.due_date < p_as_of
  order by cb.due_date, p.name, u.label;
$$;

-- US-21, D-20: ended leases still holding a deposit with no refund paid.
create or replace function public.pending_refunds(p_as_of date)
returns table (
  lease_id uuid,
  tenant_name text,
  unit_name text,
  ended_on date,
  held_cents bigint,
  deductions_cents bigint,
  refund_due_cents bigint,
  days_since_end int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.id, t.full_name, p.name || ' · ' || u.label, l.move_out_date, rs.held_cents, rs.deductions_cents,
         rs.refund_due_cents, (p_as_of - l.move_out_date)::int
  from public.lease_refund_status rs
  join public.leases l on l.id = rs.lease_id
  join public.tenants t on t.id = l.tenant_id
  join public.units u on u.id = l.unit_id
  join public.properties p on p.id = u.property_id
  where rs.status = 'pending'
  order by l.move_out_date, p.name, u.label;
$$;

grant execute on function public.overdue_rent(date), public.pending_refunds(date) to authenticated;
