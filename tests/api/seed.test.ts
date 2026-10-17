// NFR-09 One-command demo seed
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

function seed() {
  return execFileSync("node", ["scripts/seed.mjs"], { encoding: "utf8", timeout: 120_000 });
}

describe("NFR-09 demo seed", () => {
  it("TC-NFR-06 Given any database state, when I run the seed, then the demo landlord can sign in and has properties, leases and 12+ months of history, the same on a second run", async () => {
    const first = seed();
    const second = seed();
    expect(second.split("\n")[1]).toBe(first.split("\n")[1]); // same counts both times

    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({ email: "demo@rentalops.test", password: "demo-pass-2026" });
    expect(error).toBeNull();

    const { count: properties } = await client.from("properties").select("id", { count: "exact", head: true });
    const { count: units } = await client.from("units").select("id", { count: "exact", head: true });
    const { data: periods } = await client.from("charges").select("period").eq("kind", "rent");
    const months = new Set((periods ?? []).map((p) => p.period));
    expect(properties).toBe(3);
    expect(units).toBe(20);
    expect(months.size).toBeGreaterThanOrEqual(12);

    // The cases the demo is meant to show are all present.
    const { count: reversals } = await client.from("payment_reversals").select("id", { count: "exact", head: true });
    const { data: refunds } = await client.from("lease_refund_status").select("status");
    const { data: renewed } = await client.from("leases").select("id").not("renewed_from_id", "is", null);
    const { data: credit } = await client.from("lease_credit").select("credit_cents").gt("credit_cents", 0);
    expect(reversals).toBe(1);
    expect(refunds?.some((r) => r.status === "pending")).toBe(true);
    expect(refunds?.some((r) => r.status === "paid")).toBe(true);
    expect(renewed).toHaveLength(1);
    expect(credit?.length).toBeGreaterThanOrEqual(1);
  }, 180_000);
});
