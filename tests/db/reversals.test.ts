// US-15 Reverse a bounced payment (FR-13, NFR-02)
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, expectDbError, type Db } from "./helpers";
import { activeLease, balance, credit, generate, leaseWithNovDec, recordPayment, rentCharges, reversePayment } from "./fixtures";

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

async function decemberOnly() {
  const lease = await activeLease(db, { start: "2026-12-01", end: "2027-11-30" });
  await generate(db, "2026-12-01");
  return { ...lease, dec: (await rentCharges(db, lease.leaseId))[0].id };
}

describe("US-15 Reverse a bounced payment", () => {
  it("TC-PAY-10 Given a 1,200.00 payment fully allocated to December, when I reverse it with reason 'bounced', then December's balance returns to 1,200.00 and the payment shows as reversed", async () => {
    const { leaseId, dec } = await decemberOnly();
    const p = await recordPayment(db, leaseId, 120000);
    await reversePayment(db, p, "bounced");
    expect(await balance(db, dec)).toEqual({ allocated_cents: 0, balance_cents: 120000, status: "open" });
    const row = await db.one("select reversed, value_cents, unallocated_cents from payment_balances where payment_id = $1", [p]);
    expect(row).toEqual({ reversed: true, value_cents: 0, unallocated_cents: 0 });
    const original = await db.one("select amount_cents from payments where id = $1", [p]);
    expect(original.amount_cents).toBe(120000); // the payment itself is untouched
  });

  it("TC-PAY-11 Given any payment, when someone deletes it by SQL as the database owner, then the delete is rejected", async () => {
    const { leaseId } = await decemberOnly();
    const p = await recordPayment(db, leaseId, 120000);
    await db.asAdmin();
    const err = await expectDbError(() => db.query("delete from payments where id = $1", [p]));
    expect(err.message).toBe("payments rows are never changed or deleted; add a correcting row instead");
  });

  it("Given a payment split across November and December, when it's reversed, then both charges get their money back", async () => {
    const { leaseId, nov, dec } = await leaseWithNovDec(db);
    const p = await recordPayment(db, leaseId, 150000);
    await reversePayment(db, p);
    expect((await balance(db, nov)).balance_cents).toBe(120000);
    expect((await balance(db, dec)).balance_cents).toBe(120000);
  });

  it("Given an overpayment that left 300.00 credit, when it's reversed, then the credit is gone too", async () => {
    const { leaseId } = await decemberOnly();
    const p = await recordPayment(db, leaseId, 150000);
    expect(await credit(db, leaseId)).toBe(30000);
    await reversePayment(db, p);
    expect(await credit(db, leaseId)).toBe(0);
  });

  it("Given other credit on the lease, when a payment is reversed, then that credit fills the reopened charge", async () => {
    const { leaseId, dec } = await decemberOnly();
    const good = await recordPayment(db, leaseId, 50000, { allocations: [] }); // held as credit
    const bounced = await recordPayment(db, leaseId, 120000, { allocations: [{ charge_id: dec, amount_cents: 120000 }] });
    await reversePayment(db, bounced);
    expect(await balance(db, dec)).toMatchObject({ allocated_cents: 50000, balance_cents: 70000 });
    expect(await credit(db, leaseId)).toBe(0);
    expect(good).toBeTruthy();
  });

  it("Given a payment already reversed, when I reverse it again, then it's refused", async () => {
    const { leaseId } = await decemberOnly();
    const p = await recordPayment(db, leaseId, 1000);
    await reversePayment(db, p);
    const err = await expectDbError(() => reversePayment(db, p));
    expect(err.constraint).toBe("payment_reversals_payment_id_key");
  });

  it("Given a reversed payment, when someone allocates it to a charge by SQL, then it's refused", async () => {
    const { leaseId, dec } = await decemberOnly();
    const p = await recordPayment(db, leaseId, 1000, { allocations: [] });
    await reversePayment(db, p);
    const err = await expectDbError(() =>
      db.query("insert into payment_allocations (payment_id, charge_id, amount_cents) values ($1, $2, 1000)", [p, dec]),
    );
    expect(err.message).toBe("This payment was reversed, so it can't pay anything");
  });

  it("Given a reversal with a blank reason, when it's saved, then it's refused (Add a reason)", async () => {
    const { leaseId } = await decemberOnly();
    const p = await recordPayment(db, leaseId, 1000);
    const err = await expectDbError(() => reversePayment(db, p, "  "));
    expect(err.constraint).toBe("payment_reversals_reason_not_blank");
  });

  it("Given a reversal written straight into payment_reversals by SQL, when it's saved, then the allocations are released all the same", async () => {
    const { leaseId, dec } = await decemberOnly();
    const p = await recordPayment(db, leaseId, 120000);
    await db.query("insert into payment_reversals (payment_id, reversed_on, reason) values ($1, '2026-12-05', 'bounced')", [p]);
    expect((await balance(db, dec)).balance_cents).toBe(120000);
  });

  it("Given a reversal, when I read the ledger, then it shows the reversal and the balance goes back up, and still ties out (TC-PAY-13)", async () => {
    const { leaseId } = await decemberOnly();
    const p = await recordPayment(db, leaseId, 120000, { paidOn: "2026-12-02" });
    await reversePayment(db, p, "bounced", "2026-12-05");
    const rows = await db.many<{ entry_type: string; description: string; amount_cents: number; balance_cents: number }>(
      "select entry_type, description, amount_cents, balance_cents from lease_ledger where lease_id = $1 and entry_type <> 'allocation' order by seq",
      [leaseId],
    );
    expect(rows).toEqual([
      { entry_type: "charge", description: "Rent December 2026", amount_cents: 120000, balance_cents: 120000 },
      { entry_type: "payment", description: "Payment, bank transfer", amount_cents: -120000, balance_cents: 0 },
      { entry_type: "reversal", description: "Payment reversed: bounced", amount_cents: 120000, balance_cents: 120000 },
    ]);
    const release = await db.one<{ entry_date: string; description: string }>(
      "select entry_date, description from lease_ledger where lease_id = $1 and entry_type = 'allocation' and allocation_cents < 0",
      [leaseId],
    );
    expect(release).toEqual({ entry_date: "2026-12-05", description: "Released from Rent December 2026" });
  });
});
