# Demo seed, user guide and generated results, 2026-10-18

## What the user needs
Two readers this time. A reviewer opening the hosted demo after the free database has been paused or reset needs it back in one command, with enough history to be worth looking at. The owner, running the timed user test, needs both starting states (the spreadsheet and the app account) and a guide to walk participants through.

## What the docs said
- NFR-09 (Must): a seed script rebuilds a realistic demo account in one command. TC-NFR-06: properties, leases and 12+ months of history.
- NFR-07 (Should): ledger and report pages under 2 s with 20 units and 24 months (TC-NFR-07, on the hosted demo).
- user-test-protocol.md §3: `baseline.xlsx` and a seeded app account with the same three units and October; a 10-minute walkthrough from `docs/user-guide.md`.
- CLAUDE.md rule 5: the README Results table is generated from the UAT sheet and `user-test.md`.

## Plan
`purge_account()`, `scripts/seed.mjs` (with a `--user-test` mode), `scripts/make_baseline_xlsx.py`, `scripts/results.py`, the user guide, and a README rewrite. Left out: deploying the hosted demo (OQ-16) and anything that would put numbers in the Results table before real sessions happen.

## Tests written
- `tests/db/purge.test.ts` (3): the service role purges one landlord's full history and leaves another's untouched; a signed-in landlord can't call it; outside a purge the ledger is append-only again. Before the migration two failed (`function purge_account(unknown) does not exist`); the third passed because append-only already held.
- `tests/api/seed.test.ts` (TC-NFR-06): runs the seed twice, checks the second run reports the same counts, signs in as the demo landlord, and checks 3 properties, 20 units, 12+ months of rent, one reversal, a pending and a paid refund, a renewal, and some credit. It first failed on the credit check: the seeded overpayment was correctly spent on this month's charge, leaving nothing to show. The seed now adds a "paid ahead" payment dated today.
- `e2e/performance.spec.ts` (TC-NFR-07, labelled a local proxy): signs in as the seeded demo and times the busiest lease ledger and both reports. Measured locally: lease ledger 667 ms, Overdue 621 ms, Pending refunds 127 ms. That's a local production build with no network in between, so it says nothing about the hosted demo; it would catch a slow query.

## What I built
- `supabase/migrations/20261018190000_purge_account.sql`, D-28.
- `scripts/seed.mjs`: 3 properties, 20 units, 22 leases, about 490 charges and as many payments over 24 months, written month by month through the same SQL functions the app uses, as the demo landlord, so RLS and every trigger apply. Two seed runs in a row took 6.0 s and 6.6 s locally.
- `make seed-user-test`: Test House, units A to C, October 2026 charged and paid. `make baseline` writes the matching spreadsheet with the standard library (openpyxl isn't installed, and adding it would be a new dependency). I checked the file opens by converting it with LibreOffice.
- `scripts/results.py`: the README Results block. `make docs` writes it and CI's docs job fails if it's stale. Today it reads "Not run yet" for UAT and the user test, and 69 of 70 for automated coverage.
- `docs/user-guide.md`, and the README rewritten for the built state.

## User review
- Main task (reviewer): bring the demo back. Steps: `make seed`. 1 command, about 6 seconds, prints the login.
- Main task (owner): prepare a user-test session. `make seed-user-test` resets the app account in under a second; `baseline.xlsx` is in `docs/user-test/`.
- The guide is written in the order the timed task asks for things (charge November, record payments, move B out with a deduction), not the order the menu is in, because it's read once, ten minutes before the task.
- Remaining friction: the seed's dates move with today, so the demo always looks current, but a screenshot taken today won't match one taken next month.

## Decisions
- D-28 purge exception.

## Doc changes
- decisions.md D-28; open-questions.md OQ-16 (deployment steps), OQ-23 (cross-browser); uat-plan.md §8 readiness; user-test-protocol.md starting states; sprint-plan.md S0 task 3 done; feature-map.md NFR-09 done; README rewritten.

## Open questions
- OQ-23: Safari and Edge can't be automated here.

## Next
S3 review notes and the `s3` tag. The remaining release gates need people: discovery, UAT on a hosted demo, and the timed user test.
