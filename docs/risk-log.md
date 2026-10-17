# Risk log

Reviewed at every sprint review. **Likelihood** and **Impact** are 1 (low) to 3 (high); **Score** = L × I. A product risk is closed only when its proving test passes. A delivery risk is closed when its trigger date passes without the risk happening.

## Product risks

| ID | Risk | L | I | Score | Mitigation | Proving test | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | The same month's rent is charged twice (retry, double click, concurrent job) | 3 | 3 | 9 | Partial unique index on `(lease_id, period)` + `ON CONFLICT DO NOTHING` (D-06) | TC-CHG-02, TC-CHG-03 | Open |
| R-02 | A charge is allocated more money than it's worth, hiding an overpayment | 2 | 3 | 6 | Allocation trigger caps net allocations per charge and per payment | TC-PAY-07 | Open |
| R-03 | A lease goes active with no deposit recorded | 3 | 2 | 6 | Activation trigger requires a deposit row or a dated waiver (FR-06) | TC-LEASE-04, TC-LEASE-07 | Open |
| R-04 | One landlord sees or edits another's data | 1 | 3 | 3 | RLS on every table; cross-account tests in CI (NFR-03) | TC-NFR-01 – TC-NFR-04 | Open |
| R-05 | Rounding drift makes balances off by a cent | 2 | 2 | 4 | Integer cents (D-02); one proration function, half-up, unit-tested | TC-NFR-08, TC-CHG-05, TC-LEASE-12 | Open |
| R-06 | A wrong entry is fixed by editing history, so the ledger can't be audited | 2 | 3 | 6 | Append-only tables; reversal and adjustment rows (D-03) | TC-PAY-11 | Open |
| R-07 | Deductions exceed the deposit and the refund goes negative | 2 | 2 | 4 | Refund = max(0, …); excess becomes a charge (D-09) | TC-DEP-06, TC-DEP-07 | Open |
| R-08 | Credit auto-apply surprises the landlord | 2 | 1 | 2 | Credit and its application shown as ledger rows (D-07) | TC-PAY-09 | Open |
| R-09 | Proration convention doesn't match what target users expect | 2 | 2 | 4 | Ask in discovery (PRD Q1); proration isolated in one function so it's cheap to change | TC-CHG-05 | Open |

## Delivery risks

| ID | Risk | L | I | Score | Mitigation | Trigger date | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-10 | Fewer than five test users can be recruited | 2 | 3 | 6 | Recruit during S0 from landlord forums, friends and family who rent out rooms; book 7 for 5 | End of S0 | Open |
| R-11 | Free Supabase project is paused when a reviewer opens the demo | 3 | 2 | 6 | One-command seed script (NFR-09); resume and ping before sharing the link | Before each demo | Open |
| R-12 | Scope creep (late fees, maintenance, tenant portal) | 2 | 2 | 4 | Out-of-scope list in PRD §8 and CLAUDE.md; every new ask logged in decisions.md | Each sprint planning | Open |
| R-13 | Sprints slip (solo builder, ~12 h/week) | 2 | 2 | 4 | MoSCoW: cut Could, then Should, never Must; one-week sprints show slip early | Each sprint review | Open |
| R-14 | Portfolio numbers can't be traced to evidence | 2 | 3 | 6 | Results generated from `docs/uat/test-cases.csv` and `docs/user-test.md` only (CLAUDE.md rules 5–6) | v1 release | Open |
| R-15 | S1–S3 are built before discovery runs (D-16), so a problem the interviews cut may already have code | 2 | 2 | 4 | Each rule is a separate constraint or trigger with its own test, so cutting one is a single migration; discovery results are compared against the feature map before release | Discovery synthesis | Open |
