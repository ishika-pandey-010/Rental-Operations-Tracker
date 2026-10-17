// US-18 Deposit deductions · US-19 Refund or amount owed
import { expect, test } from "@playwright/test";
import { addDeductionUI, alertIn, endedLeaseUI, signUp, statusIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("TC-DEP-03 and TC-DEP-05 Given an ended lease with a 1,200.00 deposit, when I add 150.00 for carpet cleaning, then it's listed and the refund due is 1,050.00, pending", async ({ page }) => {
  await endedLeaseUI(page);
  await addDeductionUI(page, "150.00", "carpet cleaning");
  await expect(statusIn(page)).toHaveText("Deduction of $150.00 added");
  const deposit = page.getByRole("region", { name: "Deposit" });
  await expect(deposit.getByRole("table", { name: "Deductions" })).toContainText("carpet cleaning");
  await expect(deposit.getByTestId("refund-due")).toHaveText("$1,050.00");
  await expect(deposit.getByTestId("refund-status")).toHaveText("Pending");
});

test("TC-DEP-04 Given an ended lease, when I add a deduction with a blank reason, then I see 'Add a reason' and nothing is saved", async ({ page }) => {
  await endedLeaseUI(page);
  await addDeductionUI(page, "150.00", "   ");
  await expect(alertIn(page)).toHaveText("Add a reason");
  await expect(page.getByTestId("refund-due")).toHaveText("$1,200.00");
});

test("TC-DEP-06 Given a 1,200.00 deposit, when deductions reach 1,400.00, then the refund is 0.00 and a 200.00 'Deductions above deposit' charge is added", async ({ page }) => {
  await endedLeaseUI(page);
  await addDeductionUI(page, "1,000.00", "repaint");
  await expect(statusIn(page)).toHaveText("Deduction of $1,000.00 added");
  await addDeductionUI(page, "400.00", "broken window");
  await expect(page.getByTestId("refund-due")).toHaveText("$0.00");
  await expect(page.getByRole("region", { name: "Deposit" })).toContainText("$200.00 more than the deposit");
  const row = page.getByRole("region", { name: "Charges" }).getByRole("row", { name: /Deductions above deposit/ });
  await expect(row).toContainText("$200.00");
});

test("TC-DEP-08 Given a pending refund of 1,050.00, when I mark it paid on 2027-03-01, then it shows as paid on that date and deductions close", async ({ page }) => {
  await endedLeaseUI(page);
  await addDeductionUI(page, "150.00", "carpet cleaning");
  await expect(statusIn(page)).toHaveText("Deduction of $150.00 added");
  const deposit = page.getByRole("region", { name: "Deposit" });
  await deposit.getByLabel("Refund paid on").fill("2027-03-01");
  await deposit.getByRole("button", { name: "Mark $1,050.00 refund paid" }).click();
  await expect(statusIn(page)).toHaveText("Refund of $1,050.00 marked paid");
  await expect(deposit.getByTestId("refund-status")).toHaveText("Paid");
  await expect(deposit).toContainText("Refund of $1,050.00 paid on 2027-03-01");
  await expect(deposit.getByLabel("Deduction amount")).toHaveCount(0);
});
