# Changing the rent mid-lease, 2026-10-18

## What the user needs
The landlord has agreed a rent rise with the tenant from January. They want January onward billed at the new amount, and November and December to stay exactly as they were billed, because those are what the tenant already saw.

## What the docs said
- FR-07, US-07 ([user-stories.md](../user-stories.md#us-07-change-rent-mid-lease)): 1,250.00 from 2027-01 leaves Nov and Dec at 1,200.00 (AC1); setting it from an already-charged month says "January is already charged; choose a later month" and changes nothing (AC2).
- D-05: rent lives in an effective-dated schedule.

## Plan
A trigger on `lease_rent_schedule`, a `change_rent()` function, and a collapsed "Change the rent" form in the lease's Terms section. Charge generation already read the schedule (`rent_for_period`), so nothing there changes. Left out: rent decreases or one-off discounts as anything other than a new schedule row; a decrease is the same action with a smaller number.

## Tests written
Database (`tests/db/rent-change.test.ts`, 8 tests). Before the migration all 8 failed: three with `function change_rent(...) does not exist`, and the others because the SQL insert they expected to be refused went through.
- TC-LEASE-08, TC-LEASE-09.
- Mine: a later charged month (February) is named when it's the one in the way; a direct SQL insert is refused the same way; a mid-month date takes effect from the 1st; a month after the lease end is refused; an ended lease is refused; a second change from the same month is a duplicate.

End-to-end (`e2e/rent-change.spec.ts`): TC-LEASE-08 including the generated January charge, TC-LEASE-09 including keeping the typed amount.

## What I built
- `supabase/migrations/20261018160000_rent_change.sql`: `enforce_rent_schedule_rules()` locks the lease (D-26), so a rent change and a charge run can't race, then refuses anything that would rewrite a charged month. The message names the earliest charged month in the way, by month name as the AC words it.
- Lease page: "Change the rent" opens a form with New monthly rent and From month.

## User review
- Main task: raise the rent to 1,250.00 from January.
- Steps: click "Change the rent", type 1,250.00, click Set new rent. 2 clicks, 1 typed field. The From month is already set to the month after the last one charged, which is nearly always the month the landlord means. Without that default it's one more field to fill in and one more chance to hit TC-LEASE-09's error.
- Afterwards, Terms lists both rates ("$1,200.00 a month from November 2026", "$1,250.00 a month from January 2027"), so the history of the rent is visible where the landlord looks for it.
- The form starts collapsed because rent changes are rare and the lease page is long. It opens by itself when there's an error, so the message and the typed amount aren't hidden.
- Remaining friction: no notice to the tenant is produced; the app records, it doesn't communicate (no story asks for letters or email).

## Decisions
None new; D-05 is what made this one trigger.

## Doc changes
- data-model.md: `lease_rent_schedule` rule.
- feature-map.md: US-07 done. All Must stories are now done.

## Open questions
None new.

## Next
Renewal (US-08, Should), then CSV export (US-22, Should) and the dashboard (US-23, Could).
