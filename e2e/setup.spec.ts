// US-03 Properties and units · US-04 Tenants
import { expect, test } from "@playwright/test";
import { alertIn, signUp, statusIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test.describe("US-03 Properties and units", () => {
  test("Given a new account, when I open Properties, then I see an empty state and the add form ready to type in", async ({ page }) => {
    await page.getByRole("link", { name: "Properties" }).first().click();
    await expect(page.getByText("No properties yet")).toBeVisible();
    await expect(page.getByLabel("Property name")).toBeFocused();
  });

  test("TC-SETUP-01 Given I'm on Properties, when I add '12 Elm St' with units A and B, then both units appear under that property", async ({ page }) => {
    await page.goto("/properties");
    await page.getByLabel("Property name").fill("12 Elm St");
    await page.getByLabel("Units").fill("A, B");
    await page.getByRole("button", { name: "Add property" }).click();
    await expect(statusIn(page)).toHaveText("Added 12 Elm St with 2 units");
    const card = page.getByRole("article", { name: "12 Elm St" });
    await expect(card.getByRole("listitem")).toHaveText(["A", "B"]);
  });

  test("TC-SETUP-02 Given a property already has unit A, when I add another unit A, then I see 'Unit label already used in this property'", async ({ page }) => {
    await page.goto("/properties");
    await page.getByLabel("Property name").fill("12 Elm St");
    await page.getByLabel("Units").fill("A");
    await page.getByRole("button", { name: "Add property" }).click();
    await page.getByRole("link", { name: "12 Elm St" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("12 Elm St");
    await page.getByLabel("New unit label").fill("A");
    await page.getByRole("button", { name: "Add unit" }).click();
    await expect(alertIn(page)).toHaveText("Unit label already used in this property");
    await expect(page.getByLabel("New unit label")).toHaveValue("A");
  });

  test("TC-SETUP-04 Given unit B has no lease, when I archive unit B, then it's archived and no longer listed as active", async ({ page }) => {
    await page.goto("/properties");
    await page.getByLabel("Property name").fill("12 Elm St");
    await page.getByLabel("Units").fill("A, B");
    await page.getByRole("button", { name: "Add property" }).click();
    await page.getByRole("link", { name: "12 Elm St" }).click();
    await page.getByRole("button", { name: "Archive unit B" }).click();
    await expect(statusIn(page)).toHaveText("Unit B archived");
    await expect(page.getByRole("list", { name: "Active units" }).getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("list", { name: "Archived units" })).toContainText("B");
  });

  test("Given a property, when I correct its name, then the new name is shown", async ({ page }) => {
    await page.goto("/properties");
    await page.getByLabel("Property name").fill("12 Elm Stt");
    await page.getByRole("button", { name: "Add property" }).click();
    await page.getByRole("link", { name: "12 Elm Stt" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("12 Elm Stt");
    await page.getByLabel("Name", { exact: true }).fill("12 Elm St");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("12 Elm St");
  });

  test("Given I submit a property with no name, when I save, then the browser asks for it before anything is sent", async ({ page }) => {
    await page.goto("/properties");
    await page.getByRole("button", { name: "Add property" }).click();
    const valid = await page.getByLabel("Property name").evaluate((el) => (el as HTMLInputElement).validity.valid);
    expect(valid).toBe(false);
  });
});

test.describe("US-04 Tenants", () => {
  test("TC-SETUP-05 Given I'm on Tenants, when I add a tenant with a name and email, then the tenant appears in the list", async ({ page }) => {
    await page.goto("/tenants");
    await expect(page.getByText("No tenants yet")).toBeVisible();
    await page.getByLabel("Full name").fill("Sam Okafor");
    await page.getByLabel("Email").fill("sam@example.com");
    await page.getByRole("button", { name: "Add tenant" }).click();
    await expect(statusIn(page)).toHaveText("Added Sam Okafor");
    await expect(page.getByRole("table")).toContainText("sam@example.com");
    // The form clears and is ready for the next tenant.
    await expect(page.getByLabel("Full name")).toHaveValue("");
  });

  test("TC-SETUP-06 Given I add a tenant with neither phone nor email, when I save, then I see 'Add a phone number or email' and the name is kept", async ({ page }) => {
    await page.goto("/tenants");
    await page.getByLabel("Full name").fill("Sam Okafor");
    await page.getByRole("button", { name: "Add tenant" }).click();
    await expect(alertIn(page)).toHaveText("Add a phone number or email");
    await expect(page.getByLabel("Full name")).toHaveValue("Sam Okafor");
    // The cursor goes to the field that needs fixing, not back to the name.
    await expect(page.getByLabel("Email")).toBeFocused();
  });

  test("TC-SETUP-07 Given a tenant exists, when I change the phone number, then the new number is shown", async ({ page }) => {
    await page.goto("/tenants");
    await page.getByLabel("Full name").fill("Sam Okafor");
    await page.getByLabel("Phone").fill("555-0101");
    await page.getByRole("button", { name: "Add tenant" }).click();
    await page.getByRole("link", { name: "Sam Okafor" }).click();
    // The list page has its own Phone field (the add form); wait for the tenant page first.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sam Okafor");
    await page.getByLabel("Phone").fill("555-0199");
    await page.getByRole("button", { name: "Save tenant" }).click();
    await expect(statusIn(page)).toHaveText("Saved");
    await page.getByRole("link", { name: "Tenants" }).first().click();
    await expect(page.getByRole("table")).toContainText("555-0199");
  });
});
