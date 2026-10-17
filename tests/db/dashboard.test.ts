// US-23 Dashboard (FR-23)
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, type Db } from "./helpers";
import { activeLease, addProperty, endedLease, generate, recordPayment } from "./fixtures";

let db: Db;
beforeAll(async () => {
  db = await connect();
});
afterAll(async () => {
  await db.end();
});
beforeEach(async () => {
  await db.asUser(await createUser(db));
});

const totals = (asOf: string) =>
  db.one<{
    units_total: number;
    units_occupied: number;
    rent_due_cents: number;
    rent_unpaid_cents: number;
    overdue_cents: number;
    deposits_held_cents: number;
  }>("select * from dashboard_totals($1)", [asOf]);

describe("US-23 Dashboard", () => {
  it("Given a new account, when I open the dashboard, then every total is zero", async () => {
    expect(await totals("2026-12-11")).toEqual({
      units_total: 0, units_occupied: 0, rent_due_cents: 0, rent_unpaid_cents: 0, overdue_cents: 0, deposits_held_cents: 0,
    });
  });

  it("TC-RPT-07 Given two leases and a spare unit, when I open the dashboard on 2026-12-11, then it shows units occupied, rent due this month, total overdue and deposits held", async () => {
    const a = await activeLease(db, { rentCents: 120000 });
    await activeLease(db, { rentCents: 95000, dueDay: 15 });
    await addProperty(db, "Spare", ["S1"]);
    await generate(db, "2026-12-01");
    await recordPayment(db, a.leaseId, 50000);
    expect(await totals("2026-12-11")).toEqual({
      units_total: 3,
      units_occupied: 2,
      rent_due_cents: 215000,
      rent_unpaid_cents: 165000,
      overdue_cents: 70000, // the 950.00 isn't due until the 15th
      deposits_held_cents: 240000,
    });
  });

  it("Given an ended lease whose refund is pending, when I open the dashboard, then its deposit still counts as held until the refund is paid", async () => {
    const { leaseId } = await endedLease(db);
    expect((await totals("2027-03-01")).deposits_held_cents).toBe(120000);
    await db.query("select pay_refund($1, 120000, '2027-03-01')", [leaseId]);
    expect((await totals("2027-03-01")).deposits_held_cents).toBe(0);
  });

  it("Given a lease that starts next year, when I open the dashboard now, then its unit isn't counted as occupied", async () => {
    await activeLease(db, { start: "2027-06-01", end: "2028-05-31" });
    expect(await totals("2026-12-11")).toMatchObject({ units_total: 1, units_occupied: 0 });
  });
});
