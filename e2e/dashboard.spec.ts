// US-23 Dashboard
import { expect, test } from "@playwright/test";
import { addPropertyAndTenant, createActiveLease, leaseWithCharges, signUp, statusIn } from "./helpers";

/** A lease running from the 1st of the current month for a year, so it covers today whenever the test runs. */
function termCoveringToday() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("TC-RPT-07 Given an account with an active lease, when I open the dashboard, then four totals are shown and each opens its detail page", async ({ page }) => {
  await addPropertyAndTenant(page, { units: "A" });
  await createActiveLease(page, termCoveringToday());
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This month");
  const tiles = [
    { name: /Units occupied/, heading: "Leases" },
    { name: /Rent due/, heading: "Charges" },
    { name: /Overdue/, heading: "Overdue rent" },
    { name: /Deposits held/, heading: "Leases" },
  ];
  await expect(page.getByRole("main").getByRole("link", { name: /Units occupied/ })).toContainText("1 of 1");
  await expect(page.getByRole("main").getByRole("link", { name: /Deposits held/ })).toContainText("$1,200.00");
  for (const t of tiles) {
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: t.name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.heading);
  }
});

test("Given active leases, when I generate this month's rent from the dashboard, then it's done without leaving the page", async ({ page }) => {
  await leaseWithCharges(page, []);
  await page.goto("/");
  await page.getByRole("button", { name: /Generate rent for/ }).click();
  await expect(statusIn(page)).toHaveText(/\d new charges?, \d already existed/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This month");
});
