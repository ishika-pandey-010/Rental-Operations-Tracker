// US-09 Early move-out (FR-17, FR-09)
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, expectDbError, type Db } from "./helpers";
import {
  activeLease, addProperty, addTenant, balance, createLease, credit, generate, leaseStatus, moveOut, recordPayment, rentCharges,
} from "./fixtures";

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

async function chargeFor(leaseId: string, period: string) {
  return (await rentCharges(db, leaseId)).find((c) => c.period === period);
}

describe("US-09 Early move-out", () => {
  it("TC-LEASE-12 Given February isn't charged yet, when I record a move-out on 2027-02-10 and generate February, then the charge is 428.57 and the lease is ended", async () => {
    const { leaseId } = await activeLease(db);
    await moveOut(db, leaseId, "2027-02-10");
    expect(await leaseStatus(db, leaseId)).toBe("ended");
    await generate(db, "2027-02-01");
    const feb = await chargeFor(leaseId, "2027-02-01");
    expect(feb?.amount_cents).toBe(42857);
  });

  it("TC-LEASE-13 Given February was charged 1,200.00, when I record the move-out, then a -771.43 adjustment is added and the original charge stays as it was", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-02-01");
    const feb = (await chargeFor(leaseId, "2027-02-01"))!;
    await moveOut(db, leaseId, "2027-02-10");
    const adj = await db.many("select amount_cents, reason from charge_adjustments where charge_id = $1", [feb.id]);
    expect(adj).toEqual([{ amount_cents: -77143, reason: "Moved out 2027-02-10: prorated to 10 of 28 days" }]);
    expect((await chargeFor(leaseId, "2027-02-01"))!.amount_cents).toBe(120000);
    const b = await db.one("select value_cents, balance_cents from charge_balances where charge_id = $1", [feb.id]);
    expect(b).toEqual({ value_cents: 42857, balance_cents: 42857 });
  });

  it("TC-LEASE-14 Given the lease ended 2027-02-10, when March is generated, then this lease gets no charge", async () => {
    const { leaseId } = await activeLease(db);
    await moveOut(db, leaseId, "2027-02-10");
    expect(await generate(db, "2027-03-01")).toEqual({ created: 0, existing: 0 });
    expect(await chargeFor(leaseId, "2027-03-01")).toBeUndefined();
  });

  it("Given February was charged and fully paid, when the tenant moves out on the 10th, then 771.43 is released to credit and February stays paid", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-02-01");
    const feb = (await chargeFor(leaseId, "2027-02-01"))!;
    await recordPayment(db, leaseId, 120000, { paidOn: "2027-02-01" });
    await moveOut(db, leaseId, "2027-02-10");
    expect(await balance(db, feb.id)).toEqual({ allocated_cents: 42857, balance_cents: 0, status: "paid" });
    expect(await credit(db, leaseId)).toBe(77143);
  });

  it("Given March was charged in advance, when the tenant moves out in February, then March is cancelled to 0.00 and shows as cancelled", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-02-01");
    await generate(db, "2027-03-01");
    await moveOut(db, leaseId, "2027-02-10");
    const mar = (await chargeFor(leaseId, "2027-03-01"))!;
    expect(await db.one("select value_cents, status from charge_balances where charge_id = $1", [mar.id])).toEqual({
      value_cents: 0,
      status: "cancelled",
    });
  });

  it("Given earlier rent is unpaid, when money is released by a move-out, then it pays the older charge", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-01-01");
    await generate(db, "2027-02-01");
    const jan = (await chargeFor(leaseId, "2027-01-01"))!;
    const feb = (await chargeFor(leaseId, "2027-02-01"))!;
    await recordPayment(db, leaseId, 120000, { allocations: [{ charge_id: feb.id, amount_cents: 120000 }] });
    await moveOut(db, leaseId, "2027-02-10");
    expect((await balance(db, jan.id)).allocated_cents).toBe(77143);
    expect(await credit(db, leaseId)).toBe(0);
  });

  it("Given a move-out on the last day of a charged month, when it's recorded, then no adjustment is needed", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-02-01");
    await moveOut(db, leaseId, "2027-02-28");
    const { n } = await db.one<{ n: number }>(
      "select count(*)::int as n from charge_adjustments a join charges c on c.id = a.charge_id where c.lease_id = $1",
      [leaseId],
    );
    expect(n).toBe(0);
  });

  it("Given a move-out date after the lease end, when it's recorded, then it's refused", async () => {
    const { leaseId } = await activeLease(db);
    const err = await expectDbError(() => moveOut(db, leaseId, "2028-01-01"));
    expect(err.constraint).toBe("leases_move_out_in_term");
  });

  it("Given a draft lease, when a move-out is recorded, then it's refused", async () => {
    const { unitIds } = await addProperty(db, "Draft House", ["1"]);
    const draft = await createLease(db, { unitId: unitIds[0], tenantId: await addTenant(db) });
    const err = await expectDbError(() => moveOut(db, draft, "2027-02-10"));
    expect(err.message).toBe("Only an active lease can have a move-out recorded");
  });

  it("Given a paid charge, when an adjustment by SQL would leave it worth less than was paid toward it, then it's refused", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-02-01");
    const feb = (await chargeFor(leaseId, "2027-02-01"))!;
    await recordPayment(db, leaseId, 120000);
    const err = await expectDbError(() =>
      db.query("insert into charge_adjustments (charge_id, amount_cents, reason, effective_on) values ($1, -100, 'x', '2027-02-10')", [feb.id]),
    );
    expect(err.message).toBe("This adjustment would leave the charge worth less than has been paid toward it");
  });

  it("Given an adjustment, when someone edits it by SQL, then it's refused (NFR-02)", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-02-01");
    await moveOut(db, leaseId, "2027-02-10");
    await db.asAdmin();
    const err = await expectDbError(() => db.query("update charge_adjustments set amount_cents = -1"));
    expect(err.message).toBe("charge_adjustments rows are never changed or deleted; add a correcting row instead");
  });

  it("Given a move-out with adjustments, when I read the ledger, then the adjustment is a row on the move-out date and the balance still ties out (TC-PAY-13)", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-02-01");
    await recordPayment(db, leaseId, 50000, { paidOn: "2027-02-03" });
    await moveOut(db, leaseId, "2027-02-10");
    const rows = await db.many<{ entry_date: string; entry_type: string; amount_cents: number; balance_cents: number }>(
      "select entry_date, entry_type, amount_cents, balance_cents from lease_ledger where lease_id = $1 and entry_type <> 'allocation' order by seq",
      [leaseId],
    );
    expect(rows).toEqual([
      { entry_date: "2027-02-01", entry_type: "charge", amount_cents: 120000, balance_cents: 120000 },
      { entry_date: "2027-02-03", entry_type: "payment", amount_cents: -50000, balance_cents: 70000 },
      { entry_date: "2027-02-10", entry_type: "adjustment", amount_cents: -77143, balance_cents: -7143 },
    ]);
    const { owed } = await db.one<{ owed: number }>("select coalesce(sum(balance_cents),0)::bigint as owed from charge_balances where lease_id = $1", [leaseId]);
    expect(rows[2].balance_cents).toBe(owed - (await credit(db, leaseId)));
  });
});
