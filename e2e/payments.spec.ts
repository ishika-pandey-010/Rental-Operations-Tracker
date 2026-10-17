// US-12 Record a payment · US-13 Partial payments · US-14 Credit · US-16 Lease ledger
import { expect, test } from "@playwright/test";
import { alertIn, generateCharges, leaseWithCharges, recordPaymentUI, signUp, statusIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

const charge = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("region", { name: "Charges" }).getByRole("row", { name: new RegExp(name) });

test.describe("US-12 Record a payment", () => {
  test("TC-PAY-01 Given an active lease, when I record 1,200.00 paid 2026-12-02 by bank transfer ref TRX-881, then it's in the ledger with who recorded it and when", async ({ page }) => {
    await leaseWithCharges(page, ["2026-12"]);
    await recordPaymentUI(page, { amount: "1,200.00", paidOn: "2026-12-02", method: "Bank transfer", reference: "TRX-881" });
    await expect(statusIn(page)).toHaveText("Payment of $1,200.00 recorded");
    const row = page.getByRole("region", { name: "Ledger" }).getByRole("row", { name: /TRX-881/ });
    await expect(row).toContainText("2026-12-02");
    await expect(row).toContainText("-$1,200.00");
    await expect(row).toContainText(/Recorded \d{4}-\d{2}-\d{2} \d{2}:\d{2} by you/);
  });

  test("TC-PAY-02 Given TRX-881 is already recorded on this lease, when I record another payment with TRX-881, then I see 'This reference is already recorded for this lease'", async ({ page }) => {
    await leaseWithCharges(page, ["2026-12"]);
    await recordPaymentUI(page, { amount: "100", reference: "TRX-881" });
    await expect(statusIn(page)).toHaveText("Payment of $100.00 recorded");
    await recordPaymentUI(page, { amount: "200", reference: "TRX-881" });
    await expect(alertIn(page)).toHaveText("This reference is already recorded for this lease");
    await expect(page.getByLabel("Amount received")).toHaveValue("200");
  });

  test("TC-PAY-03 Given I enter 0.00 and then -5.00, when I save each, then I see 'Amount must be more than zero' both times", async ({ page }) => {
    await leaseWithCharges(page, ["2026-12"]);
    await recordPaymentUI(page, { amount: "0.00" });
    await expect(alertIn(page)).toHaveText("Amount must be more than zero");
    await recordPaymentUI(page, { amount: "-5.00" });
    await expect(alertIn(page)).toHaveText("Amount must be more than zero");
  });

  test("Given I recorded a cash payment last time, when I record the next one, then Method starts on Cash", async ({ page }) => {
    await leaseWithCharges(page, ["2026-12"]);
    await recordPaymentUI(page, { amount: "100", method: "Cash" });
    await expect(statusIn(page)).toHaveText("Payment of $100.00 recorded");
    await expect(page.getByLabel("Method")).toHaveValue("cash");
  });
});

test.describe("US-13 Partial payments", () => {
  test("TC-PAY-04 Given a December charge of 1,200.00, when I record 500.00, then it shows paid 500.00, balance 700.00, partial", async ({ page }) => {
    await leaseWithCharges(page, ["2026-12"]);
    await recordPaymentUI(page, { amount: "500" });
    const dec = charge(page, "Rent December 2026");
    await expect(dec).toContainText("$500.00");
    await expect(dec).toContainText("$700.00");
    await expect(dec).toContainText("Partial");
    await expect(page.getByTestId("lease-owed")).toHaveText("$700.00");
  });

  test("TC-PAY-05 Given Nov balance 200.00 and Dec 1,200.00, when I record 700.00 with default allocation, then 200.00 goes to Nov and 500.00 to Dec", async ({ page }) => {
    await leaseWithCharges(page, ["2026-11", "2026-12"]);
    await recordPaymentUI(page, { amount: "1,000.00", paidOn: "2026-11-03" });
    await expect(charge(page, "Rent November 2026")).toContainText("$200.00");
    await recordPaymentUI(page, { amount: "700.00" });
    await expect(charge(page, "Rent November 2026")).toContainText("Paid");
    await expect(charge(page, "Rent December 2026")).toContainText("$700.00");
    await expect(charge(page, "Rent December 2026")).toContainText("Partial");
  });

  test("TC-PAY-06 Given the same charges, when I allocate 700.00 manually all to Dec, then Dec balance is 500.00 and Nov is still 200.00", async ({ page }) => {
    await leaseWithCharges(page, ["2026-11", "2026-12"]);
    await recordPaymentUI(page, { amount: "1,000.00", paidOn: "2026-11-03" });
    await expect(charge(page, "Rent November 2026")).toContainText("$200.00");
    await recordPaymentUI(page, { amount: "700.00", manual: { "Rent December 2026": "700.00" } });
    await expect(statusIn(page)).toHaveText("Payment of $700.00 recorded");
    await expect(charge(page, "Rent December 2026")).toContainText("$500.00");
    await expect(charge(page, "Rent November 2026")).toContainText("$200.00");
  });

  test("Given manual amounts that add up to more than the payment, when I save, then I'm told and nothing is recorded", async ({ page }) => {
    await leaseWithCharges(page, ["2026-11", "2026-12"]);
    await recordPaymentUI(page, { amount: "100", manual: { "Rent November 2026": "80", "Rent December 2026": "80" } });
    await expect(alertIn(page)).toHaveText("The amounts for each charge add up to $160.00, more than the $100.00 received");
    await expect(page.getByRole("region", { name: "Ledger" })).not.toContainText("Payment");
  });
});

test.describe("US-14 Overpayment becomes credit", () => {
  test("TC-PAY-08 Given a December charge of 1,200.00 and nothing else open, when I record 1,500.00, then December is paid and the lease shows credit 300.00", async ({ page }) => {
    await leaseWithCharges(page, ["2026-12"]);
    await recordPaymentUI(page, { amount: "1,500.00" });
    await expect(charge(page, "Rent December 2026")).toContainText("Paid");
    await expect(page.getByTestId("lease-credit")).toHaveText("$300.00");
  });

  test("TC-PAY-09 Given credit of 300.00, when January's 1,200.00 charge is generated, then 300.00 is applied to it, shown as a ledger row", async ({ page }) => {
    const url = await leaseWithCharges(page, ["2026-12"]);
    await recordPaymentUI(page, { amount: "1,500.00" });
    await expect(page.getByTestId("lease-credit")).toHaveText("$300.00");
    await generateCharges(page, "2027-01");
    await page.goto(url);
    await expect(charge(page, "Rent January 2027")).toContainText("$900.00");
    await expect(page.getByRole("region", { name: "Ledger" })).toContainText("Credit applied to Rent January 2027");
    await expect(page.getByTestId("lease-credit")).toHaveText("$0.00");
  });
});

test.describe("US-16 Lease ledger", () => {
  test("TC-PAY-12 Given charges and payments on a lease, when I open it, then the ledger runs in date order with a running balance", async ({ page }) => {
    await leaseWithCharges(page, ["2026-11", "2026-12"]);
    await recordPaymentUI(page, { amount: "1,000.00", paidOn: "2026-11-03", reference: "NOV" });
    await expect(statusIn(page)).toHaveText("Payment of $1,000.00 recorded");
    const balances = page.getByRole("region", { name: "Ledger" }).getByTestId("running-balance");
    await expect(balances).toHaveText(["$1,200.00", "$200.00", "$1,400.00"]);
  });

  test("Given an active lease with nothing charged, when I open it, then the ledger says what will appear there", async ({ page }) => {
    await leaseWithCharges(page, []);
    await expect(page.getByRole("region", { name: "Ledger" })).toContainText("Nothing charged or paid yet");
  });
});
