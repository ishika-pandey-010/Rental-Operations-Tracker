#!/usr/bin/env python3
"""Write docs/user-test/baseline.xlsx: the spreadsheet starting state for the
timed user test (docs/user-test-protocol.md §3). Standard library only, so it
needs no new dependency. The data matches `node scripts/seed.mjs --user-test`:
units A, B and C at 1,200.00, October 2026 paid, deposits of 1,200.00 held.

The sheet is laid out the way the PRD's persona keeps rent: one row per unit
per month, typed by hand, no formulas. That's the baseline being measured.
"""
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).resolve().parent.parent / "docs" / "user-test" / "baseline.xlsx"

SHEETS = {
    "Rent": [
        ["Unit", "Tenant", "Month", "Rent due", "Paid", "Date paid", "Notes"],
        ["A", "Alex Moreno", "October 2026", 1200, 1200, "2026-10-02", "Transfer OCT-A"],
        ["B", "Bea Novak", "October 2026", 1200, 1200, "2026-10-02", "Transfer OCT-B"],
        ["C", "Chris Adeyemi", "October 2026", 1200, 1200, "2026-10-02", "Transfer OCT-C"],
    ],
    "Deposits": [
        ["Unit", "Tenant", "Deposit", "Received", "Deductions", "Refund", "Refund paid"],
        ["A", "Alex Moreno", 1200, "2026-09-25", "", "", ""],
        ["B", "Bea Novak", 1200, "2026-09-25", "", "", ""],
        ["C", "Chris Adeyemi", 1200, "2026-09-25", "", "", ""],
    ],
}


def col(i):
    return chr(ord("A") + i)


def sheet_xml(rows):
    out = []
    for r, row in enumerate(rows, 1):
        cells = []
        for c, value in enumerate(row):
            ref = f"{col(c)}{r}"
            if isinstance(value, (int, float)):
                cells.append(f'<c r="{ref}"><v>{value}</v></c>')
            elif value != "":
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{escape(value)}</t></is></c>')
        out.append(f'<row r="{r}">{"".join(cells)}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(out)}</sheetData></worksheet>'
    )


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    names = list(SHEETS)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            + "".join(
                f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                for i in range(1, len(names) + 1)
            )
            + "</Types>",
        )
        z.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>",
        )
        z.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
            + "".join(f'<sheet name="{n}" sheetId="{i}" r:id="rId{i}"/>' for i, n in enumerate(names, 1))
            + "</sheets></workbook>",
        )
        z.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + "".join(
                f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
                for i in range(1, len(names) + 1)
            )
            + "</Relationships>",
        )
        for i, n in enumerate(names, 1):
            z.writestr(f"xl/worksheets/sheet{i}.xml", sheet_xml(SHEETS[n]))
    print(f"Wrote {OUT.relative_to(OUT.parent.parent.parent)}")


if __name__ == "__main__":
    main()
