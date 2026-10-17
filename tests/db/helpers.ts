// Database test harness. Tests talk to the local Supabase Postgres directly,
// switching to the `authenticated` role with a JWT `sub` claim so that
// auth.uid() and row-level security behave exactly as they do for the app.
import pg from "pg";
import { randomUUID } from "node:crypto";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// bigint columns come back as strings by default; cents fit in a JS integer.
pg.types.setTypeParser(20, (v) => Number(v));
// Keep dates as 'YYYY-MM-DD' strings so tests compare what the landlord sees.
pg.types.setTypeParser(1082, (v) => v);

export type Db = pg.Client & {
  asUser(userId: string): Promise<void>;
  asAdmin(): Promise<void>;
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T>;
  many<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
};

export async function connect(): Promise<Db> {
  const client = new pg.Client({ connectionString: DATABASE_URL }) as Db;
  await client.connect();
  client.asUser = async (userId: string) => {
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await client.query("set role authenticated");
  };
  client.asAdmin = async () => {
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', '', false)");
  };
  client.one = async (sql, params) => {
    const { rows } = await client.query(sql, params);
    if (rows.length !== 1) throw new Error(`expected 1 row, got ${rows.length}: ${sql}`);
    return rows[0];
  };
  client.many = async (sql, params) => (await client.query(sql, params)).rows;
  return client;
}

/** Creates an auth user directly (no GoTrue round trip) and returns its id. */
export async function createUser(db: Db, label = "landlord"): Promise<string> {
  const id = randomUUID();
  await db.asAdmin();
  await db.query(
    `insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, now(), now())`,
    [id, `${label}-${id.slice(0, 8)}@test.local`],
  );
  return id;
}

/** Runs `fn` and returns the Postgres error it raised, failing if none was raised. */
export async function expectDbError(fn: () => Promise<unknown>): Promise<pg.DatabaseError> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof pg.DatabaseError) return err;
    throw err;
  }
  throw new Error("expected the database to reject this, but it succeeded");
}
