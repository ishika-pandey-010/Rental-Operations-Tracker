// One landlord's history that puts at least one row in every table.
// The RLS suite (rls.test.ts) fails if a table is left empty here, so
// extend this whenever a migration adds a table.
import type { Db } from "./helpers";
import { activate, addProperty, addTenant, createLease, generate, recordDeposit, recordPayment, reversePayment } from "./fixtures";

export async function everyTableScenario(db: Db) {
  const { propertyId, unitIds } = await addProperty(db, "A House", ["1", "2"]);
  const tenantId = await addTenant(db, "A Tenant", "a.tenant@example.com");
  const leaseId = await createLease(db, { unitId: unitIds[0], tenantId });
  await recordDeposit(db, leaseId);
  await activate(db, leaseId);
  await generate(db, "2026-11-01");
  await recordPayment(db, leaseId, 50000, { paidOn: "2026-11-02" });
  await reversePayment(db, await recordPayment(db, leaseId, 1000, { paidOn: "2026-11-03" }));
  return { propertyId, unitIds, tenantId, leaseId };
}
