# Reversing a bounced payment, 2026-10-18

## What the user needs
A transfer the landlord recorded last week has bounced. They want the month to show as owed again without deleting the payment, so the history still explains what happened when the tenant asks.

## What the docs said
- FR-13 (Should), NFR-02, US-15 ([user-stories.md](../user-stories.md#us-15-reverse-a-bounced-payment)): reversing restores the charge's balance and the payment shows as reversed (AC1); a SQL delete is refused (AC2).
- R-06: history fixed by editing rows can't be audited.
- data-model.md: one reversal per payment; reversing releases its allocations.

## Plan
`payment_reversals`, a release trigger, `reverse_payment()`, a reversal row in the ledger, and a "Reverse…" control on each payment in the ledger. Left out: undoing a reversal. A reversal is itself append-only, so a mistaken reversal is fixed by recording the payment again.

## Tests written
Database (`tests/db/reversals.test.ts`, 10 tests). Before the migration 9 failed with `function reverse_payment(...) does not exist` or `relation "payment_reversals" does not exist`. TC-PAY-11 (SQL delete refused) passed straight away, because payments were already append-only from the last branch. It's kept as the named proof for R-06.
- TC-PAY-10; a payment split over two months releases both; reversing an overpayment removes its credit; other credit fills the reopened charge; a second reversal is refused; a reversed payment can't be allocated again; a blank reason is refused; a reversal inserted straight into the table by SQL still releases the money; the ledger shows the reversal row, dates the release on the reversal day, and still ties out.

End-to-end (`e2e/reversals.spec.ts`): TC-PAY-10 through the ledger, and a reversal with a blank reason.

## What I built
- `supabase/migrations/20261018120000_payment_reversals.sql`. `payment_value_cents()` now returns 0 for a reversed payment, and every view picks that up without changes. The allocation trigger is split by direction: adding money checks both caps and refuses reversed payments, while releasing only has to stay within what that payment put on that charge. That split was needed. With the old single check, the first release row of a payment that paid two months failed, because the payment was already worth 0 while the other month was still allocated.
- `release_reversed_payment()` runs after insert, so the rule holds for the SQL editor as well as the app.
- Ledger: "Payment reversed: bounced" adds the amount back. The payment row gets a Reversed badge and loses its Reverse control.

## User review
- Main task: reverse the 1,200.00 transfer TRX-881 that bounced.
- Steps: on the lease page, click "Reverse…" on the payment's ledger row, type the reason, click Reverse payment. 2 clicks, 1 typed field, no new screen; the date defaults to today. A confirmation dialog would add a click; the reason field already makes it hard to do by accident, so there isn't one.
- Change after review: the earlier "Payment of $1,200.00 recorded" message stayed beside "Payment reversed". My first fix keyed the form on the confirmation text, which broke the activation test from the last branch: once the confirmation cleared itself from the URL, the form remounted and lost its fresh message. The fix that held: while a page-level confirmation is showing, the payment and deposit forms hide their own older success message.
- Remaining friction: the Reverse control sits in the ledger, which is the right place to find a specific payment but is far down a long lease page. With many payments it gets busy; a per-payment page would be tidier and is not in scope.

## Decisions
None new. The release-on-insert trigger follows D-03 and NFR-02.

## Doc changes
- data-model.md: `payment_reversals` row describes the trigger.
- feature-map.md: US-15 done.

## Open questions
None new.

## Next
Early move-out (US-09), the last S2 story. It needs `charge_adjustments` and reuses the release logic built here.
