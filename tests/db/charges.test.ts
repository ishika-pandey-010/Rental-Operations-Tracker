// US-10 Generate monthly charges (FR-08) · US-11 Prorate the first month (FR-09)
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, expectDbError, type Db } from "./helpers";
import { activeLease, addProperty, addTenant, createLease, generate, rentCharges } from "./fixtures";

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

describe("US-10 Generate monthly charges", () => {
  it("Given no leases at all, when I generate a month, then nothing is created and nothing breaks (first use)", async () => {
    expect(await generate(db, "2026-12-01")).toEqual({ created: 0, existing: 0 });
  });

  it("TC-CHG-01 Given three active leases, when I generate charges for 2026-12, then three charges are created with each lease's rent and due date", async () => {
    const a = await activeLease(db, { rentCents: 120000, dueDay: 1 });
    const b = await activeLease(db, { rentCents: 95000, dueDay: 3 });
    const c = await activeLease(db, { rentCents: 150050, dueDay: 15 });
    expect(await generate(db, "2026-12-01")).toEqual({ created: 3, existing: 0 });
    expect(await rentCharges(db, a.leaseId)).toMatchObject([{ period: "2026-12-01", amount_cents: 120000, due_date: "2026-12-01" }]);
    expect(await rentCharges(db, b.leaseId)).toMatchObject([{ period: "2026-12-01", amount_cents: 95000, due_date: "2026-12-03" }]);
    expect(await rentCharges(db, c.leaseId)).toMatchObject([{ period: "2026-12-01", amount_cents: 150050, due_date: "2026-12-15" }]);
  });

  it("TC-CHG-02 Given charges for 2026-12 already exist, when I generate 2026-12 again, then 0 are new and 3 already existed", async () => {
    for (let i = 0; i < 3; i++) await activeLease(db);
    await generate(db, "2026-12-01");
    expect(await generate(db, "2026-12-01")).toEqual({ created: 0, existing: 3 });
    const { n } = await db.one<{ n: number }>("select count(*)::int as n from charges where period = '2026-12-01'");
    expect(n).toBe(3);
  });

  it("TC-CHG-03 Given two generation requests for the same month at the same moment, when both finish, then exactly one charge exists per lease", async () => {
    for (let i = 0; i < 3; i++) await activeLease(db);
    const [first, second] = [await connect(), await connect()];
    try {
      await first.asUser(landlord);
      await second.asUser(landlord);
      const results = await Promise.all([generate(first, "2026-12-01"), generate(second, "2026-12-01")]);
      expect(results.map((r) => r.created).sort()).toEqual([0, 3]);
    } finally {
      await first.end();
      await second.end();
    }
    const { n } = await db.one<{ n: number }>("select count(*)::int as n from charges where period = '2026-12-01'");
    expect(n).toBe(3);
  });

  it("TC-CHG-04 Given one draft and one active lease, when I generate charges, then only the active lease is charged", async () => {
    const active = await activeLease(db);
    const { unitIds } = await addProperty(db, "Draft House", ["1"]);
    const draft = await createLease(db, { unitId: unitIds[0], tenantId: await addTenant(db) });
    expect(await generate(db, "2026-12-01")).toEqual({ created: 1, existing: 0 });
    expect(await rentCharges(db, active.leaseId)).toHaveLength(1);
    expect(await rentCharges(db, draft)).toHaveLength(0);
  });

  it("TC-CHG-07 Given an active lease with due day 5, when I generate 2026-12, then the due date is 2026-12-05", async () => {
    const { leaseId } = await activeLease(db, { dueDay: 5 });
    await generate(db, "2026-12-01");
    expect((await rentCharges(db, leaseId))[0].due_date).toBe("2026-12-05");
  });

  it("Given a lease ending 2027-10-31, when I generate 2027-11, then it gets no charge", async () => {
    const { leaseId } = await activeLease(db);
    expect(await generate(db, "2027-11-01")).toEqual({ created: 0, existing: 0 });
    expect(await rentCharges(db, leaseId)).toEqual([]);
  });

  it("Given a lease that starts in January, when I generate December, then it gets no charge", async () => {
    await activeLease(db, { start: "2027-01-01", end: "2027-12-31" });
    expect(await generate(db, "2026-12-01")).toEqual({ created: 0, existing: 0 });
  });

  it("Given any date inside a month, when I generate, then the charge is for that month (period stored as the 1st)", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2026-12-17");
    expect((await rentCharges(db, leaseId))[0].period).toBe("2026-12-01");
  });

  it("Given a rent charge exists, when someone inserts the same lease and month again by SQL, then the unique index refuses it (R-01)", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2026-12-01");
    const err = await expectDbError(() =>
      db.query(
        `insert into charges (lease_id, kind, period, amount_cents, due_date, description)
         values ($1, 'rent', '2026-12-01', 120000, '2026-12-01', 'Rent December 2026')`,
        [leaseId],
      ),
    );
    expect(err.constraint).toBe("charges_one_rent_per_period");
  });

  it("Given a charge, when someone edits or deletes it by SQL, then both are refused (NFR-02)", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2026-12-01");
    await db.asAdmin();
    const upd = await expectDbError(() => db.query("update charges set amount_cents = 1 where lease_id = $1", [leaseId]));
    expect(upd.message).toBe("charges rows are never changed or deleted; add a correcting row instead");
    const del = await expectDbError(() => db.query("delete from charges where lease_id = $1", [leaseId]));
    expect(del.message).toBe("charges rows are never changed or deleted; add a correcting row instead");
  });

  it("Given a generated charge, when I check who created it, then it carries my user id (NFR-05)", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2026-12-01");
    const { created_by } = await db.one<{ created_by: string }>("select created_by from charges where lease_id = $1", [leaseId]);
    expect(created_by).toBe(landlord);
  });
});

describe("US-11 Prorate the first month", () => {
  it("TC-CHG-05 Given a lease starting 2026-11-16 at 1,200.00, when November is charged, then the charge is 600.00 (15 of 30 days) due on the start date", async () => {
    const { leaseId } = await activeLease(db, { start: "2026-11-16", end: "2027-11-15" });
    await generate(db, "2026-11-01");
    expect(await rentCharges(db, leaseId)).toMatchObject([{ amount_cents: 60000, due_date: "2026-11-16" }]);
  });

  it("TC-CHG-06 Given a lease starting on the 1st, when the first month is charged, then the charge is the full rent", async () => {
    const { leaseId } = await activeLease(db, { start: "2026-11-01" });
    await generate(db, "2026-11-01");
    expect((await rentCharges(db, leaseId))[0].amount_cents).toBe(120000);
  });

  it("Given a lease ending 2027-10-15, when October 2027 is charged, then it's prorated to 15 of 31 days, half-up (580.65)", async () => {
    const { leaseId } = await activeLease(db, { start: "2026-11-01", end: "2027-10-15" });
    await generate(db, "2027-10-01");
    expect((await rentCharges(db, leaseId))[0].amount_cents).toBe(58065);
  });

  it("Given the proration function, when it's given known cases, then it rounds half-up to the cent (R-05)", async () => {
    const rows = await db.many<{ v: number }>(
      `select prorate_cents(120000, 10, 28) as v union all select prorate_cents(120000, 15, 30)
       union all select prorate_cents(100, 1, 8) union all select prorate_cents(99, 1, 2) union all select prorate_cents(120000, 31, 31)`,
    );
    // 428.571… → 428.57 · 600.00 · 12.5 → 13 · 49.5 → 50 · whole month = full rent
    expect(rows.map((r) => r.v)).toEqual([42857, 60000, 13, 50, 120000]);
  });
});
