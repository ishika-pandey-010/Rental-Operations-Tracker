// US-16 Lease ledger (FR-21, NFR-04)
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, type Db } from "./helpers";
import { credit, generate, leaseWithNovDec, recordPayment } from "./fixtures";

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

type Row = {
  entry_date: string;
  entry_type: string;
  description: string;
  amount_cents: number;
  allocation_cents: number | null;
  balance_cents: number;
};

async function ledger(leaseId: string) {
  return db.many<Row>(
    "select entry_date, entry_type, description, amount_cents, allocation_cents, balance_cents from lease_ledger where lease_id = $1 order by seq",
    [leaseId],
  );
}

describe("US-16 Lease ledger", () => {
  it("TC-PAY-12 Given charges, payments and allocations on a lease, when I open its ledger, then every row is in date order with a running balance", async () => {
    const { leaseId } = await leaseWithNovDec(db);
    await recordPayment(db, leaseId, 100000, { paidOn: "2026-11-03", reference: "NOV" });
    await recordPayment(db, leaseId, 150000, { paidOn: "2026-12-02", reference: "DEC" });
    await generate(db, "2027-01-01");
    const rows = await ledger(leaseId);
    expect(rows.map((r) => [r.entry_date, r.entry_type, r.amount_cents, r.balance_cents])).toEqual([
      ["2026-11-01", "charge", 120000, 120000],
      ["2026-11-03", "payment", -100000, 20000],
      ["2026-11-03", "allocation", 0, 20000],
      ["2026-12-01", "charge", 120000, 140000],
      ["2026-12-02", "payment", -150000, -10000],
      ["2026-12-02", "allocation", 0, -10000],
      ["2026-12-02", "allocation", 0, -10000],
      ["2027-01-01", "charge", 120000, 110000],
      ["2027-01-01", "allocation", 0, 110000],
    ]);
    const dates = rows.map((r) => r.entry_date);
    expect([...dates].sort()).toEqual(dates);
    expect(rows[8]).toMatchObject({ description: "Credit applied to Rent January 2027", allocation_cents: 10000 });
    expect(rows[2]).toMatchObject({ description: "Applied to Rent November 2026", allocation_cents: 100000 });
  });

  it("TC-PAY-13 Given a lease with history, when I compare the final running balance with charge balances minus credit, then they're equal", async () => {
    const { leaseId } = await leaseWithNovDec(db);
    await recordPayment(db, leaseId, 50000, { paidOn: "2026-11-05" });
    await recordPayment(db, leaseId, 300000, { paidOn: "2026-12-09" });
    await generate(db, "2027-01-01");
    await recordPayment(db, leaseId, 12345, { paidOn: "2027-01-03" });
    const rows = await ledger(leaseId);
    const final = rows[rows.length - 1].balance_cents;
    const { owed } = await db.one<{ owed: number }>(
      "select coalesce(sum(balance_cents), 0)::bigint as owed from charge_balances where lease_id = $1",
      [leaseId],
    );
    expect(final).toBe(owed - (await credit(db, leaseId)));
  });

  it("Given a deposit on the lease, when I open the rent ledger, then the deposit isn't in it (TC-DEP-01, D-08)", async () => {
    const { leaseId } = await leaseWithNovDec(db);
    const rows = await ledger(leaseId);
    expect(rows.some((r) => /deposit/i.test(r.description))).toBe(false);
  });
});
