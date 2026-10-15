# Decision log

One line per decision: what, why, and what we gave up. Newest at the bottom. A decision is changed by adding a new row that supersedes the old one, never by editing it.

| ID | Date | Decision | Why | Trade-off / alternative rejected |
| --- | --- | --- | --- | --- |
| D-01 | 2026-10-15 | Next.js + Supabase (Postgres, Auth, RLS) on free plans | Postgres constraints and RLS let the database enforce the money rules; free hosting for a public demo | Supabase free projects pause when idle → seed script and ping before demos (R-11) |
| D-02 | 2026-10-15 | Store money as `bigint` cents | Floats can't represent 0.10 exactly; integer cents make sums exact | Display code must format cents; one currency only |
| D-03 | 2026-10-15 | Append-only ledger: corrections are reversals and adjustments | A ledger you can edit can't be trusted or audited; common practice in rent-ledger design (see competitive analysis) | More rows; the UI must show reversed items clearly |
| D-04 | 2026-10-15 | Prorate by actual days in the month, half-up to the cent | Simple to explain to a tenant; matches the calendar | Some jurisdictions use a 30-day month (e.g. California guidance); revisit if discovery shows target users need it (PRD Q1) |
| D-05 | 2026-10-15 | Rent lives in an effective-dated `lease_rent_schedule`, not one `monthly_rent` column | A mid-lease rent change must not rewrite past charges (FR-07) | One extra join when generating charges |
| D-06 | 2026-10-15 | Charge generation is idempotent: partial unique index + `ON CONFLICT DO NOTHING` | A retried or double-clicked job must not bill twice (P1) | None worth noting |
| D-07 | 2026-10-15 | Payments allocate oldest-first by default; credit auto-applies to the next charge | Matches how landlords think ("pay off what's oldest"); fewer clicks | Landlord must use manual override for unusual cases |
| D-08 | 2026-10-15 | Deposits, deductions and refunds are separate tables, never rows in the rent ledger | Deposits are held money, not income (P3) | Two places to look; the lease page shows both |
| D-09 | 2026-10-15 | Deductions above the deposit become a `deposit_shortfall` charge, never a negative refund | A negative refund is meaningless; the tenant owes money, which the ledger already handles | `charges` needs a `kind` column, so the unique rule is a partial index on `kind = 'rent'` |
| D-10 | 2026-10-15 | A renewal is a new lease linked to the old one | Keeps each term's dates and rent schedule clean; history stays intact | Two leases per tenancy in reports; grouped by `renewed_from_id` |
| D-11 | 2026-10-15 | One landlord per account; `owner_id` on every table drives RLS | Simplest model that fits the persona | No shared access for a second manager in v1 |
| D-12 | 2026-10-15 | Late fees and maintenance work orders are out of v1 | Similar products include them, but they don't address P1–P5 and late-fee rules vary by jurisdiction | Less feature parity with competitors (see competitive analysis) |
| D-13 | 2026-10-15 | Docs are the primary deliverable; every artifact uses stable IDs and a traceability matrix | This is a PM portfolio piece: a reviewer must be able to follow FR → US → TC → R in under a minute | Extra upkeep each time a story changes |
| D-14 | 2026-10-15 | Sprint board and bugs in Jira; GitHub issue templates mirror the same fields | Jira is what PM roles expect to see; GitHub keeps a public copy reviewers can open | Two tools to keep in sync; Jira is the source of truth |
