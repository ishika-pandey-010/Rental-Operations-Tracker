# Deposit deductions and the refund, 2026-10-18

## What the user needs
The tenant has moved out. The landlord walks the flat, decides what to keep for cleaning and damage, and wants the app to say exactly how much to pay back, or how much the tenant still owes if the damage was worse than the deposit, so they can settle it and move on.

## What the docs said
- FR-15, US-18 ([user-stories.md](../user-stories.md#us-18-deposit-deductions)): deductions with an amount and a reason; refund due drops by the deduction; "Add a reason".
- FR-16, US-19: refund = deposit − deductions, `pending` until paid (AC1); deductions above the deposit become a 200.00 "Deductions above deposit" charge and the refund is 0.00 (AC2); the database rejects a refund of any other amount (AC3); mark paid on a date (AC4).
- D-08, D-09, D-20, R-07.

## Plan
`deposit_deductions` and `refunds` (both append-only), triggers for the rules, `pay_refund()`, the `lease_refund_status` view, and the Deductions and Refund parts of the lease page's Deposit section. Left out: refunding prepaid rent credit (OQ-15) and the Pending refunds report (next branch).

## Tests written
Database (`tests/db/deposits.test.ts`, 16 tests). Before the migration all 16 failed with `relation "deposit_deductions" does not exist`, `relation "lease_refund_status" does not exist` or `function pay_refund(...) does not exist`.
- TC-DEP-03 to 08.
- Mine: no deductions on an active lease; deductions can't be edited; a second deduction past the deposit charges only the extra; tenant credit pays a shortfall charge; a waived lease (nothing held) owes the whole deduction; a refund can't be paid twice, or on an active lease; deductions close once the refund is paid; an active lease's status is `not_due`; two deposit instalments both count.

One test I threw out before writing the migration: my first "waived lease" test never set up a waiver and only checked the fixture's own deposit, so it couldn't fail. I replaced it with one that records a waiver, ends the lease and checks that the whole deduction is owed.

End-to-end (`e2e/deposits.spec.ts`): TC-DEP-03 with 05, TC-DEP-04, TC-DEP-06, TC-DEP-08.

## What I built
- `supabase/migrations/20261018140000_deposit_settlement.sql`. `refund_due_cents()` is the one formula, max(0, held − deductions), used by the refund trigger and the view. `charge_deposit_shortfall()` runs after each deduction, charges only the not-yet-charged part of the excess, and applies credit. `enforce_refund_rules()` names the right amount when it refuses a wrong one ("The refund must be exactly the deposit held minus deductions: 1050.00").
- Lease page, ended leases: a Deductions table and form, then "Refund due: $1,050.00 ($1,200.00 held − $150.00 deductions)" with a status badge, a warning when deductions exceed the deposit, and one button that names the amount: "Mark $1,050.00 refund paid".

## User review
- Main task (step 3 of the user-test protocol): unit B's tenant moved out; deduct 150.00 for cleaning; record the refund and say how much is paid back.
- Steps from the lease page: Record move-out (1 click), deduction amount and reason (2 fields, 1 click), Mark refund paid (1 click; date defaults to today). 3 clicks, 3 typed values, one screen. The answer, 1,050.00, is on the button before it's pressed. Nothing changed after review because I found no step to remove.
- Errors: a blank reason says "Add a reason" and keeps the amount; a refund recorded by SQL with the wrong amount is refused with the right amount in the message.
- A failure that was my test's fault: TC-DEP-06 failed because the second deduction never saved. Timing showed the "success" the test waited for appeared 4 ms after the click: it was the move-out confirmation still on screen, not the deduction's. The test typed the second deduction while the first was still in flight. Every end-to-end wait on a confirmation now checks the exact text ("Deduction of $1,000.00 added"); seven loose waits across four spec files were tightened. The app wasn't changed.
- Remaining friction: when deductions exceed the deposit, the shortfall charge is due on the day it's created; there's no way to give the tenant time to pay. Late fees are out of scope (D-12), so this only affects the Overdue report.

## Decisions
- D-20 is now built: `refunds` has no status column; `lease_refund_status` derives it.

## Doc changes
- data-model.md: `deposit_deductions`, `refunds` and the new `lease_refund_status` view.
- feature-map.md: US-18, US-19 done.

## Open questions
None new.

## Next
The Overdue and Pending refunds reports (US-20, US-21). Both are Musts and both need data built in this sprint.
