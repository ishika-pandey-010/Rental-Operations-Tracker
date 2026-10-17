import { describe, expect, it } from "vitest";
import { firstOfNextMonth, monthName, oneYearLeaseEnd } from "@/lib/dates";

describe("date helpers for lease defaults", () => {
  it("Given 2026-10-17, when the next lease start is suggested, then it's 2026-11-01", () => {
    expect(firstOfNextMonth("2026-10-17")).toBe("2026-11-01");
    expect(firstOfNextMonth("2026-12-31")).toBe("2027-01-01");
  });
  it("Given a start of 2026-11-01, when a one-year end is suggested, then it's 2027-10-31", () => {
    expect(oneYearLeaseEnd("2026-11-01")).toBe("2027-10-31");
    expect(oneYearLeaseEnd("2027-03-01")).toBe("2028-02-29");
  });
  it("Given a period, when it's named, then it reads like 'January 2027'", () => {
    expect(monthName("2027-01")).toBe("January 2027");
  });
});
