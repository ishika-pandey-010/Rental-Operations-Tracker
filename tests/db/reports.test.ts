// US-20 Overdue rent (FR-19) · US-21 Pending refunds (FR-20)
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, type Db } from "./helpers";
import { activeLease, addDeduction, endedLease, generate, moveOut, recordPayment, rentCharges } from "./fixtures";

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

const overdue = (asOf: string) =>
  db.many<{ tenant_name: string; unit_name: string; description: string; balance_cents: number; days_overdue: number; lease_id: string }>(
    "select tenant_name, unit_name, description, balance_cents, days_overdue, lease_id from overdue_rent($1)",
    [asOf],
  );
const pending = (asOf: string) =>
  db.many<{ lease_id: string; tenant_name: string; unit_name: string; ended_on: string; refund_due_cents: number; days_since_end: number }>(
    "select lease_id, tenant_name, unit_name, ended_on, refund_due_cents, days_since_end from pending_refunds($1)",
    [asOf],
  );

describe("US-20 Overdue rent", () => {
  it("Given no charges at all, when I open Overdue, then it's empty (first use)", async () => {
    expect(await overdue("2026-12-11")).toEqual([]);
  });

  it("TC-RPT-01 Given a charge due 2026-12-01 with balance 700.00 and today 2026-12-11, when I open Overdue, then it shows tenant, unit, 700.00 and 10 days", async () => {
    const { leaseId } = await activeLease(db, { start: "2026-12-01", end: "2027-11-30" });
    await generate(db, "2026-12-01");
    await recordPayment(db, leaseId, 50000);
    expect(await overdue("2026-12-11")).toEqual([
      { tenant_name: "Sam Okafor", unit_name: expect.stringMatching(/ · A$/), description: "Rent December 2026", balance_cents: 70000, days_overdue: 10, lease_id: leaseId },
    ]);
  });

  it("TC-RPT-02 Given a charge that's fully paid, when I open Overdue, then it doesn't appear", async () => {
    const { leaseId } = await activeLease(db, { start: "2026-12-01", end: "2027-11-30" });
    await generate(db, "2026-12-01");
    await recordPayment(db, leaseId, 120000);
    expect(await overdue("2026-12-11")).toEqual([]);
  });

  it("TC-RPT-03 Given a charge not yet due, or due today, when I open Overdue, then it doesn't appear (overdue from the day after, OQ-05)", async () => {
    await activeLease(db, { start: "2026-12-01", end: "2027-11-30" });
    await generate(db, "2026-12-01");
    expect(await overdue("2026-11-30")).toEqual([]);
    expect(await overdue("2026-12-01")).toEqual([]);
    expect(await overdue("2026-12-02")).toHaveLength(1);
  });

  it("Given a charge cancelled by a move-out, when I open Overdue, then it doesn't appear", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-03-01");
    await moveOut(db, leaseId, "2027-02-10");
    expect((await overdue("2027-04-01")).filter((r) => r.description.startsWith("Rent March"))).toEqual([]);
  });

  it("Given several overdue charges, when I open Overdue, then the oldest is first", async () => {
    await activeLease(db);
    await generate(db, "2026-11-01");
    await generate(db, "2026-12-01");
    expect((await overdue("2026-12-11")).map((r) => r.days_overdue)).toEqual([40, 10]);
  });

  it("Given a 'Deductions above deposit' charge left unpaid, when I open Overdue, then it's listed too", async () => {
    const { leaseId } = await endedLease(db);
    await addDeduction(db, leaseId, 140000, "repaint");
    const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    expect((await overdue(tomorrow)).map((r) => r.description)).toContain("Deductions above deposit");
  });

  it("Given another landlord's overdue charge, when I open Overdue, then I don't see it", async () => {
    await activeLease(db);
    await generate(db, "2026-11-01");
    await db.asUser(await createUser(db));
    expect(await overdue("2026-12-11")).toEqual([]);
  });
});

describe("US-21 Pending refunds", () => {
  it("TC-RPT-04 Given a lease ended 2027-02-10 with a pending refund, when I open Pending refunds, then it's listed with the amount and days since end", async () => {
    const { leaseId } = await endedLease(db);
    await addDeduction(db, leaseId, 15000);
    expect(await pending("2027-03-01")).toEqual([
      { lease_id: leaseId, tenant_name: "Sam Okafor", unit_name: expect.stringMatching(/ · A$/), ended_on: "2027-02-10", refund_due_cents: 105000, days_since_end: 19 },
    ]);
  });

  it("TC-RPT-05 Given the refund is marked paid, when I open Pending refunds, then the lease isn't listed", async () => {
    const { leaseId } = await endedLease(db);
    await db.query("select pay_refund($1, 120000, '2027-03-01')", [leaseId]);
    expect(await pending("2027-03-02")).toEqual([]);
  });

  it("Given an active lease holding a deposit, when I open Pending refunds, then it isn't listed", async () => {
    await activeLease(db);
    expect(await pending("2027-03-01")).toEqual([]);
  });

  it("Given an ended lease whose deductions used the whole deposit, when I open Pending refunds, then it's listed at 0.00 until it's closed", async () => {
    const { leaseId } = await endedLease(db);
    await addDeduction(db, leaseId, 120000, "repaint");
    expect((await pending("2027-03-01")).map((r) => r.refund_due_cents)).toEqual([0]);
  });
});
