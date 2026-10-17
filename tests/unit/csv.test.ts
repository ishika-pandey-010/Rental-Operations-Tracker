// US-22 CSV export: the file format itself
import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("US-22 toCsv", () => {
  it("Given rows, when exported, then there's a header line and one line per row, CRLF-separated", () => {
    expect(toCsv(["Date", "Amount"], [["2026-12-01", "1200.00"]])).toBe("Date,Amount\r\n2026-12-01,1200.00\r\n");
  });

  it("Given text with commas, quotes or line breaks, when exported, then it's quoted and quotes are doubled", () => {
    expect(toCsv(["Entry"], [['Payment, ref "A"'], ["two\nlines"]])).toBe('Entry\r\n"Payment, ref ""A"""\r\n"two\nlines"\r\n');
  });

  it("Given a negative amount, when exported, then it stays a number a spreadsheet can add up", () => {
    expect(toCsv(["Amount"], [["-771.43"]])).toBe("Amount\r\n-771.43\r\n");
  });

  it("Given text that a spreadsheet would run as a formula, when exported, then it's made inert with a leading apostrophe", () => {
    expect(toCsv(["Reason"], [["=HYPERLINK(\"x\")"], ["+1+1"], ["@SUM(A1)"], ["-cmd"]])).toBe(
      "Reason\r\n\"'=HYPERLINK(\"\"x\"\")\"\r\n'+1+1\r\n'@SUM(A1)\r\n'-cmd\r\n",
    );
  });

  it("Given no rows, when exported, then it's just the header", () => {
    expect(toCsv(["A", "B"], [])).toBe("A,B\r\n");
  });
});
