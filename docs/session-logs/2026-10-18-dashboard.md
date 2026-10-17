# Dashboard, 2026-10-18

## What the user needs
When the landlord opens the app, they want the month in one glance (how full the units are, what's due, what's late, how much deposit money they're holding) and a way into each number.

## What the docs said
- FR-23 (Could), US-23 ([user-stories.md](../user-stories.md#us-23-dashboard)): units occupied, rent due this month, total overdue and deposits held, each linking to its detail page (AC1).
- OQ-07: the home page was a getting-started checklist until this story.

## Plan
One SQL function returning the four totals for a date, tiles on the home page once setup is complete, and a "Generate rent for <month>" button there too. The button is the friction left over from the charges review: generating rent meant a separate visit to Charges.

## Tests written
Database (`tests/db/dashboard.test.ts`, 4 tests). Before the migration all 4 failed with `function dashboard_totals(unknown) does not exist`.
- First use (all zero); TC-RPT-07 with two leases, a spare unit, a part-payment and a charge not yet due; an ended lease's deposit counts as held until the refund is paid; a lease starting next year doesn't make its unit occupied today.

End-to-end (`e2e/dashboard.spec.ts`): TC-RPT-07 clicks each tile and checks the page it opens; generating this month from the dashboard.

## What I built
- `supabase/migrations/20261018180000_dashboard.sql`: `dashboard_totals(as_of)`. "Occupied" means a lease covers that date. "Deposits held" means every lease whose refund isn't paid, so money from tenants who have left still counts until it's returned.
- Home page: the checklist until all four setup steps are done, then "This month" with the four tiles (rent due also says how much isn't paid yet) and the generate button, which answers in place.

## User review
- Main task: the monthly routine from the home page, generating rent and then seeing what's overdue.
- Before this story: Charges in the nav, Generate rent (2 clicks), then Overdue in the nav (1 click). After: Generate rent for October 2026 on the home page (1 click), then the Overdue tile (1 click). 3 clicks down to 2, and the landlord never leaves the page they open the app on.
- Wrong first test: TC-RPT-07 expected "1 of 1" units occupied, but the test lease started 2026-11-01 and the test ran on 2026-10-18, so the app was right to say 0. The test now builds a lease that covers whatever day it runs on. A second failure was the "Overdue" tile clashing with the "Overdue" nav link in a page-wide lookup; scoped to `<main>`.
- The "Deposits held" tile links to Leases, where each lease shows its deposit. There's no single deposits page; Pending refunds covers the subset that needs action.
- Remaining friction: the dashboard doesn't take an "as of" date like the reports do, so it always shows today. Fine for the persona; the reports cover other dates.

## Decisions
None new.

## Doc changes
- data-model.md: `dashboard_totals`. feature-map.md: US-23 done. Every story in the PRD is now built.

## Open questions
None new.

## Next
The demo seed (NFR-09), the user guide for the timed test, and the README Results table generated from the UAT sheet and `user-test.md`.
