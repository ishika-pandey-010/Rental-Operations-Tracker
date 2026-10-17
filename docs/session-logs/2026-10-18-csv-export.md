# CSV export, 2026-10-18

## What the user needs
At year end the landlord's accountant wants the numbers in a spreadsheet. The landlord wants to hand over a lease's ledger, or the overdue and pending refunds lists, without retyping anything.

## What the docs said
- FR-22 (Should), US-22 ([user-stories.md](../user-stories.md#us-22-csv-export)): the ledger CSV has the same rows and columns as the page, amounts as decimals (AC1). FR-22 also names both reports.
- PRD §8: CSV is the whole accounting hand-off; no integrations.

## Plan
A CSV builder, three route handlers (`/leases/[id]/ledger.csv`, `/reports/overdue.csv`, `/reports/refunds.csv`) and an Export CSV button beside each table. Left out: a single all-leases export. Not asked for, and the accountant can join per-lease files.

## Tests written
Unit (`tests/unit/csv.test.ts`): header and CRLF rows, quoting of commas, quotes and line breaks, negative amounts left as numbers, formula-looking text neutralised, header-only output. These were written alongside `src/lib/csv.ts`, not ahead of it.

End-to-end (`e2e/csv.spec.ts`): TC-RPT-06 downloads the ledger and compares it line by line with the page: same row count, the same header, and the exact text of the charge, payment, allocation and second charge rows. Two more tests download each report and check the whole file.

## What I built
- `src/lib/csv.ts`: RFC 4180 output. Any cell starting with `=`, `+`, `-` or `@` gets a leading apostrophe unless it's a plain number. Tenant names and deduction reasons are typed by people, and a reason like `=HYPERLINK(...)` would otherwise run when the accountant opens the file. Amounts such as `-771.43` aren't touched, so spreadsheets still add them up.
- `ledger-rows.ts`: one function decides what each ledger line shows. The page table and the CSV both call it, which is what makes "same rows and columns" hold by construction rather than by two copies agreeing. The page passes the currency for display; the CSV passes none and gets plain decimals.
- Filenames say what and when: `ledger-12-elm-st-a-2026-10-18.csv`, `overdue-2026-12-11.csv`.

## User review
- Main task: send December's overdue list to the accountant.
- Steps: Overdue, Export CSV. 2 clicks. The CSV follows the "As of" date on the page, so what's downloaded is what's on screen.
- The buttons only appear when there's something to export, so an empty report doesn't offer an empty file.
- On the ledger the button's accessible name is "Export ledger as CSV", so a screen reader user knows which table it exports; the visible text stays short.
- Remaining friction: the CSV carries no currency column. That's fine with one currency per account (D-25), but the accountant has to know it.

## Decisions
- Formula-injection guarding in CSV output, kept to non-numeric cells. Not a D- entry; it's how the export is built rather than a product choice.

## Doc changes
- feature-map.md: US-22 done.

## Open questions
None new.

## Next
The dashboard (US-23, Could), which also takes over the home page once setup is done.
