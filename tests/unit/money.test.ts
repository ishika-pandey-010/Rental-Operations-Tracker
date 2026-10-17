// NFR-01: money is integer cents end to end. These helpers turn what a
// landlord types into cents, and cents into text, without float arithmetic.
import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney } from "@/lib/money";

describe("parseMoney turns typed amounts into integer cents", () => {
  it.each([
    ["1,200.00", 120000],
    ["1200", 120000],
    ["1200.5", 120050],
    ["  $1,200.00 ", 120000],
    ["0.10", 10],
    ["428.57", 42857],
    ["90071992547409.91", 9007199254740991],
  ])("Given I type %s, when it's parsed, then it's %i cents", (typed, cents) => {
    expect(parseMoney(typed)).toBe(cents);
  });

  it.each(["", "abc", "12.345", "1.2.3", "1,20,0.00x", "-5", "--1"])(
    "Given I type %j, when it's parsed, then it's refused (null)",
    (typed) => expect(parseMoney(typed)).toBeNull(),
  );

  it("Given 0.1 + 0.2 typed as 0.30, when it's parsed, then it's exactly 30 cents", () => {
    expect(parseMoney("0.30")).toBe(30);
  });
});

describe("formatMoney shows cents as currency", () => {
  it.each([
    [120000, "$1,200.00"],
    [42857, "$428.57"],
    [5, "$0.05"],
    [0, "$0.00"],
    [-77143, "-$771.43"],
    [9007199254740991, "$90,071,992,547,409.91"],
  ])("Given %i cents, when shown, then it reads %s", (cents, text) => {
    expect(formatMoney(cents, "USD")).toBe(text);
  });

  it("Given cents and no currency symbol wanted, when shown for a CSV, then it's a plain decimal", () => {
    expect(formatMoney(-77143, null)).toBe("-771.43");
    expect(formatMoney(120000, null)).toBe("1200.00");
  });
});
