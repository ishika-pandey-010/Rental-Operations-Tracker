# UAT plan

## 1. Purpose

Confirm, before v1 release, that every story's acceptance criteria hold in the deployed app, and that every product risk's proving test passes. The UAT sheet is [`uat/test-cases.csv`](uat/test-cases.csv); counts in the README come from that file (CLAUDE.md rule 5).

## 2. Scope

| In | Out |
| --- | --- |
| Every story US-01 – US-23 and its AC | Load testing beyond NFR-07 |
| Every product risk R-01 – R-09 proving test | Penetration testing (RLS is tested functionally) |
| Keyboard use, cross-browser smoke (NFR-06, NFR-08) | Out-of-scope features in PRD §8 |

## 3. Modules and cases

| Module | Covers | Cases |
| --- | --- | --- |
| AUTH | Sign up, sign in, sign out, redirects | US-01 |
| SETUP | Properties, units, tenants | US-03, US-04 |
| LEASE | Lease lifecycle, deposit gate, rent change, renewal, move-out | US-05 – US-09 |
| CHG | Charge generation, idempotency, proration | US-10, US-11 |
| PAY | Payments, allocation, credit, reversal, ledger | US-12 – US-16 |
| DEP | Deposits, deductions, refunds | US-17 – US-19 |
| RPT | Overdue, pending refunds, CSV, dashboard | US-20 – US-23 |
| NFR | Data isolation, money type, accessibility, seed, speed, browsers | US-02, NFR-01, -06 – -09 |

Live counts per module: [traceability.md](traceability.md#uat-sheet-status). Cases are added as stories are refined; the sheet is expected to grow during S1–S2.

## 4. Environment and data

- **Where:** the hosted demo (Vercel + Supabase), not local dev.
- **Data:** a fresh account from `make seed`, plus a second account for the cross-account cases (TC-NFR-01 – 03).
- **Database cases** (TC-LEASE-07, TC-PAY-07, TC-PAY-11, TC-DEP-07, TC-NFR-04, TC-NFR-08) run through the Supabase SQL editor or the automated database tests and record the error message.
- **Dates:** cases that depend on "today" (RPT-01) fix the date by seed data, not by waiting.

## 5. Entry and exit criteria

| | Criteria |
| --- | --- |
| **Entry** | All S1–S3 stories merged; automated tests green on `main`; demo deployed and seeded; UAT sheet reviewed |
| **Exit** | Every case executed (status not `Not run`); 100% of Critical and High cases `Pass`; no open Critical or High bugs; every Medium/Low failure has a bug with a decision (fix now / later) |

## 6. How to run a case

1. Set up the precondition.
2. Follow the steps exactly; don't improvise around a problem.
3. Write what actually happened in `actual`, even on a pass.
4. Set `status` to `Pass`, `Fail` or `Blocked`; fill `tested_by` and `tested_on` (YYYY-MM-DD).
5. On `Fail`, raise a bug (next section) and put its ID in `bug`.
6. Run `make docs` so the status counts update.

## 7. Bug workflow

| Severity | Meaning | Fix by |
| --- | --- | --- |
| **Critical** | Wrong money, data visible across accounts, or a money rule bypassed | Before anything else; blocks release |
| **High** | A Must story's AC fails with no workaround | Within the sprint; blocks release |
| **Medium** | Fails with a workaround, or a Should story fails | Before release, or logged as a known issue with a decision |
| **Low** | Cosmetic or wording | Backlog |

Lifecycle: `Open → In progress → Fixed → Verified (re-run the case) → Closed`. A bug is only `Closed` when its TC passes on re-run. Every Critical and High fix also gets an automated test so it stays fixed (Playwright or a database test), linked in the bug.

Bug fields (Jira, mirrored in the GitHub bug template): ID, TC ID, story, severity, steps, expected, actual, screenshot, environment, fixed in commit, verified on.

## 8. Sign-off

| Role | Name | Date | Result |
| --- | --- | --- | --- |
| Product owner | [TBD] | [TBD] | [TBD] |
| Tester (user 1) | [TBD] | [TBD] | [TBD] |
