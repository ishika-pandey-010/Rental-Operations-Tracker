// US-08 Renew a lease
import { expect, test } from "@playwright/test";
import { leaseWithCharges, signUp, statusIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

async function openRenewal(page: import("@playwright/test").Page) {
  const section = page.getByRole("region", { name: "Renew" });
  await section.getByText("Renew this lease").click();
  return section;
}

test("TC-LEASE-10 Given an active lease ending 2027-10-31, when I renew it from 2027-11-01 to 2028-10-31, then a new lease links to the old one and the old one ends on 2027-10-31", async ({ page }) => {
  const oldUrl = await leaseWithCharges(page, []);
  const section = await openRenewal(page);
  await expect(section.getByLabel("New start date")).toHaveValue("2027-11-01");
  await expect(section.getByLabel("New end date")).toHaveValue("2028-10-31");
  await expect(section.getByLabel("Monthly rent from the renewal")).toHaveValue("1200.00");
  await section.getByLabel(/Carry the .* deposit over/).uncheck();
  await section.getByRole("button", { name: "Renew lease" }).click();
  await expect(statusIn(page)).toHaveText("Renewed from 2027-11-01 to 2028-10-31. Record a deposit or a waiver, then activate it.");
  await expect(page.getByTestId("lease-status")).toHaveText("Draft");
  await page.getByRole("link", { name: "Renewal of the lease ending 2027-10-31" }).click();
  await expect(page).toHaveURL(oldUrl.split("?")[0]);
  await expect(page.getByTestId("lease-status")).toHaveText("Ended");
  await expect(page.getByRole("region", { name: "Terms" })).toContainText("Moved out 2027-10-31");
  await expect(page.getByRole("link", { name: "Renewed by the lease from 2027-11-01" })).toBeVisible();
});

test("TC-LEASE-11 Given the old lease holds a 1,200.00 deposit, when I renew with the deposit carried over, then the new lease shows it and no refund is pending for the old lease", async ({ page }) => {
  await leaseWithCharges(page, []);
  const section = await openRenewal(page);
  await expect(section.getByLabel(/Carry the .* deposit over/)).toBeChecked();
  await section.getByRole("button", { name: "Renew lease" }).click();
  await expect(statusIn(page)).toHaveText("Renewed from 2027-11-01 to 2028-10-31. The $1,200.00 deposit carried over and the lease is active.");
  await expect(page.getByTestId("lease-status")).toHaveText("Active");
  await expect(page.getByTestId("deposit-held")).toHaveText("$1,200.00");
  await expect(page.getByRole("region", { name: "Deposit" })).toContainText("Carried over from the previous lease");
  await page.goto("/reports/refunds?as_of=2027-12-01");
  await expect(page.getByText("No refunds waiting")).toBeVisible();
});
