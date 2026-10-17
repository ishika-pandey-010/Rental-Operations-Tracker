// US-01 Sign up and sign in
import { expect, test } from "@playwright/test";
import { PASSWORD, alertIn, freshEmail, signIn, signOut, signUp } from "./helpers";

test.describe("US-01 Sign up and sign in", () => {
  test("TC-AUTH-01 Given I'm on the sign-up page, when I enter a valid email and password, then my account is created and I land on an empty home page", async ({ page }) => {
    await signUp(page);
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Add your first property")).toBeVisible();
  });

  test("TC-AUTH-02 Given I have an account, when I sign in with the wrong password, then I see 'Email or password is incorrect' and I'm not signed in", async ({ page }) => {
    const email = await signUp(page);
    await signOut(page);
    await signIn(page, email, "wrong-password-1");
    await expect(alertIn(page)).toHaveText("Email or password is incorrect");
    await expect(page).toHaveURL(/\/signin/);
    // The email I typed is still there and the cursor is in Password, so I only retype the password.
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByLabel("Password")).toBeFocused();
  });

  test("TC-AUTH-03 Given I'm signed in, when I sign out, then visiting any app page sends me to the sign-in page", async ({ page }) => {
    await signUp(page);
    await signOut(page);
    await page.goto("/leases");
    await expect(page).toHaveURL(/\/signin\?next=%2Fleases/);
  });

  test("TC-AUTH-04 Given an account exists for an email, when I sign up again with it, then I get a clear error and no second account", async ({ page }) => {
    const email = await signUp(page);
    await signOut(page);
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(alertIn(page)).toHaveText("An account with this email already exists. Sign in instead.");
    await expect(page.getByRole("link", { name: "Sign in instead" })).toBeVisible();
  });

  test("TC-AUTH-05 Given I'm signed out, when I open a lease URL directly, then I'm sent to sign in and land on that lease afterwards", async ({ page }) => {
    const email = await signUp(page);
    await signOut(page);
    const leasePath = "/leases/00000000-0000-4000-8000-000000000001";
    await page.goto(leasePath);
    await expect(page).toHaveURL(/\/signin\?next=/);
    await signIn(page, email);
    await expect(page).toHaveURL(leasePath);
  });

  test("Given a password shorter than 8 characters, when I sign up, then I'm told the minimum length and my email stays filled in", async ({ page }) => {
    const email = freshEmail();
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(alertIn(page)).toHaveText("Use a password of at least 8 characters");
    await expect(page.getByLabel("Email")).toHaveValue(email);
  });

  test("Given I'm signed in, when I open the sign-in page, then I'm taken home instead", async ({ page }) => {
    await signUp(page);
    await page.goto("/signin");
    await expect(page).toHaveURL("/");
  });

  test("Given a 'next' link that points to another site, when I sign in, then I land on my home page, not the other site", async ({ page }) => {
    const email = await signUp(page);
    await signOut(page);
    await page.goto("/signin?next=//evil.example.com");
    await signIn(page, email);
    await expect(page).toHaveURL("/");
  });

  test("Given I only use a keyboard, when I sign in, then I can reach every field and submit with Enter (NFR-06)", async ({ page }) => {
    const email = await signUp(page);
    await signOut(page);
    await page.getByLabel("Email").focus();
    await page.keyboard.type(email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/");
  });

  test("Given a phone-width screen, when I open the home page, then nothing scrolls sideways (NFR-08)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await signUp(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const nav = page.getByRole("navigation", { name: "Main" });
    const box = await nav.boundingBox();
    expect(box!.height).toBeLessThan(60); // one row of links, not a stacked column
  });
});
