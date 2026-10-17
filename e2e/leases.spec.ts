// US-05 Create a lease · US-06 Deposit gate · US-17 Record a deposit · US-03 archive rule
import { expect, test } from "@playwright/test";
import { addPropertyAndTenant, alertIn, createDraftLease, fillLease, signUp, statusIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

async function recordDeposit(page: import("@playwright/test").Page, amount: string, date: string) {
  const deposit = page.getByRole("region", { name: "Deposit" });
  await deposit.getByLabel("Amount").fill(amount);
  await deposit.getByLabel("Received on").fill(date);
  await deposit.getByRole("button", { name: "Record deposit" }).click();
}

test.describe("US-05 Create a lease", () => {
  test("Given no units or tenants yet, when I open Leases, then I'm told what to add first", async ({ page }) => {
    await page.goto("/leases");
    await expect(page.getByText("No leases yet")).toBeVisible();
    await page.goto("/leases/new");
    await expect(page.getByText("Add a property with at least one unit")).toBeVisible();
  });

  test("TC-LEASE-01 Given a unit and a tenant, when I create a lease 2026-11-01 to 2027-10-31 at 1,200.00 due day 1, then it's saved as draft", async ({ page }) => {
    await addPropertyAndTenant(page);
    await createDraftLease(page);
    const terms = page.getByRole("region", { name: "Terms" });
    await expect(terms).toContainText("2026-11-01 to 2027-10-31");
    await expect(terms).toContainText("$1,200.00");
    await expect(terms).toContainText("Day 1");
    await page.getByRole("link", { name: "Leases" }).first().click();
    await expect(page.getByRole("table")).toContainText("Sam Okafor");
  });

  test("TC-LEASE-02 Given I enter an end date before the start date, when I save, then I see 'End date must be after start date' and what I typed is kept", async ({ page }) => {
    await addPropertyAndTenant(page);
    await fillLease(page, { start: "2026-11-01", end: "2026-10-01" });
    await page.getByRole("button", { name: "Save lease" }).click();
    await expect(alertIn(page)).toHaveText("End date must be after start date");
    await expect(page.getByLabel("Monthly rent")).toHaveValue("1,200.00");
    await expect(page.getByLabel("Unit")).toHaveValue(/.+/);
  });

  test("Given I type rent as '12.345', when I save, then I'm asked for an amount with at most two decimals", async ({ page }) => {
    await addPropertyAndTenant(page);
    await fillLease(page, { rent: "12.345" });
    await page.getByRole("button", { name: "Save lease" }).click();
    await expect(alertIn(page)).toHaveText("Enter the monthly rent as an amount like 1,200.00");
  });

  test("TC-LEASE-03 Given unit A already has an active lease, when I activate a second lease on unit A with overlapping dates, then activation is refused", async ({ page }) => {
    await addPropertyAndTenant(page);
    await createDraftLease(page);
    await recordDeposit(page, "1,200.00", "2026-10-25");
    await page.getByRole("button", { name: "Activate lease" }).click();
    await expect(page.getByTestId("lease-status")).toHaveText("Active");
    await createDraftLease(page, { start: "2027-03-01", end: "2028-02-29" });
    await recordDeposit(page, "1,200.00", "2027-02-20");
    await page.getByRole("button", { name: "Activate lease" }).click();
    await expect(alertIn(page)).toHaveText("This unit already has an active lease for these dates");
    await expect(page.getByTestId("lease-status")).toHaveText("Draft");
  });
});

test.describe("US-06 No active lease without a deposit decision", () => {
  test("TC-LEASE-04 Given a draft lease with no deposit and no waiver, when I activate it, then I see 'Record a deposit or a waiver first' and it stays draft", async ({ page }) => {
    await addPropertyAndTenant(page);
    await createDraftLease(page);
    await page.getByRole("button", { name: "Activate lease" }).click();
    await expect(alertIn(page)).toHaveText("Record a deposit or a waiver first");
    await expect(page.getByTestId("lease-status")).toHaveText("Draft");
  });

  test("TC-LEASE-05 Given a draft lease with a deposit of 1,200.00 recorded, when I activate it, then it becomes active", async ({ page }) => {
    await addPropertyAndTenant(page);
    await createDraftLease(page);
    await recordDeposit(page, "1,200.00", "2026-10-25");
    await page.getByRole("button", { name: "Activate lease" }).click();
    await expect(page.getByTestId("lease-status")).toHaveText("Active");
    await expect(statusIn(page)).toHaveText("Lease is active");
  });

  test("TC-LEASE-06 Given a draft lease, when I record a waiver with a reason and date, then I can activate it and the waiver shows on the lease page", async ({ page }) => {
    await addPropertyAndTenant(page);
    await createDraftLease(page);
    const waiver = page.getByRole("region", { name: "Deposit" });
    await waiver.getByText("No deposit on this lease? Record a waiver").click();
    await waiver.getByLabel("Waived on").fill("2026-10-20");
    await waiver.getByLabel("Reason").fill("Family member");
    await waiver.getByRole("button", { name: "Waive deposit" }).click();
    await expect(waiver).toContainText("Deposit waived on 2026-10-20: Family member");
    await page.getByRole("button", { name: "Activate lease" }).click();
    await expect(page.getByTestId("lease-status")).toHaveText("Active");
    await expect(page.getByRole("region", { name: "Deposit" })).toContainText("Deposit waived on 2026-10-20: Family member");
  });
});

test.describe("US-17 Record a deposit", () => {
  test("TC-DEP-01 Given a draft lease, when I record a deposit of 1,200.00 received 2026-10-25, then it appears in the deposit section", async ({ page }) => {
    await addPropertyAndTenant(page);
    await createDraftLease(page);
    await recordDeposit(page, "1,200.00", "2026-10-25");
    const deposit = page.getByRole("region", { name: "Deposit" });
    await expect(deposit.getByRole("table")).toContainText("2026-10-25");
    await expect(deposit.getByTestId("deposit-held")).toHaveText("$1,200.00");
  });

  test("TC-DEP-02 Given a deposit paid in two instalments of 600.00, when I record both, then the deposit held is 1,200.00", async ({ page }) => {
    await addPropertyAndTenant(page);
    await createDraftLease(page);
    await recordDeposit(page, "600", "2026-10-20");
    await expect(page.getByTestId("deposit-held")).toHaveText("$600.00");
    await recordDeposit(page, "600", "2026-10-27");
    await expect(page.getByTestId("deposit-held")).toHaveText("$1,200.00");
  });

  test("Given I record a deposit of 0, when I save, then I see 'Amount must be more than zero'", async ({ page }) => {
    await addPropertyAndTenant(page);
    await createDraftLease(page);
    await recordDeposit(page, "0", "2026-10-20");
    await expect(alertIn(page)).toHaveText("Amount must be more than zero");
  });
});

test.describe("US-03 archive rules that depend on leases", () => {
  test("TC-SETUP-03 Given unit A has an active lease, when I archive unit A, then I see 'Unit has an active lease' and it stays active", async ({ page }) => {
    await addPropertyAndTenant(page);
    await createDraftLease(page);
    await recordDeposit(page, "1,200.00", "2026-10-25");
    await page.getByRole("button", { name: "Activate lease" }).click();
    await expect(page.getByTestId("lease-status")).toHaveText("Active");
    await page.goto("/properties");
    await page.getByRole("link", { name: "12 Elm St" }).click();
    await page.getByRole("button", { name: "Archive unit A" }).click();
    await expect(alertIn(page)).toHaveText("Unit has an active lease");
    await expect(page.getByRole("list", { name: "Active units" })).toContainText("A");
  });

  test("TC-SETUP-04 Given unit B is archived, when I create a lease, then unit B isn't offered", async ({ page }) => {
    await addPropertyAndTenant(page);
    await page.getByRole("link", { name: "Properties" }).first().click();
    await page.getByRole("link", { name: "12 Elm St" }).click();
    await page.getByRole("button", { name: "Archive unit B" }).click();
    await expect(statusIn(page)).toHaveText("Unit B archived");
    await page.goto("/leases/new");
    await expect(page.getByLabel("Unit").locator("option")).toHaveText(["Choose a unit", "12 Elm St · A"]);
  });
});

test.describe("User review: fewer steps to an active lease", () => {
  test("Given a draft lease, when I record a 1,200.00 deposit with 'Record and activate', then the lease is active after one click", async ({ page }) => {
    await addPropertyAndTenant(page, { units: "A" });
    await createDraftLease(page);
    const deposit = page.getByRole("region", { name: "Deposit" });
    await deposit.getByLabel("Amount").fill("1,200.00");
    await deposit.getByRole("button", { name: "Record and activate" }).click();
    await expect(page.getByTestId("lease-status")).toHaveText("Active");
    await expect(statusIn(page)).toHaveText("Deposit of $1,200.00 recorded. Lease is active.");
    await expect(page.getByTestId("deposit-held")).toHaveText("$1,200.00");
  });

  test("Given only one unit and one tenant, when I open New lease, then both are already chosen and only the rent needs typing", async ({ page }) => {
    await addPropertyAndTenant(page, { units: "A" });
    await page.goto("/leases/new");
    await expect(page.getByLabel("Unit")).not.toHaveValue("");
    await expect(page.getByLabel("Tenant")).not.toHaveValue("");
    await expect(page.getByLabel("Start date")).not.toHaveValue("");
    await expect(page.getByLabel("End date")).not.toHaveValue("");
    await expect(page.getByLabel("Due day")).toHaveValue("1");
  });

  test("Given I've added a property and a tenant, when I go home, then those two steps are marked done", async ({ page }) => {
    await addPropertyAndTenant(page);
    await page.getByRole("link", { name: "Home" }).click();
    const steps = page.getByRole("list", { name: "Setup steps" }).getByRole("listitem");
    await expect(steps.nth(0)).toContainText("Done");
    await expect(steps.nth(1)).toContainText("Done");
    await expect(steps.nth(2)).not.toContainText("Done");
  });

  test("Given a phone-width screen, when I open a draft lease, then nothing scrolls sideways (NFR-08)", async ({ page }) => {
    await addPropertyAndTenant(page, { units: "A" });
    await createDraftLease(page);
    await page.setViewportSize({ width: 390, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
