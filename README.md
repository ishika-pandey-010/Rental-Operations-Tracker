# Rental Operations Tracker

A rent ledger for small landlords: leases, monthly charges, partial payments, deposits and refunds. The database itself blocks duplicate charges, over-allocated payments and leases with no deposit decision.

> **Status: built, not yet user-tested.** Every story in the PRD (US-01 to US-23) is built on the `dev` branch and passes its automated tests (tags `s1`, `s2`, `s3`). The S0 discovery interviews, the UAT run on a hosted demo and the timed user test need real people and hosted accounts, and haven't happened; see [open questions](docs/open-questions.md) OQ-16 to OQ-18. The Results table below says so because it's generated from the files that record them.

## For reviewers: where the proof is

| If you want to see… | Open |
| --- | --- |
| The problem, users, goals and requirements (FR-/NFR- IDs) | [docs/PRD.md](docs/PRD.md) |
| User stories with Given/When/Then acceptance criteria | [docs/user-stories.md](docs/user-stories.md) |
| Every feature, its acceptance criteria and its status | [docs/feature-map.md](docs/feature-map.md) |
| How every requirement traces to stories, UAT cases, automated tests, code and risks | [docs/traceability.md](docs/traceability.md) (generated) |
| How each feature was built, tested and reviewed as a user, with step counts | [docs/session-logs/](docs/session-logs/) |
| The UAT sheet | [docs/uat/test-cases.csv](docs/uat/test-cases.csv) · [UAT plan](docs/uat-plan.md) |
| Risks, mitigations and the test that proves each one | [docs/risk-log.md](docs/risk-log.md) |
| Decisions and their trade-offs | [docs/decisions.md](docs/decisions.md) |
| Gaps, contradictions and assumptions found while building | [docs/open-questions.md](docs/open-questions.md) |
| Sprints, the build plans written before each one, and review notes | [docs/sprint-plan.md](docs/sprint-plan.md) |
| Data model and money rules, worked through with numbers | [docs/data-model.md](docs/data-model.md) |
| How a landlord uses it (the walkthrough for the user test) | [docs/user-guide.md](docs/user-guide.md) |
| Similar products and what was taken from them | [docs/competitive-analysis.md](docs/competitive-analysis.md) |
| Discovery guide and timed user-test protocol | [docs/discovery-notes.md](docs/discovery-notes.md) · [docs/user-test-protocol.md](docs/user-test-protocol.md) |
| Terms used everywhere | [docs/glossary.md](docs/glossary.md) |

## The problem

Small landlords track rent in spreadsheets, and spreadsheets let you:

1. type the same month's rent twice,
2. lose track of what's left after a partial payment,
3. mix deposits in with rent,
4. forget a refund after a tenant leaves,
5. work out mid-month proration differently each time.

These are hypotheses until the discovery conversations confirm them ([PRD §2](docs/PRD.md#2-problem)). The build went ahead before discovery on the owner's instruction (D-16, R-15).

## What v1 does

- **Setup:** a property and all its units in one form; tenants with a phone or email.
- **Leases:** draft → active → ended, with one active lease per unit for any given dates. A lease can't go active until a deposit or a dated waiver is recorded; "Record and activate" does both in one click. Rent changes from a future month, renewals with the deposit carried over, and early move-out with the final month prorated.
- **Charges:** one click charges the month for every lease, from the Charges page or the dashboard. Running it twice creates nothing new and says so. Mid-month starts and move-outs are prorated by actual days, and the charge says how many.
- **Payments:** split across charges oldest first, or by hand. Part-payments leave the rest visible, overpayments are held as credit and spent on the next charge, and bounced payments are reversed without deleting anything.
- **Deposits:** held separately from rent. Deductions need a reason; the refund is worked out for you, and if deductions exceed the deposit the difference is charged to the tenant.
- **Reports:** overdue rent, pending refunds, a full lease ledger with a running balance, CSV export of all three, and a dashboard with four totals.

**Not in v1, on purpose:** online payments, tenant portal, multi-currency, accounting integrations, late fees, maintenance ([why](docs/PRD.md#8-out-of-scope-v1-and-why)).

## Rules the database enforces

Every rule below is a constraint or trigger in [`supabase/migrations/`](supabase/migrations/), holds for the SQL editor as well as the app, and has a test in [`tests/db/`](tests/db/).

| Rule | Risk it removes |
| --- | --- |
| One rent charge per lease per month (partial unique index + `ON CONFLICT DO NOTHING`) | Charging rent twice (R-01) |
| Allocations never exceed a charge or a payment, under a per-lease lock | Hidden overpayments (R-02) |
| No active lease without a deposit row or a dated waiver | Untracked deposits (R-03) |
| Row-level security on every table, and composite owner keys so rows can't point across accounts | One landlord seeing another's data (R-04) |
| Money in integer cents; one proration function, half-up | Rounding drift (R-05) |
| Ledger rows are never edited or deleted; corrections are new rows | Unauditable history (R-06) |
| Refund = max(0, deposit held − deductions); the excess becomes a charge | Negative refunds (R-07) |

## How the work is run

- **Docs before code.** A story isn't built until its acceptance criteria are written ([CLAUDE.md](CLAUDE.md)).
- **Tests before code.** Each money rule had a failing database test before the migration that satisfies it; each session log records the first failure and why.
- **Stable IDs everywhere:** FR → US → TC → automated test → code → R, checked by `make docs` and in CI on every push.
- **One branch per feature,** merged into `dev` with a merge commit (D-17).
- **No hand-typed results.** The table below is generated from the UAT sheet and the user-test file.

## Results

<!-- results:start -->
<!-- Generated by scripts/results.py from docs/uat/test-cases.csv and docs/user-test.md. Run `make docs`; don't edit. -->

| Metric | Value | Produced by |
| --- | --- | --- |
| UAT cases executed / passed | Not run yet: 0 of 70 executed (needs the hosted demo, OQ-16) | `docs/uat/test-cases.csv` |
| UAT exit gate (100% of Critical and High) | 0 of 50 Critical/High cases passed (UAT not run) | `docs/uat/test-cases.csv` |
| UAT cases with an automated test | 69 of 70 | test names in `tests/` and `e2e/` |
| Bugs found in UAT | None logged in the UAT sheet yet | `docs/uat/test-cases.csv` `bug` column |
| Median task time, spreadsheet → app | Not run yet: no sessions in `docs/user-test.md` (OQ-18) | `docs/user-test.md` |
<!-- results:end -->

## Stack

Next.js 15 (App Router, TypeScript) · Supabase (Postgres 17, Auth, RLS) · Vitest · Playwright · Vercel and Supabase free plans.

## Run locally

Needs Node 22, Docker and Python 3.

```bash
make setup    # npm ci, start local Supabase (applies every migration), write .env.local
make seed     # demo landlord: demo@rentalops.test / demo-pass-2026 (20 units, ~24 months)
make run      # http://localhost:3100
make test     # Vitest: unit, database and API tests against local Supabase
make e2e      # Playwright end-to-end tests (builds and starts the app on :3100)
make docs     # rebuild docs/traceability.md and the Results table above
```

`make seed-user-test` builds the three-unit account the timed user test starts from (`usertest@rentalops.test`), matching [`docs/user-test/baseline.xlsx`](docs/user-test/baseline.xlsx).
