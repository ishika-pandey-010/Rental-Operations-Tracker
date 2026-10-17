-- US-07 Change rent mid-lease (FR-07, D-05): a new schedule row from a month
-- that isn't charged yet; charges already made never change.

create or replace function public.enforce_rent_schedule_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_lease public.leases;
  v_charged date;
begin
  perform public.lock_lease(new.lease_id);
  select * into v_lease from public.leases where id = new.lease_id;
  if v_lease.status = 'ended' then
    raise exception 'This lease has ended, so its rent can''t change';
  end if;
  if new.effective_period > v_lease.end_date then
    raise exception 'The lease ends before that month';
  end if;
  select min(period) into v_charged
  from public.charges
  where lease_id = new.lease_id and kind = 'rent' and period >= new.effective_period;
  if v_charged is not null then
    raise exception '% is already charged; choose a later month', to_char(v_charged, 'FMMonth');
  end if;
  return new;
end;
$$;
create trigger lease_rent_schedule_rules before insert on public.lease_rent_schedule
  for each row execute function public.enforce_rent_schedule_rules();

create or replace function public.change_rent(p_lease_id uuid, p_from date, p_monthly_rent_cents bigint)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.lease_rent_schedule (lease_id, effective_period, monthly_rent_cents)
  values (p_lease_id, date_trunc('month', p_from)::date, p_monthly_rent_cents);
$$;
grant execute on function public.change_rent(uuid, date, bigint) to authenticated;
