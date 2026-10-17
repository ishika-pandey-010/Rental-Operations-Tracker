import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const PASSWORD = "correct-horse-42";

export function freshEmail(label = "landlord") {
  return `${label}-${randomUUID().slice(0, 8)}@e2e.test`;
}

/** Signs up a brand-new landlord through the UI and waits for the home page. */
export async function signUp(page: Page, email = freshEmail()) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Getting started");
  return email;
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin/);
}

/** The page's own alert. Next.js also renders a route announcer with role=alert, so scope to <main>. */
export function alertIn(page: Page) {
  return page.getByRole("main").getByRole("alert");
}

/** The page's own status message (success feedback). */
export function statusIn(page: Page) {
  return page.getByRole("main").getByRole("status");
}

/** Adds a property with units and a tenant through the UI. */
export async function addPropertyAndTenant(page: Page, opts: { property?: string; units?: string; tenant?: string } = {}) {
  const property = opts.property ?? "12 Elm St";
  await page.goto("/properties");
  await page.getByLabel("Property name").fill(property);
  await page.getByLabel("Units").fill(opts.units ?? "A, B");
  await page.getByRole("button", { name: "Add property" }).click();
  await expect(statusIn(page)).toContainText(`Added ${property}`);
  const tenant = opts.tenant ?? "Sam Okafor";
  await page.goto("/tenants");
  await page.getByLabel("Full name").fill(tenant);
  await page.getByLabel("Email").fill("sam@example.com");
  await page.getByRole("button", { name: "Add tenant" }).click();
  await expect(statusIn(page)).toHaveText(`Added ${tenant}`);
}

/** Fills the new-lease form. Unit is chosen by its visible "Property · Unit" text. */
export async function fillLease(
  page: Page,
  l: { unit?: string; tenant?: string; start?: string; end?: string; rent?: string; dueDay?: string } = {},
) {
  await page.goto("/leases/new");
  await page.getByLabel("Unit").selectOption({ label: l.unit ?? "12 Elm St · A" });
  await page.getByLabel("Tenant").selectOption({ label: l.tenant ?? "Sam Okafor" });
  await page.getByLabel("Start date").fill(l.start ?? "2026-11-01");
  await page.getByLabel("End date").fill(l.end ?? "2027-10-31");
  await page.getByLabel("Monthly rent").fill(l.rent ?? "1,200.00");
  await page.getByLabel("Due day").fill(l.dueDay ?? "1");
}

/** Creates a draft lease through the UI and waits for its page. */
export async function createDraftLease(page: Page, l: Parameters<typeof fillLease>[1] = {}) {
  await fillLease(page, l);
  await page.getByRole("button", { name: "Save lease" }).click();
  await expect(page.getByTestId("lease-status")).toHaveText("Draft");
}

/** Draft lease → deposit → active, through the UI. */
export async function createActiveLease(page: Page, l: Parameters<typeof fillLease>[1] = {}) {
  await createDraftLease(page, l);
  const deposit = page.getByRole("region", { name: "Deposit" });
  await deposit.getByLabel("Amount").fill("1,200.00");
  await deposit.getByRole("button", { name: "Record and activate" }).click();
  await expect(page.getByTestId("lease-status")).toHaveText("Active");
  return page.url();
}

export async function generateCharges(page: Page, month: string) {
  await page.goto("/charges");
  await page.getByLabel("Month").fill(month);
  await page.getByRole("button", { name: "Generate rent" }).click();
}
