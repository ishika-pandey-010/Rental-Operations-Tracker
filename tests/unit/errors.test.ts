import { describe, expect, it } from "vitest";
import { dbErrorMessage } from "@/lib/errors";

describe("Database errors are shown in plain words", () => {
  it("TC-SETUP-02 Given the unit label unique constraint fires, when it's shown, then it reads 'Unit label already used in this property'", () => {
    expect(
      dbErrorMessage({ code: "23505", message: 'duplicate key value violates unique constraint "units_property_id_label_key"' }),
    ).toBe("Unit label already used in this property");
  });
  it("TC-SETUP-06 Given the tenant contact check fires, when it's shown, then it reads 'Add a phone number or email'", () => {
    expect(
      dbErrorMessage({ code: "23514", message: 'new row for relation "tenants" violates check constraint "tenants_contact_required"' }),
    ).toBe("Add a phone number or email");
  });
  it("Given a trigger raised a landlord-facing message, when it's shown, then it's passed through unchanged", () => {
    expect(dbErrorMessage({ code: "P0001", message: "Unit has an active lease" })).toBe("Unit has an active lease");
  });
  it("Given an unknown error, when it's shown, then it says nothing was changed", () => {
    expect(dbErrorMessage({ code: "XX000", message: "internal" })).toBe(
      "Something went wrong saving that. Nothing was changed; try again.",
    );
  });
  it("Given the network is down, when it's shown, then it says to check the connection", () => {
    expect(dbErrorMessage(new TypeError("fetch failed"))).toBe("Can't reach the server. Check your connection and try again.");
  });
});
