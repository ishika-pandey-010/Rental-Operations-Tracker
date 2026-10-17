// US-15 Reverse a bounced payment
import { expect, test } from "@playwright/test";
import { alertIn, leaseWithCharges, recordPaymentUI, signUp, statusIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("TC-PAY-10 Given a 1,200.00 payment allocated to December, when I reverse it with reason 'bounced', then December's balance is 1,200.00 again and the payment shows as reversed", async ({ page }) => {
  await leaseWithCharges(page, ["2026-12"]);
  await recordPaymentUI(page, { amount: "1,200.00", paidOn: "2026-12-02", reference: "TRX-881" });
  await expect(statusIn(page)).toBeVisible();
  const ledger = page.getByRole("region", { name: "Ledger" });
  const row = ledger.getByRole("row", { name: /TRX-881/ });
  await row.getByText("Reverse…").click();
  await row.getByLabel("Reason").fill("bounced");
  await row.getByLabel("Reversed on").fill("2026-12-05");
  await row.getByRole("button", { name: "Reverse payment" }).click();
  await expect(statusIn(page)).toHaveText("Payment reversed. Its charges are open again.");
  await expect(ledger.getByRole("row", { name: /TRX-881/ })).toContainText("Reversed");
  await expect(ledger).toContainText("Payment reversed: bounced");
  const dec = page.getByRole("region", { name: "Charges" }).getByRole("row", { name: /Rent December 2026/ });
  await expect(dec).toContainText("Open");
  await expect(page.getByTestId("lease-owed")).toHaveText("$1,200.00");
  await expect(ledger.getByRole("row", { name: /TRX-881/ }).getByText("Reverse…")).toHaveCount(0);
});

test("Given I try to reverse a payment without a reason, when I submit, then I'm asked for one and nothing changes", async ({ page }) => {
  await leaseWithCharges(page, ["2026-12"]);
  await recordPaymentUI(page, { amount: "500", reference: "R1" });
  await expect(statusIn(page)).toBeVisible();
  const row = page.getByRole("region", { name: "Ledger" }).getByRole("row", { name: /R1/ });
  await row.getByText("Reverse…").click();
  await row.getByLabel("Reason").fill("   ");
  await row.getByRole("button", { name: "Reverse payment" }).click();
  await expect(alertIn(page)).toHaveText("Add a reason, for example 'bounced'");
  await expect(page.getByTestId("lease-owed")).toHaveText("$700.00");
});
