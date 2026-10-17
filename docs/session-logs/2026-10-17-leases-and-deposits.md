# Leases, the deposit gate and deposits, 2026-10-17

## What the user needs
The landlord has signed a tenant for unit A and wants to record the agreement, note the deposit they've taken, and not be able to forget the deposit before rent starts.

## What the docs said
- FR-05, US-05: a lease (unit, tenant, start, end, rent, due day) starts as `draft`; end before start is refused; a unit has at most one active lease.
- FR-06, US-06: no `active` without a deposit row or a dated waiver, enforced in the database too (AC4).
- FR-14, US-17: deposits are recorded separately from rent, in instalments if needed.
- FR-03, US-03 AC2: a unit with an active lease can't be archived (held back from the last branch).
- data-model.md: exclusion constraint for overlapping active leases, `due_day BETWEEN 1 AND 28`, rent in `lease_rent_schedule` (D-05).

## Plan
One migration for `leases`, `lease_rent_schedule`, `deposits`, the lifecycle trigger, the archive guards and `create_lease()`; the Leases list, New lease and lease pages. Left out: editing a lease after it's saved. No story asks for it, and once a lease is active its terms are frozen by the trigger anyway; the way to change them is renewal (US-08, S3). A draft with a typo can't be deleted either, which is friction (below).

## Tests written
Database (`tests/db/leases.test.ts`, 21 tests; the three archive tests returned to `setup.test.ts`; `schema.test.ts`). Run before the migration: 25 failed with `function create_lease(...) does not exist` and `relation "leases" does not exist`, the right reason. After the migration all 63 Vitest tests then in the suite passed on the first run, which I double-checked by reading the TC-LEASE-07 test again: it switches to the database owner role before writing `status = 'active'`, so it does prove the rule is a trigger and not just RLS.
- TC-LEASE-01 to 07, TC-DEP-01, 02, TC-NFR-08 (every `*_cents` column is `bigint`, no float or numeric column anywhere, views included).
- Mine: due day 31, rent 0, a lease on an archived unit, inserting a lease as `active`, setting an active lease back to `draft`, changing an active lease's start date, a waiver with a blank reason, a deposit of 0, editing or deleting a deposit, and `created_by` on a deposit.
- RLS suite: TC-NFR-02 and TC-NFR-03 (B can't read A's lease or put a deposit on it), and the every-table check now covers three more tables and one view. The same two checks run through the REST API in `tests/api/isolation.test.ts`.

Unit: `tests/unit/money.test.ts` (typed text to cents and back, using BigInt and exact decimal strings, never float division) and `tests/unit/dates.test.ts`. Both failed on the missing modules first.

End-to-end (`e2e/leases.spec.ts`): every TC above that has a screen, plus TC-SETUP-03 and TC-SETUP-04 (an archived unit isn't offered for a new lease), a bad rent amount, and the first-use states.

## What I built
- `supabase/migrations/20261017100300_leases_deposits.sql`. `enforce_lease_rules()` handles draft → active → ended only, the deposit gate, archived units and tenants, frozen terms once active, and move-out only when ending. `guard_archive()` is one function shared by units, tenants and properties. `create_lease()` writes the lease and its first rent row in one transaction. The `lease_deposit_summary` view is derived, never stored.
- `src/app/(app)/leases/…`: list, new-lease form, lease page with Terms, Deposit and Activate sections.
- `src/lib/money.ts`: `parseMoney("1,200.50") → 120050`, `formatMoney(120050) → "$1,200.50"`. Amounts go to `Intl.NumberFormat` as exact decimal strings.
- Home page: the checklist now ticks steps off from real counts.

## User review
- Main task: from a saved unit and tenant to an active lease with a 1,200.00 deposit.
- Before review: New lease page (type the rent; unit, tenant, dates and due day were already filled when there's one unit and one tenant), click Save lease. Then on the lease page type the deposit amount, click Record deposit, click Activate lease. 3 clicks, 2 screens, 2 typed fields.
- After review: the deposit form on a draft lease has a "Record and activate" button. Save lease, type the deposit, Record and activate. 2 clicks, 2 screens, 2 typed fields. The plain "Record deposit" button stays for instalments. If activation is refused (an overlapping lease, say), the deposit is still saved and the message says both things.
- I considered putting the deposit fields on the New lease form to get to 1 click. I didn't, because it mixes two records in one form, and a failure halfway would leave the landlord unsure what was saved.
- The single-unit, single-tenant defaults were in the first build; their test passed the first time it ran, so they don't count as a review change.
- Stale feedback: after activation, "Deposit of $1,200.00 recorded" stayed on screen beside "Lease is active". The deposit form now resets when the page redirects.
- Phone width: the two deposit buttons pushed the page 33 px wider than a 390 px screen. Fixed in the shared `.row > .shrink` rule, with a test.
- The deposit amount's placeholder showed "1200.00", which read like a pre-filled value. It now says "e.g. 1200.00".
- Remaining friction: a draft lease saved by mistake can't be deleted or edited. It sits in the list as a draft. Deleting drafts would need a delete policy and a rule about their deposits; it's logged as OQ-21.

## Decisions
- D-21 composite keys now cover leases, rent rows and deposits.
- Deposits can't be added after a lease ends (OQ-14).

## Doc changes
- data-model.md: `lease_deposit_summary` added to the derived views.
- feature-map.md: US-02 to US-06 and US-17 done.
- open-questions.md: OQ-21 added.

## Open questions
- OQ-21: should a draft lease be deletable?

## Next
Sprint review for S1, then S2 starts with charge generation (US-10), because every money flow after it needs charges to exist.
