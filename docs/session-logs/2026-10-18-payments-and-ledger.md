# Payments, partial payments, credit and the lease ledger, 2026-10-18

## What the user needs
Money arrives by transfer, cash or cheque, often short or late. The landlord wants to type in what arrived, see what's still owed on each month, have overpayments roll forward, and be able to show a tenant one page that explains their balance.

## What the docs said
- FR-10, NFR-05, US-12: date, amount, method, reference; a reference can't repeat within a lease; the row records who and when.
- FR-11, US-13: oldest first by default, manual override, allocations never exceed a charge (AC4 in the database).
- FR-12, US-14: overpayment becomes credit and is applied when the next charge is generated, shown as a ledger row (R-08).
- FR-21, NFR-04, US-16: one page in date order with a running balance that ties to charge balances minus credit.
- data-model.md: `payments`, `payment_allocations` (negative rows release money), the derived views, D-07.

## Plan
One migration (payments, allocations, the cap trigger, `apply_credit`, `record_payment`, the four views, and a new `generate_rent_charges` that spends credit), then the payment form, charges table and ledger on the lease page. Left out: reversals (next branch) and adjustments (move-out branch). The two value functions, `charge_value_cents` and `payment_value_cents`, are the single place those later branches will change.

## Tests written
Database (`tests/db/payments.test.ts` 19 tests, `tests/db/ledger.test.ts` 3). Before the migration all 22 failed with `function record_payment(...) does not exist` or `relation "charge_balances" / "lease_credit" / "lease_ledger" does not exist`.
- TC-PAY-01 to 09, TC-PAY-12, TC-PAY-13.
- Mine: the same reference on two leases is fine; two cash payments with no reference are fine; a payment on a draft lease is refused; payments can't be edited; a charge with nothing paid is `open`; a manual allocation of part of a payment leaves the rest as credit rather than spreading it; over-allocating a payment, and allocating across leases, are both refused; the rent ledger never mentions the deposit.
- R-02 race test: two 1,000.00 payments recorded at the same moment on two connections against one 1,200.00 charge. The charge ends with exactly 1,200.00 allocated and 800.00 is credit. I didn't run it without the advisory lock to watch it fail, so all it proves is that the locked version is correct under that race.

One test I changed before any code: my first ledger test expected the credit row to read "Credit applied to Rent January 2027: $100.00". That would put a currency symbol into SQL, which D-25 keeps out. The description now carries no amount; the amount is its own `allocation_cents` column and the UI formats it.

Unit: `positiveAmount` gives "Amount must be more than zero" for 0 and negatives (TC-PAY-03's wording) and an example for junk.

End-to-end (`e2e/payments.spec.ts`): TC-PAY-01 to 06, 08, 09, 12, manual amounts over the payment, the empty ledger, and the remembered method.

## What I built
- `supabase/migrations/20261018110000_payments_ledger.sql`. `enforce_allocation_rules()` locks the lease (D-26), then checks the charge cap, the payment cap, same lease, and that a release never takes back more than the payment put on that charge. `apply_credit()` walks open charges by due date and spends unallocated money oldest payment first. `record_payment()` either calls it or makes exactly the manual allocations given. `lease_ledger` uses one window for both the running balance and a `seq` column, so the page and the tests read rows in the same order.
- Lease page, for active and ended leases: two tiles (unpaid charges, credit), Record a payment, Charges, Ledger, then Terms and Deposit.
- `Flash` (the post-redirect confirmation) now removes `?done=` from the address once shown.

## User review
- Main task: record a 700.00 part-payment that arrived today for a tenant who owes November and December.
- Steps: Leases, the lease, type 700, Record payment. 3 clicks, 2 screens, 1 typed field. Date defaults to today and Method to whatever was used last on this lease, so a run of cash payments doesn't need Method changed each time. Both defaults were in the first build, so no before/after count for them.
- Change after review, a wrong label: the first tile said "Owed now" but included December's charge, which isn't due until 2026-12-01. It now says "Unpaid charges (due or not yet due)". Overdue amounts come with the Overdue report (US-20).
- Change after review, a stale message: after "Lease is active", the next payment showed both confirmations, because the first one lived in the URL. Found by three failing end-to-end tests that each saw two status messages. Fixed in `Flash`, with a test. The first fix didn't work: passing Next's own history state to `replaceState` kept the router on the old URL, and the docs' pattern of passing `null` did.
- The amount field's placeholder now shows what's unpaid ("1400.00 unpaid") instead of a generic example. I didn't pre-fill the field: a pre-filled amount that's submitted without looking would record money that never arrived.
- Errors: a duplicate reference shows the AC wording and keeps everything typed; manual amounts over the payment say both totals.
- Remaining friction: the manual split lists every open charge with a blank field, which gets long for a tenant who is many months behind. Fine for 1 to 20 units; noted here, not built.

## Decisions
- D-26 (lock) is now used by the allocation trigger, `apply_credit` and `record_payment`.
- References are compared trimmed and case-blind. Not logged as a D- entry because it tightens D-24 rather than changing it; it's in data-model.md.

## Doc changes
- data-model.md: payments row, `charge_balances` columns and the `cancelled` status, `payment_balances`, the ledger's allocation rows.
- feature-map.md: US-12, US-13, US-14, US-16 done.

## Open questions
None new.

## Next
Reversing a bounced payment (US-15). It's a Should, but it's small now that allocations can be released, and the move-out branch reuses the same release code.
