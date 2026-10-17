-- NFR-09: rebuilding the demo account means deleting it first, which the
-- append-only triggers (NFR-02) refuse. purge_account() is the single,
-- narrow exception: only the service role can call it, it marks its own
-- transaction with the owner being purged, and reject_ledger_change() lets
-- through deletes of that owner's rows only. Deleting the auth user cascades
-- to every table through owner_id. Logged as D-28.
create or replace function public.purge_account(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.purge_owner', p_owner::text, true);
  delete from auth.users where id = p_owner;
  perform set_config('app.purge_owner', '', true);
end;
$$;
revoke all on function public.purge_account(uuid) from public, anon, authenticated;
grant execute on function public.purge_account(uuid) to service_role;
