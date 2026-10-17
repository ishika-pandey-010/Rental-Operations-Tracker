import { describe, expect, it } from "vitest";
import { chargeSummary } from "@/lib/charges";

describe("US-10 the generate result is said in plain words", () => {
  it("TC-CHG-02 Given 0 created and 3 existing, when it's shown, then it reads '0 new charges, 3 already existed'", () => {
    expect(chargeSummary(0, 3)).toBe("0 new charges, 3 already existed");
  });
  it("Given 1 created and 1 existing, when it's shown, then the nouns are singular", () => {
    expect(chargeSummary(1, 1)).toBe("1 new charge, 1 already existed");
  });
  it("Given 3 created and none existing, when it's shown, then it reads '3 new charges, 0 already existed'", () => {
    expect(chargeSummary(3, 0)).toBe("3 new charges, 0 already existed");
  });
});
