// US-05 Create a lease · US-06 Deposit gate · US-17 Record a deposit
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createUser, expectDbError, type Db } from "./helpers";
import { activate, activeLease, addProperty, addTenant, createLease, leaseStatus, recordDeposit } from "./fixtures";

let db: Db;
let unitId: string;
let tenantId: string;

beforeAll(async () => {
  db = await connect();
});
afterAll(async () => {
  await db.end();
});
beforeEach(async () => {
  await db.asUser(await createUser(db));
  unitId = (await addProperty(db, "12 Elm St", ["A"])).unitIds[0];
  tenantId = await addTenant(db);
});

describe("US-05 Create a lease", () => {
  it("TC-LEASE-01 Given a unit and a tenant, when I create a lease 2026-11-01 to 2027-10-31 at 1,200.00 due day 1, then it's saved as draft", async () => {
    const id = await createLease(db, { unitId, tenantId });
    const lease = await db.one(
      `select l.status, l.start_date, l.end_date, l.due_day, s.monthly_rent_cents, s.effective_period
         from leases l join lease_rent_schedule s on s.lease_id = l.id where l.id = $1`,
      [id],
    );
    expect(lease).toEqual({
      status: "draft",
      start_date: "2026-11-01",
      end_date: "2027-10-31",
      due_day: 1,
      monthly_rent_cents: 120000,
      effective_period: "2026-11-01",
    });
  });

  it("TC-LEASE-02 Given I enter an end date before the start date, when I save, then it's refused (End date must be after start date)", async () => {
    const err = await expectDbError(() => createLease(db, { unitId, tenantId, start: "2026-11-01", end: "2026-10-01" }));
    expect(err.constraint).toBe("leases_end_after_start");
  });

  it("Given a due day of 31, when I save, then it's refused because every month must have that day", async () => {
    const err = await expectDbError(() => createLease(db, { unitId, tenantId, dueDay: 31 }));
    expect(err.constraint).toBe("leases_due_day_range");
  });

  it("Given a rent of zero, when I save the lease, then it's refused (Rent must be more than zero)", async () => {
    const err = await expectDbError(() => createLease(db, { unitId, tenantId, rentCents: 0 }));
    expect(err.constraint).toBe("lease_rent_schedule_rent_positive");
  });

  it("Given an archived unit, when I create a lease on it, then it's refused (Unit is archived)", async () => {
    await db.query("update units set archived_at = now() where id = $1", [unitId]);
    const err = await expectDbError(() => createLease(db, { unitId, tenantId }));
    expect(err.message).toBe("Unit is archived");
  });

  it("TC-LEASE-03 Given unit A already has an active lease, when I activate a second lease on unit A with overlapping dates, then activation is refused", async () => {
    const first = await createLease(db, { unitId, tenantId });
    await recordDeposit(db, first);
    await activate(db, first);
    const second = await createLease(db, { unitId, tenantId, start: "2027-03-01", end: "2028-02-29" });
    await recordDeposit(db, second);
    const err = await expectDbError(() => activate(db, second));
    expect(err.constraint).toBe("leases_one_active_per_unit");
    expect(await leaseStatus(db, second)).toBe("draft");
  });

  it("Given an active lease on unit A, when I activate a lease on unit A for later, non-overlapping dates, then it's allowed", async () => {
    const first = await createLease(db, { unitId, tenantId, start: "2026-11-01", end: "2027-04-30" });
    await recordDeposit(db, first);
    await activate(db, first);
    const second = await createLease(db, { unitId, tenantId, start: "2027-05-01", end: "2028-04-30" });
    await recordDeposit(db, second);
    await activate(db, second);
    expect(await leaseStatus(db, second)).toBe("active");
  });

  it("Given a lease written directly as active by SQL, when it's inserted, then it's refused (leases start as draft)", async () => {
    const err = await expectDbError(() =>
      db.query(
        `insert into leases (unit_id, tenant_id, start_date, end_date, due_day, status)
         values ($1, $2, '2026-11-01', '2027-10-31', 1, 'active')`,
        [unitId, tenantId],
      ),
    );
    expect(err.message).toBe("A new lease starts as draft");
  });

  it("Given an active lease, when someone sets it back to draft, then it's refused", async () => {
    const { leaseId } = await activeLease(db);
    const err = await expectDbError(() => db.query("update leases set status = 'draft' where id = $1", [leaseId]));
    expect(err.message).toBe("A lease goes from draft to active to ended, never back");
  });

  it("Given an active lease, when someone changes its start date, then it's refused because the terms are fixed", async () => {
    const { leaseId } = await activeLease(db);
    const err = await expectDbError(() =>
      db.query("update leases set start_date = '2026-12-01' where id = $1", [leaseId]),
    );
    expect(err.message).toBe("An active lease's unit, tenant, dates and due day can't change; renew it instead");
  });
});

describe("US-06 No active lease without a deposit decision", () => {
  it("TC-LEASE-04 Given a draft lease with no deposit and no waiver, when I activate it, then I see 'Record a deposit or a waiver first' and it stays draft", async () => {
    const id = await createLease(db, { unitId, tenantId });
    const err = await expectDbError(() => activate(db, id));
    expect(err.message).toBe("Record a deposit or a waiver first");
    expect(await leaseStatus(db, id)).toBe("draft");
  });

  it("TC-LEASE-05 Given a draft lease with a deposit of 1,200.00 recorded, when I activate it, then it becomes active", async () => {
    const id = await createLease(db, { unitId, tenantId });
    await recordDeposit(db, id, 120000);
    await activate(db, id);
    expect(await leaseStatus(db, id)).toBe("active");
  });

  it("TC-LEASE-06 Given a draft lease, when I record a waiver with a reason and date, then I can activate it and the waiver is kept on the lease", async () => {
    const id = await createLease(db, { unitId, tenantId });
    await db.query(
      "update leases set deposit_waived_on = '2026-10-20', deposit_waiver_reason = 'Family member' where id = $1",
      [id],
    );
    await activate(db, id);
    const lease = await db.one("select status, deposit_waived_on, deposit_waiver_reason from leases where id = $1", [id]);
    expect(lease).toEqual({ status: "active", deposit_waived_on: "2026-10-20", deposit_waiver_reason: "Family member" });
  });

  it("Given a waiver with a date but a blank reason, when I save it, then it's refused", async () => {
    const id = await createLease(db, { unitId, tenantId });
    const err = await expectDbError(() =>
      db.query("update leases set deposit_waived_on = '2026-10-20', deposit_waiver_reason = ' ' where id = $1", [id]),
    );
    expect(err.constraint).toBe("leases_waiver_complete");
  });

  it("TC-LEASE-07 Given the rule is in the database, when status = 'active' is written by SQL as the database owner with no deposit or waiver, then the write fails", async () => {
    const id = await createLease(db, { unitId, tenantId });
    await db.asAdmin(); // bypasses RLS: proves the rule is a trigger, not a policy
    const err = await expectDbError(() => db.query("update leases set status = 'active' where id = $1", [id]));
    expect(err.message).toBe("Record a deposit or a waiver first");
  });
});

describe("US-17 Record a deposit", () => {
  it("TC-DEP-01 Given a draft lease, when I record a deposit of 1,200.00 received 2026-10-25, then it appears in the deposit section", async () => {
    const id = await createLease(db, { unitId, tenantId });
    await recordDeposit(db, id, 120000, "2026-10-25");
    const rows = await db.many("select amount_cents, received_on from deposits where lease_id = $1", [id]);
    expect(rows).toEqual([{ amount_cents: 120000, received_on: "2026-10-25" }]);
    const held = await db.one("select received_cents, held_cents from lease_deposit_summary where lease_id = $1", [id]);
    expect(held).toEqual({ received_cents: 120000, held_cents: 120000 });
  });

  it("TC-DEP-02 Given a deposit paid in two instalments of 600.00, when I record both, then the deposit held is 1,200.00", async () => {
    const id = await createLease(db, { unitId, tenantId });
    await recordDeposit(db, id, 60000, "2026-10-20");
    await recordDeposit(db, id, 60000, "2026-10-27");
    const { held_cents } = await db.one("select held_cents from lease_deposit_summary where lease_id = $1", [id]);
    expect(held_cents).toBe(120000);
  });

  it("Given a new draft lease, when I look at its deposit, then it holds 0.00 (empty state)", async () => {
    const id = await createLease(db, { unitId, tenantId });
    const { held_cents } = await db.one("select held_cents from lease_deposit_summary where lease_id = $1", [id]);
    expect(held_cents).toBe(0);
  });

  it("Given I enter a deposit of 0, when I save, then it's refused (Amount must be more than zero)", async () => {
    const id = await createLease(db, { unitId, tenantId });
    const err = await expectDbError(() => recordDeposit(db, id, 0));
    expect(err.constraint).toBe("deposits_amount_positive");
  });

  it("Given a recorded deposit, when someone edits or deletes it by SQL, then both are refused (append-only)", async () => {
    const id = await createLease(db, { unitId, tenantId });
    await recordDeposit(db, id);
    await db.asAdmin();
    const upd = await expectDbError(() => db.query("update deposits set amount_cents = 1 where lease_id = $1", [id]));
    expect(upd.message).toBe("deposits rows are never changed or deleted; add a correcting row instead");
    const del = await expectDbError(() => db.query("delete from deposits where lease_id = $1", [id]));
    expect(del.message).toBe("deposits rows are never changed or deleted; add a correcting row instead");
  });

  it("Given a recorded deposit, when I check who recorded it, then it carries my user id and a timestamp (NFR-05)", async () => {
    const user = await createUser(db);
    await db.asUser(user);
    const u = (await addProperty(db, "9 Ash Ln", ["1"])).unitIds[0];
    const id = await createLease(db, { unitId: u, tenantId: await addTenant(db) });
    await recordDeposit(db, id);
    const row = await db.one<{ created_by: string; created_at: Date }>(
      "select created_by, created_at from deposits where lease_id = $1",
      [id],
    );
    expect(row.created_by).toBe(user);
    expect(row.created_at).toBeInstanceOf(Date);
  });
});
