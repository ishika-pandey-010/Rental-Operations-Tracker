// NFR-09 support: purge_account() is the one way ledger rows are ever deleted,
// for rebuilding the demo account. It removes one owner's rows and nobody else's.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, createUser, expectDbError, type Db } from "./helpers";
import { everyTableScenario } from "./scenario";

let db: Db;
beforeAll(async () => {
  db = await connect();
});
afterAll(async () => {
  await db.end();
});

async function rowsOwnedBy(owner: string) {
  await db.asAdmin();
  const tables = (
    await db.many<{ relname: string }>(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'",
    )
  ).map((r) => r.relname);
  let total = 0;
  for (const t of tables) total += (await db.one<{ n: number }>(`select count(*)::int as n from ${t} where owner_id = $1`, [owner])).n;
  return total;
}

describe("purge_account", () => {
  it("Given two landlords with full histories, when the service role purges one, then every row of that one is gone and the other's are untouched", async () => {
    const doomed = await createUser(db, "doomed");
    const keeper = await createUser(db, "keeper");
    await db.asUser(doomed);
    await everyTableScenario(db);
    await db.asUser(keeper);
    await everyTableScenario(db);
    const keeperBefore = await rowsOwnedBy(keeper);

    await db.asAdmin();
    await db.query("set role service_role");
    await db.query("select purge_account($1)", [doomed]);
    await db.asAdmin();

    expect(await rowsOwnedBy(doomed)).toBe(0);
    expect(await rowsOwnedBy(keeper)).toBe(keeperBefore);
    expect(await db.many("select id from auth.users where id = $1", [doomed])).toEqual([]);
  });

  it("Given a signed-in landlord, when they call purge_account, then they're refused", async () => {
    const user = await createUser(db);
    await db.asUser(user);
    const err = await expectDbError(() => db.query("select purge_account($1)", [user]));
    expect(err.code).toBe("42501");
  });

  it("Given purge_account ran in a transaction, when a delete is tried later in another, then the ledger is append-only again", async () => {
    const user = await createUser(db);
    await db.asUser(user);
    await everyTableScenario(db);
    await db.asAdmin();
    const err = await expectDbError(() => db.query("delete from payments where owner_id = $1", [user]));
    expect(err.message).toBe("payments rows are never changed or deleted; add a correcting row instead");
  });
});
