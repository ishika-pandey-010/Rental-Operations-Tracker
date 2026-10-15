# Rental Operations Tracker

A rent ledger for small landlords, built with Next.js and Supabase. It tracks leases, monthly charges, partial payments, deposits and refunds. The database itself blocks duplicate charges and missing deposits.

> **Status:** planning. The build plan is in [`Portfolio Build Plan 4 Resume Projects.md`](Portfolio%20Build%20Plan%204%20Resume%20Projects.md) (Project 3).

## Scope

**In:** properties and units, tenants, leases, monthly charge generation, payments split across charges, deposits with deductions and refunds, early move-out proration, overdue and pending-refund reports, Supabase Auth with row-level security.

**Out:** online payment collection, a tenant portal, multi-currency, accounting integrations (CSV export only).

## Data rules

| Rule | Risk it removes |
| --- | --- |
| `UNIQUE (lease_id, period)` on `rent_charges` | Duplicate rent charges |
| A lease cannot go active without a deposit row or an explicit waiver | Missing deposit records |
| A trigger keeps allocations at or below their charge | Over-allocated partial payments |
| Unique payment reference per lease | Double-entered payments |
| Refund = deposit − deductions; any excess becomes an amount owed | Negative refunds |
| Row-level security on every table | One landlord seeing another's data |

Reports are SQL views: `overdue_rent` and `pending_refunds`.

## Stack

Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, RLS, migrations) · Vitest · Playwright · hosted on Vercel and Supabase free plans.

## Roadmap

| Sprint | Scope | Done when |
| --- | --- | --- |
| S0 | PRD, data model, Jira board, risk log, spreadsheet baseline task | PRD reviewed; five testers booked |
| S1 | Schema, RLS, CRUD for properties, units, tenants, leases | Migrations apply cleanly; RLS tests pass |
| S2 | Charges, payments, allocations, deposits, refunds, reports | Every edge-case acceptance test passes |
| S3 | UAT run, bug fixes, user guide, training, timed user test | UAT sheet complete; timings in `docs/user-test.md` |

## Results

Not run yet. Every number here will come from a committed eval or test file, not typed by hand.
