-- US-03 Properties and units (FR-03), with RLS for US-02 (FR-02, NFR-03).

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null constraint properties_name_not_blank check (btrim(name) <> ''),
  address text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  -- D-21: children reference (id, owner_id) so they can't point at another landlord's row.
  constraint properties_id_owner_key unique (id, owner_id)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  label text not null constraint units_label_not_blank check (btrim(label) <> ''),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  constraint units_property_fk foreign key (property_id, owner_id) references public.properties (id, owner_id),
  -- US-03 AC3: "Unit label already used in this property". Archived units count too (OQ-08).
  constraint units_property_id_label_key unique (property_id, label),
  constraint units_id_owner_key unique (id, owner_id)
);
create index units_owner_idx on public.units (owner_id);

create trigger properties_stamp before insert on public.properties for each row execute function public.stamp_row();
create trigger units_stamp before insert on public.units for each row execute function public.stamp_row();

-- Labels are stored trimmed so " A" and "A" are the same unit.
create or replace function public.trim_unit_label()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.label := btrim(new.label);
  return new;
end;
$$;
create trigger units_trim_label before insert or update of label on public.units
  for each row execute function public.trim_unit_label();

alter table public.properties enable row level security;
alter table public.units enable row level security;

create policy "own properties: read" on public.properties for select to authenticated using (owner_id = (select auth.uid()));
create policy "own properties: add" on public.properties for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own properties: edit" on public.properties for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "own units: read" on public.units for select to authenticated using (owner_id = (select auth.uid()));
create policy "own units: add" on public.units for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own units: edit" on public.units for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

grant select, insert, update on public.properties, public.units to authenticated;
revoke all on public.properties, public.units from anon;

-- US-03 AC1: a property and its units in one call, so "12 Elm St with units
-- A and B" is one form and one round trip. Blank labels are skipped.
create or replace function public.create_property(p_name text, p_address text, p_unit_labels text[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.properties (name, address)
  values (btrim(p_name), nullif(btrim(coalesce(p_address, '')), ''))
  returning id into v_id;

  insert into public.units (property_id, label)
  select distinct v_id, btrim(l)
  from unnest(coalesce(p_unit_labels, '{}')) as l
  where btrim(l) <> '';

  return v_id;
end;
$$;
grant execute on function public.create_property(text, text, text[]) to authenticated;
