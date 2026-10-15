# User stories

Each story names the requirement it delivers (FR/NFR in [PRD.md](PRD.md)) and the sprint it's planned for. Acceptance criteria (AC) use Given/When/Then. If an AC can't be written that way, the requirement is still ambiguous and goes back to the PRD.

Unless a story says otherwise, examples use a lease with **monthly rent 1,200.00, due day 1**. Money is shown with two decimals but stored in cents (D-02).

**Story format**

```text
US-nn  Title                                   FR-nn · Priority · Sprint · Points
As a <persona>, I want <capability>, so that <outcome>.
AC1  Given … When … Then …
```

Points are relative size estimates (1, 2, 3, 5, 8) set in S0 backlog refinement.

---

## Epic E1 — Account and access

### US-01 Sign up and sign in
FR-01 · Must · S1 · 2

As a landlord, I want my own account, so that my rent records are private to me.

- **AC1** Given I'm on the sign-up page, when I enter a valid email and password, then my account is created and I land on an empty dashboard.
- **AC2** Given I have an account, when I sign in with the wrong password, then I see "Email or password is incorrect" and I'm not signed in.
- **AC3** Given I'm signed in, when I sign out, then visiting any app page sends me to the sign-in page.

### US-02 My data stays mine
FR-02, NFR-03 · Must · S1 · 3

As a landlord, I want other accounts to be unable to see or change my data, so that tenant details and money records stay confidential.

- **AC1** Given landlords A and B each have a property, when B lists properties, then B sees only B's property.
- **AC2** Given A's lease ID, when B requests that lease directly through the API, then no row is returned.
- **AC3** Given A's lease ID, when B tries to insert a payment against it, then the insert is rejected.
- **AC4** Given any table in the schema, when the RLS test suite runs, then every table has RLS enabled and is covered by at least one cross-account test.

---

## Epic E2 — Portfolio setup

### US-03 Properties and units
FR-03 · Must · S1 · 3

As a landlord, I want to list my properties and their units, so that every lease belongs to a real place.

- **AC1** Given I'm on Properties, when I add "12 Elm St" with units "A" and "B", then both units appear under that property.
- **AC2** Given unit A has an active lease, when I try to archive unit A, then I see "Unit has an active lease" and it stays active.
- **AC3** Given a property already has unit "A", when I add another unit "A" to it, then I see "Unit label already used in this property".

### US-04 Tenants
FR-04 · Must · S1 · 2

As a landlord, I want to keep each tenant's contact details, so that I know who to contact about a balance.

- **AC1** Given I'm on Tenants, when I add a tenant with a name and phone or email, then the tenant appears in the list.
- **AC2** Given I add a tenant with neither phone nor email, when I save, then I see "Add a phone number or email".

---

## Epic E3 — Leases

### US-05 Create a lease
FR-05 · Must · S1 · 3

As a landlord, I want to record a lease between a tenant and a unit, so that rent can be charged against it.

- **AC1** Given a unit and a tenant, when I create a lease from 2026-11-01 to 2027-10-31 at 1,200.00 due on day 1, then it's saved as `draft`.
- **AC2** Given I enter an end date before the start date, when I save, then I see "End date must be after start date".
- **AC3** Given unit A already has an active lease, when I try to activate a second lease on unit A with overlapping dates, then activation is refused.

### US-06 No active lease without a deposit decision
FR-06 · Must · S1 · 3

As a landlord, I want the app to stop me activating a lease until the deposit is recorded or explicitly waived, so that I never lose track of a deposit.

- **AC1** Given a draft lease with no deposit and no waiver, when I activate it, then I see "Record a deposit or a waiver first" and it stays `draft`.
- **AC2** Given a draft lease with a deposit of 1,200.00 recorded, when I activate it, then it becomes `active`.
- **AC3** Given a draft lease, when I record a waiver with a reason and date, then I can activate it, and the waiver shows on the lease page.
- **AC4** Given the rule is in the database, when an `active` status is written directly by SQL without a deposit or waiver, then the write fails.

### US-07 Change rent mid-lease
FR-07 · Must · S3 · 3

As a landlord, I want to set a new rent from a given month, so that past charges stay exactly as they were billed.

- **AC1** Given an active lease at 1,200.00 with charges for Nov and Dec, when I set 1,250.00 effective 2027-01, then the January charge is 1,250.00 and Nov and Dec stay 1,200.00.
- **AC2** Given a charge for 2027-01 already exists, when I set a rent change effective 2027-01, then I see "January is already charged; choose a later month" and nothing changes.

### US-08 Renew a lease
FR-18 · Should · S3 · 3

As a landlord, I want to renew a lease for a new term, so that the tenant's history and deposit carry over.

- **AC1** Given an active lease ending 2027-10-31, when I renew it from 2027-11-01 to 2028-10-31, then a new lease is created linked to the old one, and the old lease ends on 2027-10-31.
- **AC2** Given the old lease holds a 1,200.00 deposit, when I renew with "carry deposit over", then the new lease shows the deposit and no refund is created for the old lease.

### US-09 Early move-out
FR-17, FR-09 · Must · S2 · 5

As a landlord, I want to record that a tenant left early, so that the final month is prorated and no further rent is charged.

- **AC1** Given an active lease at 1,200.00, when I record a move-out on 2027-02-10, then the February charge is 428.57 (1,200.00 × 10 ÷ 28, half-up) and the lease becomes `ended`.
- **AC2** Given February was already charged at 1,200.00, when I record the move-out, then a proration adjustment of −771.43 is added and the original charge stays visible.
- **AC3** Given the lease is ended, when charges are generated for March, then no charge is created for this lease.

---

## Epic E4 — Charges

### US-10 Generate monthly charges
FR-08 · Must · S2 · 5

As a landlord, I want one click to create this month's rent for every active lease, so that I don't type each row by hand.

- **AC1** Given three active leases, when I generate charges for 2026-12, then three charges are created, each with the lease's rent and a due date on its due day.
- **AC2** Given charges for 2026-12 already exist, when I generate charges for 2026-12 again, then no new charges are created and I see "0 new charges, 3 already existed".
- **AC3** Given two generation requests for the same month run at the same moment, when both finish, then exactly one charge exists per lease.
- **AC4** Given a draft lease, when I generate charges, then the draft lease gets no charge.

### US-11 Prorate the first month
FR-09 · Must · S2 · 2

As a landlord, I want a mid-month move-in to be charged only for the days occupied, so that tenants are billed consistently.

- **AC1** Given a lease starting 2026-11-16 at 1,200.00, when November is charged, then the charge is 600.00 (15 of 30 days: the 16th to the 30th inclusive, 1,200.00 × 15 ÷ 30).
- **AC2** Given a lease starting on the 1st, when the first month is charged, then the charge is the full rent.

---

## Epic E5 — Payments

### US-12 Record a payment
FR-10, NFR-05 · Must · S2 · 3

As a landlord, I want to record money as it arrives, so that the ledger matches my bank.

- **AC1** Given an active lease, when I record 1,200.00 paid on 2026-12-02 by bank transfer with reference "TRX-881", then the payment appears in the lease ledger with my user and timestamp.
- **AC2** Given "TRX-881" is already recorded on this lease, when I record another payment with "TRX-881", then I see "This reference is already recorded for this lease".
- **AC3** Given I enter 0 or a negative amount, when I save, then I see "Amount must be more than zero".

### US-13 Partial payments
FR-11 · Must · S2 · 5

As a landlord, I want a part-payment to reduce what's owed without hiding the rest, so that shortfalls are never forgotten.

- **AC1** Given a December charge of 1,200.00, when I record a payment of 500.00, then the charge shows paid 500.00, balance 700.00, status `partial`.
- **AC2** Given open charges for Nov (balance 200.00) and Dec (1,200.00), when I record 700.00 with default allocation, then 200.00 goes to Nov and 500.00 to Dec.
- **AC3** Given the same charges, when I allocate 700.00 manually all to Dec, then Dec balance is 500.00 and Nov is still 200.00.
- **AC4** Given a charge with balance 700.00, when any allocation would bring its total allocations above 1,200.00, then the database rejects it.

### US-14 Overpayment becomes credit
FR-12 · Must · S2 · 3

As a landlord, I want extra money held as credit, so that it pays the next month automatically.

- **AC1** Given a December charge of 1,200.00 and no other open charges, when I record 1,500.00, then December is `paid` and the lease shows credit 300.00.
- **AC2** Given credit of 300.00, when January's 1,200.00 charge is generated, then 300.00 is allocated to it and its balance is 900.00.

### US-15 Reverse a bounced payment
FR-13, NFR-02 · Should · S2 · 3

As a landlord, I want to reverse a payment that bounced, so that the balance is right and the history still shows what happened.

- **AC1** Given a 1,200.00 payment fully allocated to December, when I reverse it with reason "bounced", then December's balance returns to 1,200.00 and the original payment shows as reversed.
- **AC2** Given any payment, when someone tries to delete it by SQL, then the delete is rejected.

### US-16 Lease ledger
FR-21, NFR-04 · Must · S2 · 3

As a landlord, I want one page that shows everything for a lease in date order, so that I can answer a tenant's question about their balance.

- **AC1** Given charges, payments, allocations and reversals on a lease, when I open its ledger, then I see each row in date order with a running balance.
- **AC2** Given the ledger, when I compare the final running balance with the sum of charge balances, then they're equal (minus any credit).

---

## Epic E6 — Deposits and refunds

### US-17 Record a deposit
FR-14 · Must · S1 · 2

As a landlord, I want to record deposits separately from rent, so that they're never counted as income.

- **AC1** Given a draft lease, when I record a deposit of 1,200.00 received 2026-10-25, then it appears in the deposit section and not in the rent ledger.
- **AC2** Given a deposit paid in two instalments of 600.00, when I record both, then the deposit held is 1,200.00.

### US-18 Deposit deductions
FR-15 · Must · S3 · 2

As a landlord, I want to record what I'm keeping from a deposit and why, so that the tenant gets a clear statement.

- **AC1** Given an ended lease with deposit 1,200.00, when I add a deduction of 150.00 "carpet cleaning", then it's listed with its reason and the refund due becomes 1,050.00.
- **AC2** Given I add a deduction with no reason, when I save, then I see "Add a reason".

### US-19 Refund or amount owed
FR-16 · Must · S3 · 3

As a landlord, I want the refund worked out for me, so that I pay back exactly the right amount.

- **AC1** Given deposit 1,200.00 and deductions 150.00, when I open the refund, then the amount is 1,050.00 and status `pending`.
- **AC2** Given deductions of 1,400.00 on a deposit of 1,200.00, when the refund is calculated, then the refund is 0.00 and a 200.00 charge "Deductions above deposit" is added to the lease.
- **AC3** Given a refund of 1,050.00, when anyone tries to save a refund of a different amount, then the database rejects it.
- **AC4** Given a pending refund, when I mark it paid on a date, then status becomes `paid` with that date.

---

## Epic E7 — Reports

### US-20 Overdue rent
FR-19 · Must · S3 · 3

As a landlord, I want a list of everyone who's behind, so that I know who to chase today.

- **AC1** Given a charge due 2026-12-01 with balance 700.00 and today is 2026-12-11, when I open Overdue, then the row shows tenant, unit, 700.00 and 10 days overdue.
- **AC2** Given a charge that's fully paid, when I open Overdue, then it doesn't appear.
- **AC3** Given a charge not yet due, when I open Overdue, then it doesn't appear.

### US-21 Pending refunds
FR-20 · Must · S3 · 2

As a landlord, I want a list of ended leases whose deposit I still hold, so that refunds aren't forgotten.

- **AC1** Given a lease ended 2027-02-10 with a pending refund, when I open Pending refunds, then it's listed with the refund amount and days since end.
- **AC2** Given the refund is marked paid, when I open Pending refunds, then the lease no longer appears.

### US-22 CSV export
FR-22 · Should · S3 · 2

As a landlord, I want to download the ledger and reports, so that I can send them to my accountant.

- **AC1** Given a lease ledger, when I click Export CSV, then I get a file with the same rows and columns as the page, amounts in decimal form.

### US-23 Dashboard
FR-23 · Could · S3 · 3

As a landlord, I want a one-screen summary, so that I see the month at a glance.

- **AC1** Given my account, when I open the dashboard, then I see units occupied, rent due this month, total overdue and deposits held, each linking to its detail page.
