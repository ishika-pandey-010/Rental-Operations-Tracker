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
