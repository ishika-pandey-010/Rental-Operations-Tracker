// US-02 My data stays mine (FR-02, NFR-03)
// The suite is generic on purpose: it lists every table and view in the
// public schema, so a new table fails this file until it has RLS and the
// cross-account scenario puts a row in it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, createUser, expectDbError, type Db } from "./helpers";
import { everyTableScenario } from "./scenario";

let db: Db;
let landlordA: string;
let landlordB: string;
let a: Awaited<ReturnType<typeof everyTableScenario>>;
let tables: string[];
let views: string[];

beforeAll(async () => {
  db = await connect();
  landlordA = await createUser(db, "landlord-a");
  landlordB = await createUser(db, "landlord-b");
  await db.asUser(landlordA);
  a = await everyTableScenario(db);
  await db.asAdmin();
  tables = (
    await db.many<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by 1`,
    )
  ).map((r) => r.relname);
  views = (
    await db.many<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'v' order by 1`,
    )
  ).map((r) => r.relname);
});
afterAll(async () => {
  await db.end();
});

describe("US-02 My data stays mine", () => {
  it("TC-NFR-01 Given landlords A and B each have a property, when B lists properties, then B sees only B's property", async () => {
    await db.asUser(landlordB);
    await db.query("select create_property('B House', null, array['1'])");
    const names = await db.many("select name from properties");
    expect(names).toEqual([{ name: "B House" }]);
  });

  it("Given A's tenant ID, when B requests that tenant directly, then no row is returned", async () => {
    await db.asUser(landlordB);
    expect(await db.many("select * from tenants where id = $1", [a.tenantId])).toEqual([]);
  });

  it("Given A's property ID, when B tries to add a unit to it, then the insert is rejected", async () => {
    await db.asUser(landlordB);
    const err = await expectDbError(() =>
      db.query("insert into units (property_id, label) values ($1, 'X')", [a.propertyId]),
    );
    // Either the composite foreign key or the RLS check refuses it; both stop B.
    expect(["23503", "42501"]).toContain(err.code);
  });

  it("TC-NFR-02 Given A's lease ID, when B requests that lease directly, then no row is returned", async () => {
    await db.asUser(landlordB);
    expect(await db.many("select * from leases where id = $1", [a.leaseId])).toEqual([]);
  });

  it("TC-NFR-03 Given A's lease ID, when B tries to record a deposit against it, then the insert is rejected", async () => {
    await db.asUser(landlordB);
    const err = await expectDbError(() =>
      db.query("insert into deposits (lease_id, amount_cents, received_on) values ($1, 100, '2026-10-01')", [a.leaseId]),
    );
    // Either the composite foreign key or the RLS check refuses it; both stop B.
    expect(["23503", "42501"]).toContain(err.code);
  });

  it("Given B claims to be A by setting owner_id, when B inserts a property, then RLS rejects it", async () => {
    await db.asUser(landlordB);
    const err = await expectDbError(() =>
      db.query("insert into properties (owner_id, name) values ($1, 'Fake')", [landlordA]),
    );
    expect(err.code).toBe("42501");
  });

  it("Given A's tenant, when B tries to change the tenant's phone, then nothing changes", async () => {
    await db.asUser(landlordB);
    const res = await db.query("update tenants set phone = '000' where id = $1", [a.tenantId]);
    expect(res.rowCount).toBe(0);
    await db.asUser(landlordA);
    expect((await db.one("select phone from tenants where id = $1", [a.tenantId])).phone).not.toBe("000");
  });

  it("TC-NFR-04 Given every table in the schema, when the RLS suite runs, then each has RLS enabled and an owner_id column", async () => {
    await db.asAdmin();
    const rows = await db.many<{ relname: string; relrowsecurity: boolean; has_owner: boolean }>(
      `select c.relname, c.relrowsecurity,
              exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'owner_id') as has_owner
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by 1`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect({ table: r.relname, rls: r.relrowsecurity, owner: r.has_owner }).toEqual({ table: r.relname, rls: true, owner: true });
  });

  it("TC-NFR-04 Given A has a row in every table, when B reads every table and view, then B sees nothing of A's", async () => {
    await db.asUser(landlordA);
    for (const t of tables) {
      const { n } = await db.one<{ n: number }>(`select count(*)::int as n from ${t}`);
      expect({ table: t, aHasRows: n > 0 }).toEqual({ table: t, aHasRows: true });
    }
    const fresh = await createUser(db, "landlord-c");
    await db.asUser(fresh);
    for (const rel of [...tables, ...views]) {
      const { n } = await db.one<{ n: number }>(`select count(*)::int as n from ${rel}`);
      expect({ relation: rel, rowsVisible: n }).toEqual({ relation: rel, rowsVisible: 0 });
    }
  });

  it("Given someone who isn't signed in (anon role), when they read any table, then they get nothing", async () => {
    await db.asAdmin();
    await db.query("set role anon");
    for (const t of tables) {
      const err = await expectDbError(() => db.query(`select count(*) from ${t}`));
      expect(err.code).toBe("42501"); // permission denied: anon has no grants at all
    }
    await db.asAdmin();
  });
});
