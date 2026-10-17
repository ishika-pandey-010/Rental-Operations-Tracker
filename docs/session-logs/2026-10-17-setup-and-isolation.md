# Properties, units, tenants and data isolation, 2026-10-17

## What the user needs
A landlord setting up for the first time wants to enter each building, its flats and the people renting them once, and to be sure no other account can ever see those names and numbers.

## What the docs said
- FR-02, NFR-03, US-02 ([user-stories.md](../user-stories.md#us-02-my-data-stays-mine)): another landlord can't list, read or write my rows; every table has RLS and a cross-account test.
- FR-03, US-03: properties and units, unique labels per property, no archiving a unit with an active lease.
- FR-04, US-04: tenants need a name and a phone or email.
- data-model.md: `UNIQUE (property_id, label)`, `CHECK (email IS NOT NULL OR phone IS NOT NULL)`, RLS on `owner_id`.

## Plan
Three migrations (shared helpers, properties and units, tenants), the cross-account test suite, and the Properties and Tenants pages. Left out on purpose: the archive rules that depend on leases (TC-SETUP-03 and the property and tenant versions). Their tests are written but held back to the leases branch, because the trigger they test can't exist before the `leases` table does.

## Tests written
Database (`tests/db/setup.test.ts`, `tests/db/rls.test.ts`), written before the migrations and run first against an empty schema. All failed with `function create_property(...) does not exist` or `relation "tenants" does not exist`, which is the expected reason.
- TC-SETUP-01, 02, 04, 05, 06, 07, plus: first-use empty list, blank property name, trimmed unit labels.
- TC-NFR-01 B lists only B's property. TC-NFR-04 runs twice: every table has RLS and an `owner_id`, and a fresh landlord sees zero rows in every table and view while A has rows in all of them. The suite reads the table list from the catalog, so a new table with no RLS, or one the scenario doesn't fill, fails it.
- B can't read A's tenant, can't add a unit to A's property, can't insert a property with A's `owner_id`, and can't edit A's tenant. The anon role gets "permission denied" on every table.

API (`tests/api/isolation.test.ts`): the same checks through PostgREST with two real signed-up users, because US-02 AC2 says "through the API".

Unit (`tests/unit/errors.test.ts`): constraint names map to the AC wording. These were written alongside `src/lib/errors.ts`, not before it, so they never failed first.

End-to-end (`e2e/setup.spec.ts`): TC-SETUP-01, 02, 04, 05, 06, 07, the empty states, renaming a property, and the browser's required-field check.

## What I built
- `supabase/migrations/20261017100000_base.sql`: `stamp_row()` sets `created_by` and `created_at` on insert (NFR-05); `reject_ledger_change()` is used by the ledger tables from the next branch on; default privileges are revoked so no table is exposed until a migration grants it.
- `…100100_properties_units.sql`, `…100200_tenants.sql`: tables, RLS policies, composite `(id, owner_id)` keys (D-21), and `create_property(name, address, labels[])`.
- `src/app/(app)/properties/…` and `src/app/(app)/tenants/…`: list pages with the add form on top, detail pages for editing and archiving.
- `src/lib/form-state.ts`: every action returns `{error | ok, values, seq}`. Forms use `seq` as their key, so they clear after a success and come back with the typed values after an error.

## User review
- Main task: add "12 Elm St" with units A, B and C, then add one tenant.
- The stories read as two steps: add a property, then add units A and B to it. Done that way it's 3 submits and 2 screens. I built one form with a comma-separated Units field: 1 submit, 1 screen, 3 fields. That was a design choice made before the first build, not a change after review.
- Tenant with no contact details, before review: the error appeared and the cursor went back to Full name, which was already filled in, so it took a click or two Tabs to reach Email. After: the cursor lands in Email. One click saved on the most common mistake.
- First use: both pages put the cursor in the first field of the add form when the list is empty, and the empty-state text says what the list is for ("you'll pick them when you create a lease").
- A bug the review turned up: an edit that matched no rows still said "Saved". It happened in a test, when a race made the form submit stale values. Property and tenant edits now ask Postgres for the changed row and show "That record doesn't exist, or it belongs to another account" if none came back.
- Something I got wrong in a test, not the app: TC-SETUP-07 typed into "Phone" before the tenant page had loaded, so the text went into the add form on the list page. The detail form then saved the old number. The end-to-end tests now wait for the page heading before typing.
- Remaining friction: after adding a property the form clears for the next property, but the landlord's next job is usually adding a tenant. The home checklist covers that; a "next step" link on the success message would save a nav click. Not done, to keep the confirmation short.

## Decisions
- D-21 composite owner keys.
- An archived unit's label still blocks a new unit with the same label (OQ-08). Archiving a property or tenant with an active lease is refused (OQ-09); built in the leases branch.

## Doc changes
- feature-map.md: US-02 in progress (it grows with every table), US-03 and US-04 done apart from the lease-dependent archive rule.
- This log.

## Open questions
- OQ-08 and OQ-09 are assumptions waiting for the owner.

## Next
Leases, the deposit gate and deposits (US-05, US-06, US-17). The archive tests held back here come with them.
