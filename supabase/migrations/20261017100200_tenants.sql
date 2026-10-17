-- US-04 Tenants (FR-04), with RLS for US-02.

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null constraint tenants_name_not_blank check (btrim(full_name) <> ''),
  email text,
  phone text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  -- US-04 AC2: "Add a phone number or email".
  constraint tenants_contact_required check (coalesce(btrim(email), '') <> '' or coalesce(btrim(phone), '') <> ''),
  constraint tenants_id_owner_key unique (id, owner_id)
);
create index tenants_owner_idx on public.tenants (owner_id);

create trigger tenants_stamp before insert on public.tenants for each row execute function public.stamp_row();

alter table public.tenants enable row level security;
create policy "own tenants: read" on public.tenants for select to authenticated using (owner_id = (select auth.uid()));
create policy "own tenants: add" on public.tenants for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own tenants: edit" on public.tenants for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

grant select, insert, update on public.tenants to authenticated;
revoke all on public.tenants from anon;
