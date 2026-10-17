# Sprint plan

One-week sprints after a short discovery sprint. The board lives in Jira (D-14); this page is the plan of record and holds the review notes.

**Capacity.** One builder at about 12 hours a week. Velocity is unknown until S1 ends, so S2 and S3 scope is re-checked at each sprint planning. **Cut line:** if a sprint is over capacity, drop Could stories first, then Should, never Must (R-13).

## Overview

| Sprint | Dates (planned) | Goal | Stories | Points | Exit gate |
| --- | --- | --- | --- | --- | --- |
| S0 | 2026-10-16 → 10-18 | Validate the problem and lock S1 scope | — (discovery + docs) | — | PRD reviewed; testers booked; baseline task defined |
| S1 | 2026-10-19 → 10-25 | A landlord can sign in and set up leases safely | US-01 – US-06, US-17 | 18 | Migrations apply cleanly; RLS and activation tests pass |
| S2 | 2026-10-26 → 11-01 | Money flows: charges, proration, payments, credit | US-09 – US-16 | 29 | Every S2 AC passes as an automated test |
| S3 | 2026-11-02 → 11-08 | Deposits, refunds, reports; UAT and user test | US-07, US-08, US-18 – US-23 | 21 + UAT | UAT exit criteria met; timings recorded |

S1 is lighter on points because it also carries one-off setup: repo scaffold, local Supabase, CI and the first migrations.

## S0 — Discovery (2–3 days)

| # | Task | Output | Done |
| --- | --- | --- | --- |
| 1 | Five discovery conversations (guide in [discovery-notes.md](discovery-notes.md)) | Notes per person; P1–P5 confirmed or cut | [ ] |
| 2 | Answer PRD open questions Q1–Q2 | Answers in PRD §11; decisions logged | [ ] |
| 3 | Build the baseline spreadsheet for the timed task | `docs/user-test/baseline.xlsx` | [ ] |
| 4 | Book five (aim for seven) test users for S3 | Names and slots, kept private (not in git) | [ ] |
| 5 | Backlog refinement: point every story, confirm sprint split | Points in user-stories.md | [x] |
| 6 | Set up Jira board: epics E1–E7, stories, S1 sprint | Board link in README | [ ] |
| 7 | PRD review | PRD status → Approved v1.0 | [ ] |

## S1 — Foundations

| Story | Points | Notes |
| --- | --- | --- |
| US-01 Sign up and sign in | 2 | Supabase Auth email + password |
| US-02 My data stays mine | 3 | RLS tests written before policies |
| US-03 Properties and units | 3 | |
| US-04 Tenants | 2 | |
| US-05 Create a lease | 3 | Exclusion constraint for overlapping active leases |
| US-06 No active lease without a deposit decision | 3 | Activation trigger |
| US-17 Record a deposit | 2 | Pulled into S1 because US-06 depends on it |

**S1 build plan (written 2026-10-17, before any code).** S1 starts before discovery has run, on the owner's instruction (D-16, R-15). It's built in four branches, each merged into `dev` when its tests pass:

1. `chore/s1-scaffold`: Next.js, Supabase CLI config, Vitest and Playwright set-up, `make` targets, the app CI job, and the docs check reading test names (D-18).
2. `feature/US-01-sign-in`: email and password sign-up, sign-in and sign-out, and a middleware that sends signed-out visitors to `/signin?next=…`.
3. `feature/US-02-03-04-setup-and-isolation`: properties, units and tenants, each table with RLS and composite owner keys (D-21), plus the generic cross-account suite that fails whenever a table is missing from it.
4. `feature/US-05-06-17-leases-and-deposits`: leases with the overlap exclusion constraint, the rent schedule, deposits, the waiver, and the activation trigger.

Left out of S1 on purpose: editing a lease after it's created (not in any story; a draft with a typo stays a draft), and the dashboard totals (US-23, S3). The home page in S1 is a getting-started checklist (OQ-07).

## S2 — Money flows

| Story | Points | Notes |
| --- | --- | --- |
| US-10 Generate monthly charges | 5 | Idempotency + concurrency test |
| US-11 Prorate the first month | 2 | Shared proration function with US-09 |
| US-09 Early move-out | 5 | Adjustment rows, not edits |
| US-12 Record a payment | 3 | |
| US-13 Partial payments | 5 | Allocation trigger |
| US-14 Overpayment becomes credit | 3 | |
| US-15 Reverse a bounced payment | 3 | Should — first to cut |
| US-16 Lease ledger | 3 | `lease_ledger` view |

## S3 — Deposits, reports, UAT

| Story | Points | Notes |
| --- | --- | --- |
| US-07 Change rent mid-lease | 3 | |
| US-18 Deposit deductions | 2 | |
| US-19 Refund or amount owed | 3 | |
| US-20 Overdue rent | 3 | |
| US-21 Pending refunds | 2 | |
| US-08 Renew a lease | 3 | Should |
| US-22 CSV export | 2 | Should |
| US-23 Dashboard | 3 | Could — first to cut |
| UAT run | — | Execute every case in `docs/uat/test-cases.csv` ([uat-plan.md](uat-plan.md)) |
| Timed user test | — | Five users ([user-test-protocol.md](user-test-protocol.md)) |
| User guide | — | `docs/user-guide.md`, used in the 10-minute walkthrough |

## Ceremonies

| Ceremony | When | Length | Output |
| --- | --- | --- | --- |
| Sprint planning | First day of sprint | 30 min | Sprint scope confirmed against capacity |
| Daily check | Each working day | 5 min, written | One line in the sprint's Jira comment: done / next / blocked |
| Sprint review | Last day | 30 min | Demo + review notes below |
| Retro | After review | 15 min | One thing to keep, one to change |
| Risk review | In the review | 10 min | [risk-log.md](risk-log.md) scores updated |

## Sprint review notes

Filled in at the end of each sprint. Planned vs done points come from the Jira sprint report.

### S0 review
- Planned: — · Done: —
- Problems confirmed / cut: [TBD]
- Decisions made: [TBD]
- Risks changed: [TBD]
- Retro — keep: [TBD] · change: [TBD]

### S1 review
- Planned: 18 pts · Done: 18 pts (US-01 to US-06, US-17). There's no Jira sprint report (OQ-17); the count comes from the feature map.
- Dates: built 2026-10-17 to 2026-10-18, before the planned 2026-10-19 start, in one Claude Code session on the owner's instruction (D-15, D-16). The 12 hours a week capacity assumption doesn't describe this build, so S2 and S3 are not re-planned around a velocity number.
- Demo, as run in the end-to-end suite: sign up; add "12 Elm St" with units A and B in one form; add a tenant; create a lease; try to activate it and get "Record a deposit or a waiver first"; record a 1,200.00 deposit with "Record and activate"; try to archive unit A and get "Unit has an active lease".
- Tests at the end of S1: 90 Vitest (unit, database, API) and 37 Playwright, all passing locally. UAT cases automated: see [traceability.md](traceability.md#coverage). No UAT case has been executed by a person; every row in the UAT sheet is still `Not run`.
- Carried over: nothing in scope. Added to the open questions: OQ-21 (deleting a draft lease).
- Risks changed: R-03 and R-04 now have passing automated proving tests (TC-LEASE-04, TC-LEASE-07, TC-NFR-01 to 04); they stay open until UAT runs them on the hosted demo. R-15 added.
- Retro, keep: writing the database tests first caught nothing this time, because the migrations were written against them, but they made the trigger wording and the AC wording identical, which the UI then shows unchanged.
- Retro, change: two end-to-end failures in S1 were my tests racing the page (typing before navigation finished). Every helper now waits for the page heading before typing.

### S2 review
- Planned: 29 pts · Done: [TBD]

### S3 review
- Planned: 21 pts · Done: [TBD]
