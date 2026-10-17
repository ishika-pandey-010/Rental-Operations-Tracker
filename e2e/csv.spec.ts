// US-22 CSV export
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { addDeductionUI, endedLeaseUI, leaseWithCharges, recordPaymentUI, signUp, statusIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

async function download(page: Page, linkName: string) {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: linkName }).click()]);
  return { name: file.suggestedFilename(), text: await readFile((await file.path())!, "utf8") };
}

test("TC-RPT-06 Given a lease ledger, when I click Export CSV, then I get a file with the same rows and columns as the page, amounts as decimals", async ({ page }) => {
  await leaseWithCharges(page, ["2026-11", "2026-12"]);
  await recordPaymentUI(page, { amount: "1,000.00", paidOn: "2026-11-03", reference: "NOV" });
  await expect(statusIn(page)).toHaveText("Payment of $1,000.00 recorded");
  const ledger = page.getByRole("region", { name: "Ledger" });
  const pageRows = await ledger.getByRole("row").count(); // header included
  const { name, text } = await download(page, "Export ledger as CSV");
  expect(name).toMatch(/^ledger-12-elm-st-a-\d{4}-\d{2}-\d{2}\.csv$/);
  const lines = text.trimEnd().split("\r\n");
  expect(lines).toHaveLength(pageRows);
  expect(lines[0]).toBe("Date,Entry,Amount,Balance");
  expect(lines[1]).toBe("2026-11-01,Rent November 2026,1200.00,1200.00");
  expect(lines[2]).toBe('2026-11-03,"Payment, bank transfer, ref NOV",-1000.00,200.00');
  expect(lines[3]).toBe(",Applied to Rent November 2026: 1000.00,,");
  expect(lines[4]).toBe("2026-12-01,Rent December 2026,1200.00,1400.00");
});

test("Given an overdue charge, when I export Overdue as CSV, then the file has the report's rows with decimal amounts", async ({ page }) => {
  await leaseWithCharges(page, ["2026-12"]);
  await page.goto("/reports/overdue?as_of=2026-12-11");
  const { text } = await download(page, "Export CSV");
  expect(text).toBe("Tenant,Unit,Charge,Due,Days overdue,Balance\r\nSam Okafor,12 Elm St · A,Rent December 2026,2026-12-01,10,1200.00\r\n");
});

test("Given a pending refund, when I export Pending refunds as CSV, then the file has the report's rows", async ({ page }) => {
  await endedLeaseUI(page);
  await addDeductionUI(page, "150.00", "carpet cleaning");
  await expect(statusIn(page)).toHaveText("Deduction of $150.00 added");
  await page.goto("/reports/refunds?as_of=2027-03-01");
  const { text } = await download(page, "Export CSV");
  expect(text).toBe(
    "Tenant,Unit,Ended,Days since end,Held,Deductions,Refund due\r\nSam Okafor,12 Elm St · A,2027-02-10,19,1200.00,150.00,1050.00\r\n",
  );
});
