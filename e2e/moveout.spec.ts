// US-09 Early move-out
import { expect, test } from "@playwright/test";
import { alertIn, generateCharges, leaseWithCharges, signUp, statusIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

async function recordMoveOut(page: import("@playwright/test").Page, date: string) {
  const section = page.getByRole("region", { name: "Move-out" });
  await section.getByLabel("Move-out date").fill(date);
  await section.getByRole("button", { name: "Record move-out" }).click();
}

test("TC-LEASE-13 Given February was charged 1,200.00, when I record a move-out on 2027-02-10, then a -771.43 adjustment is added, the charge stays visible and the lease is ended", async ({ page }) => {
  await leaseWithCharges(page, ["2027-02"]);
  await recordMoveOut(page, "2027-02-10");
  await expect(statusIn(page)).toHaveText("Move-out on 2027-02-10 recorded. The lease has ended.");
  await expect(page.getByTestId("lease-status")).toHaveText("Ended");
  const ledger = page.getByRole("region", { name: "Ledger" });
  await expect(ledger).toContainText("Rent February 2027");
  await expect(ledger.getByRole("row", { name: /Moved out 2027-02-10: prorated to 10 of 28 days/ })).toContainText("-$771.43");
  const feb = page.getByRole("region", { name: "Charges" }).getByRole("row", { name: /Rent February 2027/ });
  await expect(feb).toContainText("$428.57");
});

test("TC-LEASE-12 and TC-LEASE-14 Given a move-out on 2027-02-10 before February is charged, when I generate February and March, then February is 428.57 and March creates nothing", async ({ page }) => {
  const url = await leaseWithCharges(page, []);
  await recordMoveOut(page, "2027-02-10");
  await expect(page.getByTestId("lease-status")).toHaveText("Ended");
  await generateCharges(page, "2027-02");
  await expect(statusIn(page)).toHaveText("1 new charge, 0 already existed");
  await expect(page.getByRole("row", { name: /12 Elm St · A/ })).toContainText("$428.57");
  await generateCharges(page, "2027-03");
  await expect(statusIn(page)).toHaveText("0 new charges, 0 already existed");
  await page.goto(url);
  await expect(page.getByRole("region", { name: "Move-out" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Terms" })).toContainText("Moved out 2027-02-10");
});

test("Given a move-out date after the lease ends, when I record it, then I'm told it must fall within the lease", async ({ page }) => {
  await leaseWithCharges(page, []);
  await recordMoveOut(page, "2028-01-01");
  await expect(alertIn(page)).toHaveText("The move-out date must fall between the lease's start and end dates");
  await expect(page.getByTestId("lease-status")).toHaveText("Active");
});
