# Rental Operations Tracker

A rent ledger for small landlords: leases, monthly charges, partial payments, deposits and refunds. The database itself blocks duplicate charges, over-allocated payments and leases with no deposit decision.

> **Status: S0, discovery.** The product docs are written and cross-checked. The app is built in sprints S1–S3 ([sprint plan](docs/sprint-plan.md)).

## For reviewers: where the proof is

| If you want to see… | Open |
| --- | --- |
| The problem, users, goals and requirements (FR-/NFR- IDs) | [docs/PRD.md](docs/PRD.md) |
| User stories with Given/When/Then acceptance criteria | [docs/user-stories.md](docs/user-stories.md) |
| How every requirement traces to stories, tests and risks | [docs/traceability.md](docs/traceability.md) (generated) |
| The UAT sheet | [docs/uat/test-cases.csv](docs/uat/test-cases.csv) · [UAT plan](docs/uat-plan.md) |
| Risks, mitigations and the test that proves each one | [docs/risk-log.md](docs/risk-log.md) |
| Decisions and their trade-offs | [docs/decisions.md](docs/decisions.md) |
| Sprints, capacity, cut line and review notes | [docs/sprint-plan.md](docs/sprint-plan.md) |
| Data model and money rules, worked through with numbers | [docs/data-model.md](docs/data-model.md) |
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

These are hypotheses until the S0 discovery conversations confirm them ([PRD §2](docs/PRD.md#2-problem)).

## What v1 does

- **Leases:** draft → active → ended, with one active lease per unit; rent changes mid-lease; renewals; early move-out with proration.
- **Charges:** one click creates the month's rent for every active lease. Running it twice creates nothing new.
- **Payments:** split across charges oldest first, partial payments kept visible, overpayments held as credit, bounced payments reversed without deleting history.
- **Deposits:** held separately from rent; deductions need a reason; the refund is worked out for you, and if deductions exceed the deposit the difference is charged to the tenant.
- **Reports:** overdue rent, pending refunds, a full lease ledger with running balance, CSV export.

**Not in v1, on purpose:** online payments, tenant portal, multi-currency, accounting integrations, late fees, maintenance ([why](docs/PRD.md#8-out-of-scope-v1-and-why)).

## Rules the database enforces

| Rule | Risk it removes |
| --- | --- |
| One rent charge per lease per month (`UNIQUE` + `ON CONFLICT DO NOTHING`) | Charging rent twice (R-01) |
| Allocations never exceed a charge or a payment | Hidden overpayments (R-02) |
| No active lease without a deposit row or a dated waiver | Untracked deposits (R-03) |
| Row-level security on every table | One landlord seeing another's data (R-04) |
| Money in integer cents; one proration function | Rounding drift (R-05) |
| Ledger rows are never edited or deleted | Unauditable history (R-06) |
| Refund = max(0, deposit − deductions) | Negative refunds (R-07) |

## How the work is run

- **Docs before code.** A story isn't built until its acceptance criteria are written ([CLAUDE.md](CLAUDE.md)).
- **Stable IDs everywhere:** FR → US → TC → R, checked by `make docs` and in CI on every push.
- **Three one-week sprints** after discovery, with a MoSCoW cut line: Could goes first, then Should, never Must.
- **No hand-typed results.** UAT counts and user-test timings are generated from the files that record them.

## Stack

Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, RLS) · Vitest · Playwright · Vercel and Supabase free plans.

## Results

Not run yet. Filled in from [`docs/uat/test-cases.csv`](docs/uat/test-cases.csv) and [`docs/user-test.md`](docs/user-test.md) at the end of S3.

| Metric | Value | Produced by |
| --- | --- | --- |
| UAT cases executed / passed | [TBD] | `docs/uat/test-cases.csv` |
| Bugs found / fixed | [TBD] | Jira export |
| Median task time, spreadsheet → app | [TBD] | `docs/user-test.md` |

## Run locally

```bash
make docs     # rebuild the traceability matrix and check every link
```

App commands (`make setup`, `make run`, `make test`) arrive in S1.
