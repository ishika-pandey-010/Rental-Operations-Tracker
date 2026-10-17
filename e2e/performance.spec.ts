// NFR-07 Ledger and report pages load in under 2 s with 20 units and 24 months of history.
// This runs against the local production build, not the hosted demo that TC-NFR-07
// names, so it's a proxy: it catches a slow query, not a slow network.
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.beforeAll(() => {
  execFileSync("node", ["scripts/seed.mjs"], { encoding: "utf8", timeout: 120_000 });
});

test("TC-NFR-07 (local proxy) Given the seeded demo (20 units, ~24 months), when I open a lease ledger and both reports, then each loads in under 2 seconds", async ({ page }) => {
  await page.goto("/signin");
  await signIn(page, "demo@rentalops.test", "demo-pass-2026");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This month");
  await page.goto("/leases");
  const href = await page.getByRole("link", { name: "12 Elm St · A" }).getAttribute("href");

  const timings: Record<string, number> = {};
  for (const [name, path, ready] of [
    ["lease ledger", href!, "Ledger"],
    ["overdue", "/reports/overdue", "Overdue rent"],
    ["pending refunds", "/reports/refunds", "Pending refunds"],
  ] as const) {
    const t0 = Date.now();
    await page.goto(path);
    await expect(page.getByRole("heading", { name: ready }).first()).toBeVisible();
    timings[name] = Date.now() - t0;
  }
  console.log("NFR-07 local timings (ms):", JSON.stringify(timings));
  const rows = await page.goto(href!).then(() => page.getByRole("region", { name: "Ledger" }).getByRole("row").count());
  expect(rows).toBeGreaterThan(40); // about 24 months of charges, payments and allocations
  for (const ms of Object.values(timings)) expect(ms).toBeLessThan(2000);
});
