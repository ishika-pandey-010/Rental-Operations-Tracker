// US-20 Overdue rent · US-21 Pending refunds · TC-NFR-05 keyboard-only monthly routine
import { expect, test } from "@playwright/test";
import { addDeductionUI, endedLeaseUI, leaseWithCharges, recordPaymentUI, signUp, statusIn, tabTo } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test.describe("US-20 Overdue rent", () => {
  test("Given nothing is overdue, when I open Overdue, then it says nobody is behind", async ({ page }) => {
    await page.goto("/reports/overdue");
    await expect(page.getByText("Nobody is behind")).toBeVisible();
  });

  test("TC-RPT-01 Given a charge due 2026-12-01 with 700.00 left and today 2026-12-11, when I open Overdue, then the row shows tenant, unit, 700.00 and 10 days", async ({ page }) => {
    await leaseWithCharges(page, ["2026-12"]);
    await recordPaymentUI(page, { amount: "500" });
    await expect(statusIn(page)).toHaveText("Payment of $500.00 recorded");
    await page.goto("/reports/overdue");
    await page.getByLabel("As of").fill("2026-12-11");
    await page.getByRole("button", { name: "Show" }).click();
    const row = page.getByRole("row", { name: /Sam Okafor/ });
    await expect(row).toContainText("12 Elm St · A");
    await expect(row).toContainText("$700.00");
    await expect(row).toContainText("10 days");
    await expect(page.getByTestId("overdue-total")).toHaveText("$700.00");
  });

  test("TC-RPT-02 Given a charge that's fully paid, when I open Overdue, then it isn't listed", async ({ page }) => {
    await leaseWithCharges(page, ["2026-12"]);
    await recordPaymentUI(page, { amount: "1,200.00" });
    await expect(statusIn(page)).toHaveText("Payment of $1,200.00 recorded");
    await page.goto("/reports/overdue?as_of=2026-12-11");
    await expect(page.getByText("Nobody is behind")).toBeVisible();
  });

  test("TC-RPT-03 Given a charge not yet due, when I open Overdue, then it isn't listed", async ({ page }) => {
    await leaseWithCharges(page, ["2026-12"]);
    await page.goto("/reports/overdue?as_of=2026-11-30");
    await expect(page.getByText("Nobody is behind")).toBeVisible();
  });
});

test.describe("US-21 Pending refunds", () => {
  test("TC-RPT-04 Given a lease ended 2027-02-10 with a pending refund, when I open Pending refunds, then it's listed with the amount and days since end", async ({ page }) => {
    await endedLeaseUI(page);
    await addDeductionUI(page, "150.00", "carpet cleaning");
    await expect(statusIn(page)).toHaveText("Deduction of $150.00 added");
    await page.goto("/reports/refunds?as_of=2027-03-01");
    const row = page.getByRole("row", { name: /Sam Okafor/ });
    await expect(row).toContainText("2027-02-10");
    await expect(row).toContainText("$1,050.00");
    await expect(row).toContainText("19 days");
  });

  test("TC-RPT-05 Given the refund is marked paid, when I open Pending refunds, then the lease no longer appears", async ({ page }) => {
    await endedLeaseUI(page);
    const deposit = page.getByRole("region", { name: "Deposit" });
    await deposit.getByRole("button", { name: "Mark $1,200.00 refund paid" }).click();
    await expect(statusIn(page)).toHaveText("Refund of $1,200.00 marked paid");
    await page.goto("/reports/refunds?as_of=2027-03-01");
    await expect(page.getByText("No refunds waiting")).toBeVisible();
  });
});

test("TC-NFR-05 Given a seeded lease, when I generate charges, record a payment and open Overdue using only the keyboard, then every step works and focus is always visible", async ({ page }) => {
  await leaseWithCharges(page, []);
  await page.goto("/");
  await tabTo(page, /^Charges$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Charges");
  await tabTo(page, /Month/);
  await page.keyboard.type("122026"); // month inputs take digits in Chromium
  await tabTo(page, /Generate rent/);
  await page.keyboard.press("Enter");
  await expect(statusIn(page)).toHaveText(/new charge/);
  await tabTo(page, /12 Elm St · A/);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("lease-status")).toHaveText("Active");
  await tabTo(page, /Amount received/);
  await page.keyboard.type("500");
  await page.keyboard.press("Enter");
  await expect(statusIn(page)).toHaveText("Payment of $500.00 recorded");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe("none");
  await tabTo(page, /^Overdue$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overdue rent");
});
