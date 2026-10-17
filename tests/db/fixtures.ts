// Small builders for test data. Each one runs as whichever user the
// connection is currently acting as, so RLS applies to fixtures too.
import type { Db } from "./helpers";

export async function addProperty(db: Db, name = "12 Elm St", units: string[] = ["A"]) {
  const { id } = await db.one<{ id: string }>(
    "select create_property($1, $2, $3) as id",
    [name, null, units],
  );
  const rows = await db.many<{ id: string; label: string }>(
    "select id, label from units where property_id = $1 order by label",
    [id],
  );
  return { propertyId: id, unitIds: rows.map((r) => r.id) };
}

export async function addTenant(db: Db, fullName = "Sam Okafor", email: string | null = "sam@example.com") {
  const { id } = await db.one<{ id: string }>(
    "insert into tenants (full_name, email) values ($1, $2) returning id",
    [fullName, email],
  );
  return id;
}

export type LeaseInput = {
  unitId: string;
  tenantId: string;
  start?: string;
  end?: string;
  rentCents?: number;
  dueDay?: number;
};

export async function createLease(db: Db, input: LeaseInput) {
  const { id } = await db.one<{ id: string }>(
    "select create_lease($1, $2, $3, $4, $5, $6) as id",
    [
      input.unitId,
      input.tenantId,
      input.start ?? "2026-11-01",
      input.end ?? "2027-10-31",
      input.rentCents ?? 120000,
      input.dueDay ?? 1,
    ],
  );
  return id;
}

export async function recordDeposit(db: Db, leaseId: string, cents = 120000, receivedOn = "2026-10-25") {
  await db.query("insert into deposits (lease_id, amount_cents, received_on) values ($1, $2, $3)", [
    leaseId,
    cents,
    receivedOn,
  ]);
}

export async function activate(db: Db, leaseId: string) {
  await db.query("update leases set status = 'active' where id = $1", [leaseId]);
}

/** A unit, a tenant and an active lease with a 1,200.00 deposit. */
export async function activeLease(db: Db, overrides: Partial<LeaseInput> & { unitLabel?: string } = {}) {
  const { unitIds } = await addProperty(db, `${overrides.unitLabel ?? "Elm"} ${Math.random().toString(36).slice(2, 7)}`, [
    overrides.unitLabel ?? "A",
  ]);
  const tenantId = overrides.tenantId ?? (await addTenant(db));
  const leaseId = await createLease(db, { ...overrides, unitId: overrides.unitId ?? unitIds[0], tenantId });
  await recordDeposit(db, leaseId);
  await activate(db, leaseId);
  return { leaseId, unitId: overrides.unitId ?? unitIds[0], tenantId };
}

export async function leaseStatus(db: Db, leaseId: string) {
  return (await db.one<{ status: string }>("select status from leases where id = $1", [leaseId])).status;
}
