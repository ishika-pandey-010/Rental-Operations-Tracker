// One landlord's history that puts at least one row in every table.
// The RLS suite (rls.test.ts) fails if a table is left empty here, so
// extend this whenever a migration adds a table.
import type { Db } from "./helpers";
import { addProperty, addTenant } from "./fixtures";

export async function everyTableScenario(db: Db) {
  const { propertyId, unitIds } = await addProperty(db, "A House", ["1", "2"]);
  const tenantId = await addTenant(db, "A Tenant", "a.tenant@example.com");
  return { propertyId, unitIds, tenantId };
}
