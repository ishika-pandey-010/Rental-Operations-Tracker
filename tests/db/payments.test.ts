// US-12 Record a payment (FR-10, NFR-05) · US-13 Partial payments (FR-11) · US-14 Credit (FR-12)
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, expectDbError, type Db } from "./helpers";
import {
  activeLease, addProperty, addTenant, balance, createLease, credit, generate, leaseWithNovDec, recordPayment, rentCharges,
} from "./fixtures";

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

/** An active lease with only December 2026 charged. */
async function decemberOnly() {
  const lease = await activeLease(db, { start: "2026-12-01", end: "2027-11-30" });
  await generate(db, "2026-12-01");
  const [dec] = await rentCharges(db, lease.leaseId);
  return { ...lease, dec: dec.id };
}

describe("US-12 Record a payment", () => {
  it("TC-PAY-01 Given an active lease, when I record 1,200.00 paid 2026-12-02 by bank transfer ref TRX-881, then it's stored with my user and a timestamp", async () => {
    const { leaseId } = await decemberOnly();
    const id = await recordPayment(db, leaseId, 120000, { paidOn: "2026-12-02", method: "bank_transfer", reference: "TRX-881" });
    const p = await db.one("select amount_cents, paid_on, method, reference, created_by, created_at from payments where id = $1", [id]);
    expect(p).toMatchObject({ amount_cents: 120000, paid_on: "2026-12-02", method: "bank_transfer", reference: "TRX-881", created_by: landlord });
    expect(p.created_at).toBeInstanceOf(Date);
  });

  it("TC-PAY-02 Given TRX-881 is already recorded on this lease, when I record another payment with TRX-881, then it's refused", async () => {
    const { leaseId } = await decemberOnly();
    await recordPayment(db, leaseId, 50000, { reference: "TRX-881" });
    const err = await expectDbError(() => recordPayment(db, leaseId, 50000, { reference: "trx-881 " }));
    expect(err.constraint).toBe("payments_reference_per_lease");
  });

  it("Given TRX-881 is used on a different lease, when I record TRX-881 here, then it's allowed (unique within a lease)", async () => {
    const a = await decemberOnly();
    const b = await decemberOnly();
    await recordPayment(db, a.leaseId, 1000, { reference: "TRX-881" });
    await recordPayment(db, b.leaseId, 1000, { reference: "TRX-881" });
  });

  it("Given two cash payments with no reference, when I record both, then both are kept (D-24)", async () => {
    const { leaseId } = await decemberOnly();
    await recordPayment(db, leaseId, 1000, { method: "cash", reference: null });
    await recordPayment(db, leaseId, 1000, { method: "cash", reference: "  " });
    const { n } = await db.one<{ n: number }>("select count(*)::int as n from payments where lease_id = $1", [leaseId]);
    expect(n).toBe(2);
  });

  it("TC-PAY-03 Given I enter 0 or a negative amount, when I save, then it's refused (Amount must be more than zero)", async () => {
    const { leaseId } = await decemberOnly();
    for (const cents of [0, -500]) {
      const err = await expectDbError(() => recordPayment(db, leaseId, cents));
      expect(err.constraint).toBe("payments_amount_positive");
    }
  });

  it("Given a draft lease, when I record a payment on it, then it's refused", async () => {
    const { unitIds } = await addProperty(db, "Draft House", ["1"]);
    const draft = await createLease(db, { unitId: unitIds[0], tenantId: await addTenant(db) });
    const err = await expectDbError(() => recordPayment(db, draft, 1000));
    expect(err.message).toBe("Activate the lease before recording payments");
  });

  it("Given a payment, when someone edits or deletes it by SQL, then both are refused (NFR-02)", async () => {
    const { leaseId } = await decemberOnly();
    const id = await recordPayment(db, leaseId, 1000);
    await db.asAdmin();
    const upd = await expectDbError(() => db.query("update payments set amount_cents = 1 where id = $1", [id]));
    expect(upd.message).toBe("payments rows are never changed or deleted; add a correcting row instead");
  });
});

describe("US-13 Partial payments", () => {
  it("TC-PAY-04 Given a December charge of 1,200.00, when I record 500.00, then it shows paid 500.00, balance 700.00, status partial", async () => {
    const { leaseId, dec } = await decemberOnly();
    await recordPayment(db, leaseId, 50000);
    expect(await balance(db, dec)).toEqual({ allocated_cents: 50000, balance_cents: 70000, status: "partial" });
  });

  it("Given a charge with nothing paid, when I look at it, then its status is open", async () => {
    const { dec } = await decemberOnly();
    expect(await balance(db, dec)).toEqual({ allocated_cents: 0, balance_cents: 120000, status: "open" });
  });

  it("TC-PAY-05 Given Nov balance 200.00 and Dec 1,200.00, when I record 700.00 with default allocation, then 200.00 goes to Nov and 500.00 to Dec", async () => {
    const { leaseId, nov, dec } = await leaseWithNovDec(db);
    await recordPayment(db, leaseId, 100000, { paidOn: "2026-11-02" }); // leaves Nov at 200.00
    expect((await balance(db, nov)).balance_cents).toBe(20000);
    await recordPayment(db, leaseId, 70000);
    expect(await balance(db, nov)).toMatchObject({ balance_cents: 0, status: "paid" });
    expect(await balance(db, dec)).toMatchObject({ balance_cents: 70000, allocated_cents: 50000, status: "partial" });
  });

  it("TC-PAY-06 Given the same charges, when I allocate 700.00 manually all to Dec, then Dec balance is 500.00 and Nov is still 200.00", async () => {
    const { leaseId, nov, dec } = await leaseWithNovDec(db);
    await recordPayment(db, leaseId, 100000, { paidOn: "2026-11-02" });
    await recordPayment(db, leaseId, 70000, { allocations: [{ charge_id: dec, amount_cents: 70000 }] });
    expect((await balance(db, dec)).balance_cents).toBe(50000);
    expect((await balance(db, nov)).balance_cents).toBe(20000);
  });

  it("Given a manual allocation of only part of a payment, when it's saved, then the rest is held as credit and not spread automatically", async () => {
    const { leaseId, nov, dec } = await leaseWithNovDec(db);
    await recordPayment(db, leaseId, 70000, { allocations: [{ charge_id: dec, amount_cents: 30000 }] });
    expect((await balance(db, dec)).allocated_cents).toBe(30000);
    expect((await balance(db, nov)).allocated_cents).toBe(0);
    expect(await credit(db, leaseId)).toBe(40000);
  });

  it("TC-PAY-07 Given a December charge of 1,200.00 with 500.00 allocated, when 800.00 more is allocated to it by SQL, then the database rejects it", async () => {
    const { leaseId, dec } = await decemberOnly();
    await recordPayment(db, leaseId, 50000);
    const extra = await recordPayment(db, leaseId, 80000, { allocations: [] });
    const err = await expectDbError(() =>
      db.query("insert into payment_allocations (payment_id, charge_id, amount_cents) values ($1, $2, 80000)", [extra, dec]),
    );
    expect(err.message).toBe("This would allocate more to the charge than it's worth");
  });

  it("Given a 300.00 payment, when 400.00 of it is allocated by SQL, then the database rejects it", async () => {
    const { leaseId, dec } = await decemberOnly();
    const p = await recordPayment(db, leaseId, 30000, { allocations: [] });
    const err = await expectDbError(() =>
      db.query("insert into payment_allocations (payment_id, charge_id, amount_cents) values ($1, $2, 40000)", [p, dec]),
    );
    expect(err.message).toBe("This would allocate more of the payment than it's worth");
  });

  it("Given a payment on lease X, when it's allocated to a charge on lease Y, then the database rejects it", async () => {
    const x = await decemberOnly();
    const y = await decemberOnly();
    const p = await recordPayment(db, x.leaseId, 30000, { allocations: [] });
    const err = await expectDbError(() =>
      db.query("insert into payment_allocations (payment_id, charge_id, amount_cents) values ($1, $2, 100)", [p, y.dec]),
    );
    expect(err.message).toBe("A payment can only pay charges on its own lease");
  });

  it("R-02 Given one 1,200.00 charge, when two 1,000.00 payments are recorded at the same moment, then the charge gets exactly 1,200.00 and 800.00 is credit", async () => {
    const { leaseId, dec } = await decemberOnly();
    const [first, second] = [await connect(), await connect()];
    try {
      await first.asUser(landlord);
      await second.asUser(landlord);
      await Promise.all([recordPayment(first, leaseId, 100000), recordPayment(second, leaseId, 100000)]);
    } finally {
      await first.end();
      await second.end();
    }
    expect(await balance(db, dec)).toEqual({ allocated_cents: 120000, balance_cents: 0, status: "paid" });
    expect(await credit(db, leaseId)).toBe(80000);
  });
});

describe("US-14 Overpayment becomes credit", () => {
  it("TC-PAY-08 Given a December charge of 1,200.00 and no other open charges, when I record 1,500.00, then December is paid and the lease shows credit 300.00", async () => {
    const { leaseId, dec } = await decemberOnly();
    await recordPayment(db, leaseId, 150000);
    expect((await balance(db, dec)).status).toBe("paid");
    expect(await credit(db, leaseId)).toBe(30000);
  });

  it("TC-PAY-09 Given credit of 300.00, when January's 1,200.00 charge is generated, then 300.00 is allocated to it and its balance is 900.00", async () => {
    const { leaseId } = await decemberOnly();
    await recordPayment(db, leaseId, 150000);
    await generate(db, "2027-01-01");
    const jan = (await rentCharges(db, leaseId))[1];
    expect(await balance(db, jan.id)).toEqual({ allocated_cents: 30000, balance_cents: 90000, status: "partial" });
    expect(await credit(db, leaseId)).toBe(0);
  });

  it("Given a new lease with no payments, when I look at its credit, then it's 0.00 (empty state)", async () => {
    const { leaseId } = await decemberOnly();
    expect(await credit(db, leaseId)).toBe(0);
  });
});
