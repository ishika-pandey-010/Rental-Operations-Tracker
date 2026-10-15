# PRD — Rental Operations Tracker

| | |
| --- | --- |
| **Status** | Draft v0.1 — in review (S0) |
| **Owner** | @ishika-pandey-010 (product + delivery) |
| **Last updated** | 2026-10-15 |
| **Related** | [User stories](user-stories.md) · [Data model](data-model.md) · [Risk log](risk-log.md) · [Decisions](decisions.md) · [Traceability](traceability.md) |

## 1. Summary

Small landlords run rent on spreadsheets. Spreadsheets let you type the same month's rent twice, lose track of half-paid months, mix deposits with rent, and forget refunds after a tenant leaves. Rental Operations Tracker is a web ledger for one landlord where those mistakes are blocked by the database, not by the landlord's memory.

## 2. Problem

| # | Problem in a spreadsheet today | Consequence |
| --- | --- | --- |
| P1 | Nothing stops a second rent row for the same tenant and month | Tenant is chased for money they already paid |
| P2 | A partial payment is one cell; what's still owed lives in a note or in memory | Shortfalls go uncollected or are double-counted |
| P3 | Deposits sit in the same columns as rent | Deposit is counted as income; refund amount is unclear |
| P4 | Nobody is reminded when a lease ends and the deposit is still held | Refunds are late; disputes follow |
| P5 | Mid-month move-ins and move-outs are worked out by hand | Inconsistent proration between tenants |

**Evidence.** These problems are hypotheses taken from vendor documentation of the same workflows (see [competitive analysis](competitive-analysis.md)). They are validated in S0 by:

- [TBD] five short conversations with people who manage 1–20 rental units, notes in `docs/discovery-notes.md`
- [TBD] the spreadsheet baseline task in the [user test protocol](user-test-protocol.md)

Any problem not confirmed by at least two of the five people is moved to §8 (later), and the change is logged in `decisions.md`.

## 3. Users

**Primary persona: the self-managing landlord.** Owns or manages 1–20 units, tracks rent in Excel or Google Sheets, records payments that arrive by bank transfer, cash or cheque, and spends a few hours a month reconciling. Not an accountant. Wants to know "who owes me what, and whose deposit am I holding?"

**Secondary persona: the part-time property manager.** Manages units for one or two owners, needs a clean ledger to show them.

**Not users (v1):** tenants (no portal), accountants (CSV export only), agencies with many owners (one landlord per account).

**Assumptions to validate in S0**

| ID | Assumption | How we check |
| --- | --- | --- |
| A1 | Landlords record payments after the fact, not in real time | Discovery conversations |
| A2 | Most payments cover one month; partial payments are frequent enough to matter | Discovery conversations |
| A3 | Landlords will accept a web app over a spreadsheet if entry is no slower | Timed user test |
| A4 | One currency per landlord covers the target users | Discovery conversations |

## 4. Goals and non-goals

**Goals**

- G1. Make the four costly spreadsheet errors (P1–P4) impossible or immediately visible.
- G2. Make the monthly routine (record rent, a partial payment, a refund) faster than in a spreadsheet.
- G3. Show a correct balance for every lease at any time, with every number traceable to ledger rows.

**Non-goals** — see §8 for the full list and reasons. In short: no online payments, no tenant portal, no multi-currency, no accounting integrations.

## 5. Success metrics

Targets are set now; results are filled in only from recorded data (CLAUDE.md rule 5).

| Metric | Definition | Target | Source of result |
| --- | --- | --- | --- |
| **Task time (primary)** | Median minutes for the standard task (three units: a month's rent, one partial payment, one deposit refund) | App median ≤ 50% of spreadsheet median | `docs/user-test.md` raw timings |
| Task accuracy | Number of wrong balances at the end of the standard task | 0 in the app | `docs/user-test.md` |
| Duplicate charges | Rent charges with the same lease and period | 0, enforced by constraint | `tests/db/charges.test.ts` |
| UAT pass rate | Passed ÷ executed cases at UAT exit | 100% of Critical and High cases | `docs/uat/test-cases.csv` |
| Open defects at release | Bugs open at Critical or High | 0 | Jira export / GitHub issues |
| Learnability | Users who complete the task in the app after a 10-minute walkthrough without help | 5 of 5 | `docs/user-test.md` |

## 6. Requirements

Priority uses MoSCoW. **Must** = v1 cannot ship without it.

### 6.1 Functional

| ID | Requirement | Priority | Problem |
| --- | --- | --- | --- |
| FR-01 | A landlord can sign up, sign in and sign out with email (Supabase Auth). | Must | — |
| FR-02 | A landlord can see and change only their own data, enforced by row-level security on every table. | Must | — |
| FR-03 | Create, edit and archive properties and units. A unit can be archived only with no active lease. | Must | — |
| FR-04 | Create, edit and archive tenants with name and contact details. | Must | — |
| FR-05 | Create a lease (unit, tenant, start, end, monthly rent, due day). It starts as `draft`, becomes `active`, and ends as `ended`. A unit has at most one active lease. | Must | — |
| FR-06 | A lease cannot become `active` without a recorded deposit or an explicit, dated deposit waiver. | Must | P3 |
| FR-07 | Change the rent mid-lease from an effective month. Earlier charges are unchanged. | Must | — |
| FR-08 | Generate the month's rent charge for every active lease. Running it twice for the same month creates nothing new. | Must | P1 |
| FR-09 | Prorate the first and last month by actual days occupied. | Must | P5 |
| FR-10 | Record a payment with date, amount, method and reference. A reference cannot repeat within a lease. | Must | P1 |
| FR-11 | Allocate a payment to open charges, oldest first by default, with manual override. Allocations never exceed a charge. | Must | P2 |
| FR-12 | Hold any unallocated amount as credit and apply it to the next open charge. | Must | P2 |
| FR-13 | Reverse a payment (for example a bounced transfer) without deleting it; its allocations are released. | Should | P2 |
| FR-14 | Record a deposit received (full or in instalments) against a lease, separately from rent. | Must | P3 |
| FR-15 | Record deposit deductions with an amount and a reason. | Must | P3 |
| FR-16 | Calculate the refund as deposit − deductions and track its status (`pending`, `paid`). If deductions exceed the deposit, create a charge for the excess. | Must | P3, P4 |
| FR-17 | Record an early move-out: set the move-out date, prorate the final month, stop future charges. | Must | P5 |
| FR-18 | Renew a lease as a new lease linked to the old one; the deposit can carry over. | Should | — |
| FR-19 | Overdue rent report: every charge past due with a balance, and days overdue. | Must | P2 |
| FR-20 | Pending refunds report: every ended lease whose refund is not paid. | Must | P4 |
| FR-21 | Lease ledger view: charges, payments, allocations and running balance in date order. | Must | P2 |
| FR-22 | Export the lease ledger and both reports as CSV. | Should | — |
| FR-23 | Dashboard: units occupied, rent due this month, total overdue, deposits held. | Could | — |

### 6.2 Non-functional

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-01 | Money is stored as integer minor units. No floating-point arithmetic on money anywhere. | Must |
| NFR-02 | Ledger rows (charges, payments, allocations, deductions) are never updated or deleted; corrections are reversal rows. | Must |
| NFR-03 | Every table has RLS enabled; an automated test proves user B cannot read or write user A's rows. | Must |
| NFR-04 | Balances and statuses are derived from ledger rows, never stored by hand. | Must |
| NFR-05 | Every ledger row records who created it and when. | Must |
| NFR-06 | Core flows are usable with keyboard only and meet WCAG 2.2 AA colour contrast. | Should |
| NFR-07 | Ledger and report pages load in under 2 s with 20 units and 24 months of history on the hosted demo. | Should |
| NFR-08 | Works in current Chrome, Firefox, Safari and Edge, desktop and phone widths. | Should |
| NFR-09 | A seed script rebuilds a realistic demo account in one command (the free database pauses when idle). | Must |

## 7. Key flows

1. **Monthly routine.** Generate charges → record payments as they arrive → check overdue report.
2. **Partial payment.** Record a payment smaller than the charge → charge shows the remaining balance → it appears on the overdue report after the due date.
3. **Move-out.** Record the move-out date → final month prorated → record deductions → refund calculated → mark refund paid → lease leaves the pending refunds report.

## 8. Out of scope (v1) and why

| Item | Why not now |
| --- | --- |
| Online payment collection | Needs a payment provider, compliance and fees; the problem is record-keeping, not collection |
| Tenant portal | Doubles the auth and RLS surface; the persona doesn't need it to fix P1–P5 |
| Multi-currency | Assumption A4; adds conversion and rounding rules |
| Accounting integrations | CSV export covers the hand-off to an accountant |
| Late fees and grace periods | Rules vary by lease and jurisdiction; candidate for v2 |
| Maintenance work orders | A separate workflow; doesn't touch the ledger problem |
| Deposit interest and statutory deadlines | Jurisdiction-specific legal rules; the app records, it doesn't advise |

## 9. Dependencies

| Dependency | Needed for | Risk link |
| --- | --- | --- |
| Supabase free plan (Postgres, Auth) | All data | R-11 |
| Vercel free plan | Hosted demo | — |
| Jira (or GitHub Projects) | Sprint board, bug tracking | — |
| Five test users | Timed user test, UAT feedback | R-10 |

## 10. Release gates

| Gate | Criteria |
| --- | --- |
| G0 → S1 | PRD reviewed; stories for S1 have AC; five testers booked; baseline task defined |
| S2 → S3 | Charges, proration, payments, allocations and credit pass every AC as automated tests |
| v1 release | UAT exit criteria met ([uat-plan.md](uat-plan.md) §5); user test run; README Results generated |

## 11. Open questions

| # | Question | Owner | Due | Answer |
| --- | --- | --- | --- | --- |
| Q1 | Prorate by actual days in the month or a fixed 30-day month? | PM | S0 | Actual days for v1 (D-04); revisit if discovery says otherwise |
| Q2 | Round proration half-up to the cent, or always in the tenant's favour? | PM | S0 | [TBD] |
| Q3 | Does the overdue report count a charge as overdue on the due day or the day after? | PM | S1 | [TBD] |
| Q4 | Should credit apply automatically to the next charge or wait for landlord confirmation? | PM | S1 | Automatic, shown in the ledger (D-07) |
| Q5 | Which currency does the demo account use? | PM | S1 | [TBD] |

## 12. Change history

| Version | Date | Change |
| --- | --- | --- |
| 0.1 | 2026-10-15 | First draft from build plan and competitive research |
