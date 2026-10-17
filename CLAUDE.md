# CLAUDE.md — Rental Operations Tracker

Read this file, then `docs/PRD.md`, before doing anything in this repo.

## Goal

A rent ledger for one small landlord: properties, units, tenants, leases, monthly rent charges, partial payments, deposits, deductions and refunds. The database itself must make duplicate charges, over-allocated payments and missing deposits impossible.

This is a **project-management portfolio piece**. The docs are the main deliverable; the code exists to prove the docs were followed.

## Out of scope (do not build, even if asked casually)

- Collecting payments online (no Stripe, no bank links)
- A tenant portal or tenant logins
- Multi-currency (one currency per account)
- Accounting integrations (CSV export only)
- Late fees and maintenance work orders (parked for v2, see `docs/PRD.md` §8)

If a request falls outside this list's boundary, stop and ask, then log the answer in `docs/decisions.md`.

## Stack

Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, row-level security, migrations) · Vitest · Playwright · Vercel + Supabase free plans.

## Repo layout

```text
CLAUDE.md                 this file; keep under 200 lines
README.md                 landing page for reviewers: problem, docs map, results
docs/
  PRD.md                  problem, users, goals, requirements (FR-/NFR- IDs)
  user-stories.md         epics and stories (US- IDs) with Given/When/Then
  data-model.md           tables, constraints, ER diagram, money rules
  decisions.md            one line per decision (D- IDs) and why
  risk-log.md             risks (R- IDs), mitigation, the test that proves it
  sprint-plan.md          S0–S3 scope, done-when, review notes
  uat-plan.md             UAT approach, entry/exit criteria, bug workflow
  uat/test-cases.csv      the UAT sheet (TC- IDs), one row per case
  discovery-notes.md      S0 interview guide, notes and synthesis
  user-test-protocol.md   timed spreadsheet-vs-app test with five users
  user-test.md            raw timings and summary (filled only after sessions)
  competitive-analysis.md similar products and what we took from them
  traceability.md         FR → US → TC → R matrix (generated; never edit)
  glossary.md             ledger terms used everywhere else
.github/                  issue/PR templates; CI runs the docs check
scripts/docs_check.py     builds traceability.md, fails on broken IDs
Makefile                  make docs | make docs-check (app targets from S1)
```

Code folders (`src/`, `supabase/migrations/`, `tests/`, `e2e/`) arrive in S1.

## Commands

```text
make docs    rebuild docs/traceability.md and check every ID (run after any docs change)
```

From S1:

```text
make setup   install deps, start local Supabase
make run     next dev
make test    vitest (unit + database tests)
make e2e     playwright
make db      apply migrations to local Supabase
```

## IDs and traceability (the core PM rule)

- Every requirement is `FR-nn` or `NFR-nn` in `docs/PRD.md`.
- Every story is `US-nn` and names the FR it delivers.
- Every UAT case is `TC-<MODULE>-nn` and names the US it checks.
- Every risk is `R-nn` and names the TC or automated test that proves the mitigation.
- Every decision is `D-nn`.
- When you add or change any of these, run `make docs` and commit `docs/traceability.md` in the same commit. CI fails if it's stale or an ID is broken.
- Commit messages and PR titles cite the IDs they touch, e.g. `US-07: allocate partial payments`.

## Money rules (never break these)

- Store money as integer minor units (`bigint` cents). No floats, no `numeric` arithmetic in TypeScript.
- The ledger only grows: charges and payments are never updated or deleted. Corrections are reversal rows.
- Balances and charge status are derived (views or queries), never stored by hand.
- `UNIQUE (lease_id, period)` on `rent_charges`; the charge job uses `ON CONFLICT DO NOTHING`.
- Allocations to a charge can never total more than that charge.
- A lease cannot become `active` without a deposit row or an explicit waiver.
- Refund = deposit − deductions. If deductions exceed the deposit, the excess is an amount owed, never a negative refund.
- Proration uses actual days in the month (D-04).

## Working rules

1. **Docs first.** No code for a story until its acceptance criteria exist in `docs/user-stories.md`.
2. **Plan, then wait.** For each sprint or milestone, propose a plan and wait for approval before writing code.
3. **Show migrations before applying them.** Print the SQL, wait for OK, then apply.
4. **Database rules get tests first.** Each money rule above has a failing test before the migration that satisfies it.
5. **No metric typed by hand.** UAT counts come from `docs/uat/test-cases.csv`; timings come from `docs/user-test.md` raw data. The README Results table is generated from those files, never edited directly.
6. **No invented evidence.** Interviews, user tests and UAT results are recorded only after they happen. Leave placeholders (`[TBD]`) rather than plausible-looking numbers.
7. **Commit at the end of each sprint**, and whenever a done-check passes.
8. Secrets live in `.env.local` (git-ignored). `.env.example` lists every key with no values.

## Definition of done

| Level | Done when |
| --- | --- |
| Story | AC pass as automated tests where possible; matching TC rows exist; traceability updated |
| Sprint | Every story in scope is done; sprint review notes written in `docs/sprint-plan.md`; tagged commit |
| Release (v1) | All Must FRs done; UAT exit criteria met (`docs/uat-plan.md` §5); README Results generated |

## Current status

S1 done on `dev` (tag `s1`); S2 (money flows) in progress. S0 discovery has not run (D-16). See `docs/sprint-plan.md`, `docs/feature-map.md` and `docs/open-questions.md`.
