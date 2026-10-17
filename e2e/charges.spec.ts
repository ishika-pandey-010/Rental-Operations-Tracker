// US-10 Generate monthly charges · US-11 Prorate the first month
import { expect, test } from "@playwright/test";
import { addPropertyAndTenant, createActiveLease, generateCharges, signUp, statusIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test.describe("US-10 Generate monthly charges", () => {
  test("Given no active leases, when I open Charges, then I'm told there's nothing to charge yet", async ({ page }) => {
    await page.goto("/charges");
    await expect(page.getByText("No active leases to charge yet")).toBeVisible();
  });

  test("TC-CHG-01 Given two active leases, when I generate 2026-12, then two charges are listed with each lease's rent and due date", async ({ page }) => {
    await addPropertyAndTenant(page, { units: "A, B" });
    await createActiveLease(page, { unit: "12 Elm St · A", rent: "1,200.00", dueDay: "1" });
    await createActiveLease(page, { unit: "12 Elm St · B", rent: "950.00", dueDay: "5" });
    await generateCharges(page, "2026-12");
    await expect(statusIn(page)).toHaveText("2 new charges, 0 already existed");
    const rows = page.getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(3); // header + 2
    await expect(page.getByRole("row", { name: /12 Elm St · A/ })).toContainText("2026-12-01");
    await expect(page.getByRole("row", { name: /12 Elm St · A/ })).toContainText("$1,200.00");
    await expect(page.getByRole("row", { name: /12 Elm St · B/ })).toContainText("2026-12-05");
    await expect(page.getByRole("row", { name: /12 Elm St · B/ })).toContainText("$950.00");
  });

  test("TC-CHG-02 Given charges for 2026-12 exist, when I generate 2026-12 again, then I see '0 new charges, 1 already existed'", async ({ page }) => {
    await addPropertyAndTenant(page, { units: "A" });
    await createActiveLease(page);
    await generateCharges(page, "2026-12");
    await expect(statusIn(page)).toHaveText("1 new charge, 0 already existed");
    await page.getByRole("button", { name: "Generate rent" }).click();
    await expect(statusIn(page)).toHaveText("0 new charges, 1 already existed");
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  });
});

test.describe("US-11 Prorate the first month", () => {
  test("TC-CHG-05 Given a lease starting 2026-11-16 at 1,200.00, when November is generated, then the charge is 600.00, marked as prorated", async ({ page }) => {
    await addPropertyAndTenant(page, { units: "A" });
    await createActiveLease(page, { start: "2026-11-16", end: "2027-11-15" });
    await generateCharges(page, "2026-11");
    const row = page.getByRole("row", { name: /12 Elm St · A/ });
    await expect(row).toContainText("$600.00");
    await expect(row).toContainText("2026-11-16");
    await expect(row).toContainText("Prorated: 15 of 30 days");
  });
});
