# Feature map

One row per feature, in build order. The user is the self-managing landlord from PRD §3 unless a row says otherwise. Acceptance criteria are the ones in [user-stories.md](user-stories.md), shortened here; where I tightened one, the story file has the full wording and [decisions.md](decisions.md) has the reason. Status is one of `not started`, `in progress`, `done`.

| Story | Feature | The job the landlord is doing | Acceptance criteria (short) | Priority | Sprint | Status |
| --- | --- | --- | --- | --- | --- | --- |
| US-01 | Sign up and sign in | Get a private account and come back to it | Sign up lands on the home page; wrong password says "Email or password is incorrect"; signed out, every app page redirects to sign-in and returns to the page asked for | Must | S1 | done |
| US-02 | My data stays mine | Trust that nobody else sees tenant or money records | B can't list, read or write A's rows through the API; every table has RLS and a cross-account test | Must | S1 | done |
| US-03 | Properties and units | Put each real place into the app once | Add "12 Elm St" with units A and B in one form; duplicate label refused; unit with an active lease can't be archived | Must | S1 | done |
| US-04 | Tenants | Know who to call about a balance | Tenant needs a name and a phone or email; "Add a phone number or email" otherwise | Must | S1 | done |
| US-05 | Create a lease | Record who rents which unit, for how much, from when | New lease saves as `draft`; end before start refused; no two overlapping active leases on a unit | Must | S1 | done |
| US-06 | Deposit gate | Never activate a lease and forget the deposit | Activate without deposit or waiver says "Record a deposit or a waiver first"; works with either; a direct SQL update is refused too | Must | S1 | done |
| US-17 | Record a deposit | Keep deposit money apart from rent | Deposit shows in its own section, not the rent ledger; instalments add up | Must | S1 | done |
| US-10 | Generate monthly charges | Bill the month for every lease in one action | One charge per active lease with the right due date; running it again creates none and says "0 new charges, 3 already existed"; two runs at once still make one each; drafts aren't charged | Must | S2 | not started |
| US-11 | Prorate the first month | Bill a mid-month move-in fairly | Start 2026-11-16 at 1,200.00 gives 600.00; start on the 1st gives full rent | Must | S2 | not started |
| US-09 | Early move-out | Close a lease early without hand maths | Move-out 2027-02-10 gives a 428.57 February; if February was already billed, a −771.43 adjustment is added; nothing is charged after | Must | S2 | not started |
| US-12 | Record a payment | Make the app match the bank | Payment shows with who recorded it and when; repeated reference refused; zero or negative refused | Must | S2 | not started |
| US-13 | Partial payments | See what's still owed after a part-payment | 500.00 against 1,200.00 leaves 700.00 `partial`; default allocation is oldest first; manual override; database refuses over-allocation | Must | S2 | not started |
| US-14 | Overpayment becomes credit | Let extra money pay next month | 1,500.00 against 1,200.00 leaves 300.00 credit; it's applied to January when January is charged, shown as a ledger row | Must | S2 | not started |
| US-15 | Reverse a bounced payment | Undo a payment without losing history | Reversal reopens the charge and keeps the payment visible as reversed; SQL delete refused | Should | S2 | not started |
| US-16 | Lease ledger | Answer "what do I owe?" from one page | Every row in date order with a running balance that ties to the charge balances minus credit | Must | S2 | not started |
| US-07 | Change rent mid-lease | Raise the rent without rewriting old bills | New rent from 2027-01 leaves Nov and Dec at 1,200.00; an already-charged month is refused with "January is already charged; choose a later month" | Must | S3 | not started |
| US-18 | Deposit deductions | Say what's being kept from the deposit and why | Deduction needs a reason ("Add a reason"); refund due drops by the deduction | Must | S3 | not started |
| US-19 | Refund or amount owed | Pay back exactly the right amount | Refund = deposit − deductions, `pending` until paid; deductions above the deposit become a "Deductions above deposit" charge; database refuses a wrong amount | Must | S3 | not started |
| US-20 | Overdue rent | Know who to chase today | Each overdue charge with tenant, unit, balance, days overdue; paid and not-yet-due charges left out | Must | S3 | not started |
| US-21 | Pending refunds | Not forget a refund | Ended leases with a deposit and no refund paid, with amount and days since end; drops off once paid | Must | S3 | not started |
| US-08 | Renew a lease | Start a new term without retyping the tenancy | New lease linked to the old; old ends on its end date; deposit can carry over with no refund on the old lease | Should | S3 | not started |
| US-22 | CSV export | Send the numbers to an accountant | Ledger and both reports download with the same rows and columns, amounts as decimals | Should | S3 | not started |
| US-23 | Dashboard | See the month at a glance | Units occupied, rent due this month, total overdue, deposits held, each linking to its detail | Could | S3 | not started |
| NFR-09 | Demo seed | Rebuild the demo after the free database is reset | One command builds a demo account with 12+ months of history | Must | S3 | not started |
