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
- Planned: 18 pts · Done: [TBD]
- Demo: [TBD]
- Carried over: [TBD]
- Retro — keep: [TBD] · change: [TBD]

### S2 review
- Planned: 29 pts · Done: [TBD]

### S3 review
- Planned: 21 pts · Done: [TBD]
