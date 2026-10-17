-- Shared building blocks used by every table in this schema.
--
-- Every table has owner_id, created_by and created_at (NFR-05). owner_id
-- defaults to the signed-in landlord and drives row-level security
-- (US-02, FR-02, NFR-03). created_by and created_at are stamped by a
-- trigger so a client can't backdate a row or pin it on someone else.

create extension if not exists btree_gist with schema extensions;

-- US-02: nobody signed out gets anything, and nothing is exposed by default.
-- Tables are granted to `authenticated` explicitly, one migration at a time.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, public;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

create or replace function public.stamp_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  -- auth.uid() is null for the seed script and the SQL editor; fall back to the owner.
  new.created_by := coalesce(auth.uid(), new.owner_id);
  return new;
end;
$$;

-- NFR-02: ledger rows are never updated or deleted. The one exception is
-- purge_account(), which deletes a whole account (demo reset, account
-- deletion) and marks its transaction with app.purge_owner.
create or replace function public.reject_ledger_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('app.purge_owner', true) = old.owner_id::text then
    return old;
  end if;
  raise exception '% rows are never changed or deleted; add a correcting row instead', tg_table_name
    using errcode = 'P0001';
end;
$$;

create or replace function public.reject_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are never changed or deleted; add a correcting row instead', tg_table_name
    using errcode = 'P0001';
end;
$$;
