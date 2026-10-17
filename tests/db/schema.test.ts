// NFR-01 Money is integer minor units · NFR-02 append-only ledger tables
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, type Db } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await connect();
});
afterAll(async () => {
  await db.end();
});

describe("NFR-01 Money columns are integer cents", () => {
  it("TC-NFR-08 Given the migrations are applied, when I list every *_cents column, then all are bigint and no float, real, double or numeric column exists", async () => {
    const cents = await db.many<{ table_name: string; column_name: string; data_type: string }>(
      `select table_name, column_name, data_type from information_schema.columns
        where table_schema = 'public' and column_name like '%\\_cents' escape '\\'`,
    );
    expect(cents.length).toBeGreaterThan(0);
    for (const c of cents) expect({ ...c, data_type: c.data_type }).toEqual({ ...c, data_type: "bigint" });

    const inexact = await db.many(
      `select table_name, column_name, data_type from information_schema.columns
        where table_schema = 'public' and data_type in ('real', 'double precision', 'numeric', 'money')`,
    );
    expect(inexact).toEqual([]);
  });
});
