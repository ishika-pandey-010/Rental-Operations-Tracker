// US-07 Change rent mid-lease
import { expect, test } from "@playwright/test";
import { alertIn, generateCharges, leaseWithCharges, signUp, statusIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("TC-LEASE-08 Given Nov and Dec are charged at 1,200.00, when I set 1,250.00 from 2027-01 and generate January, then January is 1,250.00 and Nov and Dec stay 1,200.00", async ({ page }) => {
  const url = await leaseWithCharges(page, ["2026-11", "2026-12"]);
  const terms = page.getByRole("region", { name: "Terms" });
  await terms.getByText("Change the rent").click();
  // The month after the last charged one is already filled in.
  await expect(terms.getByLabel("From month")).toHaveValue("2027-01");
  await terms.getByLabel("New monthly rent").fill("1,250.00");
  await terms.getByRole("button", { name: "Set new rent" }).click();
  await expect(statusIn(page)).toHaveText("Rent is $1,250.00 a month from January 2027");
  await expect(terms).toContainText("$1,250.00 a month from January 2027");
  await generateCharges(page, "2027-01");
  await page.goto(url);
  const charges = page.getByRole("region", { name: "Charges" });
  await expect(charges.getByRole("row", { name: /Rent January 2027/ })).toContainText("$1,250.00");
  await expect(charges.getByRole("row", { name: /Rent November 2026/ })).toContainText("$1,200.00");
  await expect(charges.getByRole("row", { name: /Rent December 2026/ })).toContainText("$1,200.00");
});

test("TC-LEASE-09 Given January is already charged, when I set new rent from 2027-01, then I see 'January is already charged; choose a later month' and nothing changes", async ({ page }) => {
  await leaseWithCharges(page, ["2027-01"]);
  const terms = page.getByRole("region", { name: "Terms" });
  await terms.getByText("Change the rent").click();
  await terms.getByLabel("From month").fill("2027-01");
  await terms.getByLabel("New monthly rent").fill("1,250.00");
  await terms.getByRole("button", { name: "Set new rent" }).click();
  await expect(alertIn(page)).toHaveText("January is already charged; choose a later month");
  await expect(terms).not.toContainText("$1,250.00 a month");
  await expect(terms.getByLabel("New monthly rent")).toHaveValue("1,250.00");
});
