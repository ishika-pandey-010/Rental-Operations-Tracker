// US-08 Renew a lease (FR-18, D-10)
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, expectDbError, type Db } from "./helpers";
import { activeLease, generate, leaseStatus, moveOut, refundStatus, renew, rentCharges } from "./fixtures";

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

describe("US-08 Renew a lease", () => {
  it("TC-LEASE-10 Given an active lease ending 2027-10-31, when I renew it from 2027-11-01 to 2028-10-31, then a new lease is linked to the old one and the old one ends on 2027-10-31", async () => {
    const { leaseId } = await activeLease(db);
    const next = await renew(db, leaseId);
    const row = await db.one("select renewed_from_id, start_date, end_date, status from leases where id = $1", [next]);
    expect(row).toEqual({ renewed_from_id: leaseId, start_date: "2027-11-01", end_date: "2028-10-31", status: "draft" });
    expect(await db.one("select status, move_out_date from leases where id = $1", [leaseId])).toEqual({
      status: "ended",
      move_out_date: "2027-10-31",
    });
  });

  it("TC-LEASE-11 Given the old lease holds a 1,200.00 deposit, when I renew with the deposit carried over, then the new lease shows it, is active, and no refund is pending on the old lease", async () => {
    const { leaseId } = await activeLease(db);
    const next = await renew(db, leaseId, { carry: true });
    expect(await leaseStatus(db, next)).toBe("active");
    expect((await refundStatus(db, next)).held_cents).toBe(120000);
    expect(await refundStatus(db, leaseId)).toMatchObject({ held_cents: 0, status: "nothing_held" });
    expect(await db.many("select lease_id from pending_refunds('2027-12-01')")).toEqual([]);
    const carried = await db.one("select amount_cents, carried_from_lease_id from deposits where lease_id = $1", [next]);
    expect(carried).toEqual({ amount_cents: 120000, carried_from_lease_id: leaseId });
  });

  it("Given a renewal without carrying the deposit, when the old lease ends, then its refund is pending and the new lease waits as a draft", async () => {
    const { leaseId } = await activeLease(db);
    await renew(db, leaseId, { carry: false });
    expect((await refundStatus(db, leaseId)).status).toBe("pending");
  });

  it("Given a renewal, when October and November are generated, then October is the old rent on the old lease and November the new rent on the new lease", async () => {
    const { leaseId } = await activeLease(db);
    const next = await renew(db, leaseId, { carry: true, rentCents: 125000 });
    await generate(db, "2027-10-01");
    await generate(db, "2027-11-01");
    expect((await rentCharges(db, leaseId)).map((c) => [c.period, c.amount_cents])).toEqual([["2027-10-01", 120000]]);
    expect((await rentCharges(db, next)).map((c) => [c.period, c.amount_cents])).toEqual([["2027-11-01", 125000]]);
  });

  it("Given a renewal start on or before the old lease's end, when I renew, then it's refused", async () => {
    const { leaseId } = await activeLease(db);
    const err = await expectDbError(() => renew(db, leaseId, { start: "2027-10-31" }));
    expect(err.message).toBe("A renewal starts after the current lease ends (2027-10-31)");
    expect(await leaseStatus(db, leaseId)).toBe("active");
  });

  it("Given an ended lease, when I renew it, then it's refused", async () => {
    const { leaseId } = await activeLease(db);
    await moveOut(db, leaseId, "2027-02-10");
    const err = await expectDbError(() => renew(db, leaseId));
    expect(err.message).toBe("Only an active lease can be renewed");
  });
});
