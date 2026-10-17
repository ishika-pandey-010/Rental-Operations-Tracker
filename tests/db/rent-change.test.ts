// US-07 Change rent mid-lease (FR-07, D-05)
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, expectDbError, type Db } from "./helpers";
import { activeLease, generate, moveOut, rentCharges } from "./fixtures";

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

const changeRent = (leaseId: string, from: string, cents: number) =>
  db.query("select change_rent($1, $2, $3)", [leaseId, from, cents]);

describe("US-07 Change rent mid-lease", () => {
  it("TC-LEASE-08 Given an active lease at 1,200.00 with Nov and Dec charged, when I set 1,250.00 from 2027-01, then January is 1,250.00 and Nov and Dec stay 1,200.00", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2026-11-01");
    await generate(db, "2026-12-01");
    await changeRent(leaseId, "2027-01-01", 125000);
    await generate(db, "2027-01-01");
    expect((await rentCharges(db, leaseId)).map((c) => [c.period, c.amount_cents])).toEqual([
      ["2026-11-01", 120000],
      ["2026-12-01", 120000],
      ["2027-01-01", 125000],
    ]);
  });

  it("TC-LEASE-09 Given January is already charged, when I set a rent change from 2027-01, then I see 'January is already charged; choose a later month' and nothing changes", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-01-01");
    const err = await expectDbError(() => changeRent(leaseId, "2027-01-01", 125000));
    expect(err.message).toBe("January is already charged; choose a later month");
    const rows = await db.many("select effective_period from lease_rent_schedule where lease_id = $1", [leaseId]);
    expect(rows).toEqual([{ effective_period: "2026-11-01" }]);
  });

  it("Given February is charged but January isn't, when I set a change from January, then it names February as the month in the way", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-02-01");
    const err = await expectDbError(() => changeRent(leaseId, "2027-01-01", 125000));
    expect(err.message).toBe("February is already charged; choose a later month");
  });

  it("Given a schedule row written directly by SQL for a charged month, when it's inserted, then the trigger refuses it too", async () => {
    const { leaseId } = await activeLease(db);
    await generate(db, "2027-01-01");
    const err = await expectDbError(() =>
      db.query("insert into lease_rent_schedule (lease_id, effective_period, monthly_rent_cents) values ($1, '2027-01-01', 1)", [leaseId]),
    );
    expect(err.message).toBe("January is already charged; choose a later month");
  });

  it("Given any day in the month, when I set a change, then it takes effect from the 1st", async () => {
    const { leaseId } = await activeLease(db);
    await changeRent(leaseId, "2027-03-17", 130000);
    expect(await db.many("select effective_period from lease_rent_schedule where lease_id = $1 order by 1", [leaseId])).toEqual([
      { effective_period: "2026-11-01" },
      { effective_period: "2027-03-01" },
    ]);
  });

  it("Given a month after the lease ends, when I set a change from it, then it's refused", async () => {
    const { leaseId } = await activeLease(db);
    const err = await expectDbError(() => changeRent(leaseId, "2027-11-01", 130000));
    expect(err.message).toBe("The lease ends before that month");
  });

  it("Given an ended lease, when I set a change, then it's refused", async () => {
    const { leaseId } = await activeLease(db);
    await moveOut(db, leaseId, "2027-02-10");
    const err = await expectDbError(() => changeRent(leaseId, "2027-06-01", 130000));
    expect(err.message).toBe("This lease has ended, so its rent can't change");
  });

  it("Given a change already set from March, when I set March again, then it's refused as a duplicate", async () => {
    const { leaseId } = await activeLease(db);
    await changeRent(leaseId, "2027-03-01", 130000);
    const err = await expectDbError(() => changeRent(leaseId, "2027-03-01", 135000));
    expect(err.constraint).toBe("lease_rent_schedule_lease_period_key");
  });
});
