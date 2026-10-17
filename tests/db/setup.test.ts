// US-03 Properties and units · US-04 Tenants
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, expectDbError, type Db } from "./helpers";
import { activeLease, addProperty, addTenant } from "./fixtures";

let db: Db;
let landlord: string;

beforeAll(async () => {
  db = await connect();
});
afterAll(async () => {
  await db.end();
});
beforeEach(async () => {
  landlord = await createUser(db);
  await db.asUser(landlord);
});

describe("US-03 Properties and units", () => {
  it("Given a new account, when I list properties, then the list is empty (first use)", async () => {
    expect(await db.many("select id from properties")).toEqual([]);
  });

  it("TC-SETUP-01 Given I'm signed in, when I add '12 Elm St' with units A and B, then both units appear under that property", async () => {
    const { propertyId } = await addProperty(db, "12 Elm St", ["A", "B"]);
    const units = await db.many<{ label: string }>(
      "select label from units where property_id = $1 order by label",
      [propertyId],
    );
    expect(units.map((u) => u.label)).toEqual(["A", "B"]);
  });

  it("Given I type unit labels with stray spaces and a blank, when I save, then the labels are trimmed and the blank is ignored", async () => {
    const { unitIds } = await addProperty(db, "4 Oak Rd", [" A ", "", "B"]);
    expect(unitIds).toHaveLength(2);
  });

  it("TC-SETUP-02 Given a property already has unit A, when I add another unit A, then it's refused as a duplicate label", async () => {
    const { propertyId } = await addProperty(db, "12 Elm St", ["A"]);
    const err = await expectDbError(() =>
      db.query("insert into units (property_id, label) values ($1, 'A')", [propertyId]),
    );
    expect(err.constraint).toBe("units_property_id_label_key");
  });

  it("Given I leave the property name blank, when I save, then it's refused", async () => {
    const err = await expectDbError(() => addProperty(db, "  ", ["A"]));
    expect(err.constraint).toBe("properties_name_not_blank");
  });

  it("TC-SETUP-03 Given unit A has an active lease, when I archive unit A, then I see 'Unit has an active lease' and it stays active", async () => {
    const { unitId } = await activeLease(db);
    const err = await expectDbError(() =>
      db.query("update units set archived_at = now() where id = $1", [unitId]),
    );
    expect(err.message).toBe("Unit has an active lease");
    const { archived_at } = await db.one("select archived_at from units where id = $1", [unitId]);
    expect(archived_at).toBeNull();
  });

  it("TC-SETUP-04 Given unit B has no lease, when I archive unit B, then it's archived", async () => {
    const { unitIds } = await addProperty(db, "12 Elm St", ["A", "B"]);
    await db.query("update units set archived_at = now() where id = $1", [unitIds[1]]);
    const active = await db.many("select label from units where archived_at is null");
    expect(active).toEqual([{ label: "A" }]);
  });

  it("Given a unit of a property has an active lease, when I archive the property, then I see 'Property has a unit with an active lease'", async () => {
    const { unitId } = await activeLease(db);
    const { property_id } = await db.one<{ property_id: string }>(
      "select property_id from units where id = $1",
      [unitId],
    );
    const err = await expectDbError(() =>
      db.query("update properties set archived_at = now() where id = $1", [property_id]),
    );
    expect(err.message).toBe("Property has a unit with an active lease");
  });
});

describe("US-04 Tenants", () => {
  it("TC-SETUP-05 Given I'm on Tenants, when I add a tenant with a name and email, then the tenant appears in the list", async () => {
    await addTenant(db, "Sam Okafor", "sam@example.com");
    expect(await db.many("select full_name from tenants")).toEqual([{ full_name: "Sam Okafor" }]);
  });

  it("Given a tenant with a name and only a phone number, when I save, then the tenant is saved", async () => {
    await db.query("insert into tenants (full_name, phone) values ('Ana Ruiz', '555-0101')");
    expect(await db.many("select full_name from tenants")).toHaveLength(1);
  });

  it("TC-SETUP-06 Given a tenant with neither phone nor email, when I save, then it's refused (Add a phone number or email)", async () => {
    const err = await expectDbError(() =>
      db.query("insert into tenants (full_name, email, phone) values ('Sam', '  ', null)"),
    );
    expect(err.constraint).toBe("tenants_contact_required");
  });

  it("TC-SETUP-07 Given a tenant exists, when I change the phone number, then the new number is stored", async () => {
    const id = await addTenant(db);
    await db.query("update tenants set phone = '555-0199' where id = $1", [id]);
    expect((await db.one("select phone from tenants where id = $1", [id])).phone).toBe("555-0199");
  });

  it("Given a tenant has an active lease, when I archive the tenant, then I see 'Tenant has an active lease'", async () => {
    const { tenantId } = await activeLease(db);
    const err = await expectDbError(() =>
      db.query("update tenants set archived_at = now() where id = $1", [tenantId]),
    );
    expect(err.message).toBe("Tenant has an active lease");
  });
});
