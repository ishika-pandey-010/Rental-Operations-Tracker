-- US-23 Dashboard (FR-23): four totals for one date, all derived (NFR-04).
create or replace function public.dashboard_totals(p_as_of date)
returns table (
  units_total int,
  units_occupied int,
  rent_due_cents bigint,
  rent_unpaid_cents bigint,
  overdue_cents bigint,
  deposits_held_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*)::int from public.units u
       join public.properties p on p.id = u.property_id
      where u.archived_at is null and p.archived_at is null),
    (select count(distinct l.unit_id)::int from public.leases l
      where l.status in ('active', 'ended') and l.start_date <= p_as_of
        and coalesce(l.move_out_date, l.end_date) >= p_as_of),
    (select coalesce(sum(cb.value_cents), 0)::bigint from public.charge_balances cb
      where cb.kind = 'rent' and cb.period = date_trunc('month', p_as_of)::date),
    (select coalesce(sum(cb.balance_cents), 0)::bigint from public.charge_balances cb
      where cb.kind = 'rent' and cb.period = date_trunc('month', p_as_of)::date),
    (select coalesce(sum(o.balance_cents), 0)::bigint from public.overdue_rent(p_as_of) o),
    (select coalesce(sum(rs.held_cents), 0)::bigint from public.lease_refund_status rs where rs.status <> 'paid');
$$;
grant execute on function public.dashboard_totals(date) to authenticated;
