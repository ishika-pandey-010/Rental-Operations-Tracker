// US-18 Deposit deductions (FR-15) · US-19 Refund or amount owed (FR-16)
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, expectDbError, type Db } from "./helpers";
import { activeLease, addDeduction, addProperty, addTenant, createLease, credit, endedLease, recordDeposit, recordPayment, refundStatus } from "./fixtures";

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

async function payRefund(leaseId: string, cents: number, on = "2027-03-01") {
  await db.query("select pay_refund($1, $2, $3)", [leaseId, cents, on]);
}

describe("US-18 Deposit deductions", () => {
  it("TC-DEP-03 Given an ended lease with deposit 1,200.00, when I add a 150.00 deduction for carpet cleaning, then it's listed with its reason and the refund due becomes 1,050.00", async () => {
    const { leaseId } = await endedLease(db);
    await addDeduction(db, leaseId, 15000, "carpet cleaning");
    expect(await db.many("select amount_cents, reason from deposit_deductions where lease_id = $1", [leaseId])).toEqual([
      { amount_cents: 15000, reason: "carpet cleaning" },
    ]);
    expect((await refundStatus(db, leaseId)).refund_due_cents).toBe(105000);
  });

  it("TC-DEP-04 Given an ended lease, when I add a deduction with a blank reason, then it's refused (Add a reason)", async () => {
    const { leaseId } = await endedLease(db);
    const err = await expectDbError(() => addDeduction(db, leaseId, 15000, "  "));
    expect(err.constraint).toBe("deposit_deductions_reason_not_blank");
  });

  it("Given an active lease, when I add a deduction, then it's refused until the lease ends", async () => {
    const { leaseId } = await activeLease(db);
    const err = await expectDbError(() => addDeduction(db, leaseId, 15000));
    expect(err.message).toBe("Deductions are recorded after the lease ends");
  });

  it("Given a deduction, when someone edits it by SQL, then it's refused (NFR-02)", async () => {
    const { leaseId } = await endedLease(db);
    await addDeduction(db, leaseId, 15000);
    await db.asAdmin();
    const err = await expectDbError(() => db.query("update deposit_deductions set amount_cents = 1 where lease_id = $1", [leaseId]));
    expect(err.message).toBe("deposit_deductions rows are never changed or deleted; add a correcting row instead");
  });
});

describe("US-19 Refund or amount owed", () => {
  it("TC-DEP-05 Given deposit 1,200.00 and deductions 150.00, when I open the refund, then it's 1,050.00 and pending", async () => {
    const { leaseId } = await endedLease(db);
    await addDeduction(db, leaseId, 15000);
    expect(await refundStatus(db, leaseId)).toEqual({
      held_cents: 120000, deductions_cents: 15000, refund_due_cents: 105000, owed_cents: 0, status: "pending", paid_on: null,
    });
  });

  it("TC-DEP-06 Given deductions of 1,400.00 on a 1,200.00 deposit, when the refund is worked out, then it's 0.00 and a 200.00 'Deductions above deposit' charge is added", async () => {
    const { leaseId } = await endedLease(db);
    await addDeduction(db, leaseId, 100000, "repaint");
    await addDeduction(db, leaseId, 40000, "broken window");
    const s = await refundStatus(db, leaseId);
    expect(s).toMatchObject({ refund_due_cents: 0, owed_cents: 20000 });
    const charges = await db.many("select kind, amount_cents, description from charges where lease_id = $1 and kind = 'deposit_shortfall'", [leaseId]);
    expect(charges).toEqual([{ kind: "deposit_shortfall", amount_cents: 20000, description: "Deductions above deposit" }]);
  });

  it("Given a shortfall already charged, when a further deduction is added, then only the extra is charged", async () => {
    const { leaseId } = await endedLease(db);
    await addDeduction(db, leaseId, 140000, "repaint");
    await addDeduction(db, leaseId, 5000, "keys");
    const rows = await db.many<{ amount_cents: number }>(
      "select amount_cents from charges where lease_id = $1 and kind = 'deposit_shortfall' order by created_at, amount_cents",
      [leaseId],
    );
    expect(rows.map((r) => r.amount_cents).sort((a, b) => a - b)).toEqual([5000, 20000]);
  });

  it("Given the tenant has credit from prepaid rent, when a shortfall is charged, then the credit pays it", async () => {
    const { leaseId } = await activeLease(db);
    await recordPayment(db, leaseId, 30000, { allocations: [] }); // 300.00 credit, no charges yet
    await db.query("select move_out($1, '2027-02-10')", [leaseId]);
    await addDeduction(db, leaseId, 140000, "repaint");
    expect(await credit(db, leaseId)).toBe(10000);
  });

  it("Given a lease with no deposit (waived), when a 150.00 deduction is added after it ends, then all 150.00 is owed as a charge", async () => {
    const { unitIds } = await addProperty(db, "Waived House", ["1"]);
    const leaseId = await createLease(db, { unitId: unitIds[0], tenantId: await addTenant(db) });
    await db.query("update leases set deposit_waived_on = '2026-10-20', deposit_waiver_reason = 'Family' where id = $1", [leaseId]);
    await db.query("update leases set status = 'active' where id = $1", [leaseId]);
    await db.query("select move_out($1, '2027-02-10')", [leaseId]);
    await addDeduction(db, leaseId, 15000, "cleaning");
    expect(await refundStatus(db, leaseId)).toMatchObject({ held_cents: 0, refund_due_cents: 0, owed_cents: 15000 });
  });

  it("TC-DEP-07 Given a refund due of 1,050.00, when anyone saves a refund of 1,100.00 by SQL, then the database rejects it", async () => {
    const { leaseId } = await endedLease(db);
    await addDeduction(db, leaseId, 15000);
    const err = await expectDbError(() =>
      db.query("insert into refunds (lease_id, amount_cents, paid_on) values ($1, 110000, '2027-03-01')", [leaseId]),
    );
    expect(err.message).toBe("The refund must be exactly the deposit held minus deductions: 1050.00");
  });

  it("TC-DEP-08 Given a pending refund of 1,050.00, when I mark it paid on 2027-03-01, then it's paid with that date", async () => {
    const { leaseId } = await endedLease(db);
    await addDeduction(db, leaseId, 15000);
    await payRefund(leaseId, 105000, "2027-03-01");
    expect(await refundStatus(db, leaseId)).toMatchObject({ status: "paid", paid_on: "2027-03-01", refund_due_cents: 105000 });
  });

  it("Given the refund is paid, when another deduction is added, then it's refused", async () => {
    const { leaseId } = await endedLease(db);
    await payRefund(leaseId, 120000);
    const err = await expectDbError(() => addDeduction(db, leaseId, 1000));
    expect(err.message).toBe("The refund is already paid, so the deposit is closed");
  });

  it("Given a refund already paid, when it's paid again, then it's refused", async () => {
    const { leaseId } = await endedLease(db);
    await payRefund(leaseId, 120000);
    const err = await expectDbError(() => payRefund(leaseId, 120000));
    expect(err.constraint).toBe("refunds_lease_id_key");
  });

  it("Given an active lease, when a refund is recorded, then it's refused", async () => {
    const { leaseId } = await activeLease(db);
    const err = await expectDbError(() => payRefund(leaseId, 120000));
    expect(err.message).toBe("A refund is paid after the lease ends");
  });

  it("Given an active lease, when I look at its refund status, then it's 'not due' (empty state)", async () => {
    const { leaseId } = await activeLease(db);
    expect((await refundStatus(db, leaseId)).status).toBe("not_due");
  });

  it("Given deposits recorded in two instalments, when the refund is worked out, then both count", async () => {
    const lease = await activeLease(db, { start: "2026-11-01" });
    await recordDeposit(db, lease.leaseId, 30000, "2026-11-15");
    await db.query("select move_out($1, '2027-02-10')", [lease.leaseId]);
    expect((await refundStatus(db, lease.leaseId)).refund_due_cents).toBe(150000);
  });
});
