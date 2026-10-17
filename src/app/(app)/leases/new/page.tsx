import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { firstOfNextMonth, oneYearLeaseEnd, todayISO } from "@/lib/dates";
import { NewLeaseForm } from "../forms";

export const metadata = { title: "New lease" };

type UnitRow = { id: string; label: string; property: { name: string; archived_at: string | null } };

// US-05 Create a lease. Defaults: starts on the 1st of next month, runs one year, due on the 1st.
export default async function NewLeasePage({ searchParams }: { searchParams: Promise<{ unit?: string; tenant?: string }> }) {
  const { unit, tenant } = await searchParams;
  const supabase = await createClient();
  const [{ data: unitData }, { data: tenantData }] = await Promise.all([
    supabase.from("units").select("id, label, property:properties(name, archived_at)").is("archived_at", null),
    supabase.from("tenants").select("id, full_name").is("archived_at", null).order("full_name"),
  ]);
  const units = ((unitData ?? []) as unknown as UnitRow[])
    .filter((u) => !u.property.archived_at)
    .map((u) => ({ id: u.id, label: `${u.property.name} · ${u.label}` }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const tenants = (tenantData ?? []).map((t) => ({ id: t.id, label: t.full_name }));
  const start = firstOfNextMonth(todayISO());

  return (
    <>
      <p>
        <Link href="/leases">← Leases</Link>
      </p>
      <h1>New lease</h1>
      {units.length === 0 || tenants.length === 0 ? (
        <div className="empty">
          {units.length === 0 && (
            <p>
              <Link href="/properties">Add a property with at least one unit</Link> first.
            </p>
          )}
          {tenants.length === 0 && (
            <p>
              <Link href="/tenants">Add a tenant</Link> first.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="muted">The lease is saved as a draft. You&apos;ll record the deposit and activate it on the next page.</p>
          <NewLeaseForm
            units={units}
            tenants={tenants}
            defaults={{
              unit_id: unit ?? (units.length === 1 ? units[0].id : undefined),
              tenant_id: tenant ?? (tenants.length === 1 ? tenants[0].id : undefined),
              start_date: start,
              end_date: oneYearLeaseEnd(start),
            }}
          />
        </>
      )}
    </>
  );
}
