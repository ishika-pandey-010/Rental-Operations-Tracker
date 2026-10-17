# User guide

This is the walkthrough given to each participant before the app half of the timed user test ([protocol](user-test-protocol.md) §3). It takes about ten minutes to go through on screen with the participant. It's written for a landlord, not a developer: it says where things are and what the app will and won't let you do.

The examples use the user-test account (`make seed-user-test`): Test House with units A, B and C, rent 1,200.00 each, October already charged and paid.

## The idea in one paragraph

Each tenant has a **lease**: which unit, from when to when, how much rent, and which day it's due. Every month you **charge** the rent with one button. When money arrives you **record a payment** against the lease, and the app works out which months it pays. Deposits are kept apart from rent. When a tenant leaves you record the **move-out**, any **deductions**, and the **refund**. The app won't let you do the things that cause trouble in a spreadsheet: charge a month twice, apply a payment to more than is owed, or start a lease without deciding about the deposit.

## Finding your way around

The bar at the top has seven links (Home, Properties, Tenants, Leases, Charges, Overdue, Refunds) and a Sign out button on the right.

**Home** shows four numbers for this month: how many units are occupied, how much rent is due (and how much of it isn't paid), how much is overdue, and how much deposit money you're holding. Click any of them to see the detail. There's also a **Generate rent** button for the current month.

## Charging the month's rent

On Home, click **Generate rent for November 2026** (or go to Charges, pick the month, and click **Generate rent**). Every active lease gets its charge for that month. The message says how many were created, for example "3 new charges, 0 already existed".

You can't charge a month twice. If you're not sure whether you already did it, press the button again: the message will say "0 new charges, 3 already existed" and nothing changes.

If a tenant moved in or out partway through the month, the charge covers only their days, and its description says so ("Prorated: 15 of 30 days").

## Recording a payment

Open the lease: Leases, then the unit's name. You can also click a unit on the Charges page or a tenant on the Overdue page.

In **Record a payment**, type the amount. The date is already today and the method is whatever you used last time for this lease; change them if needed. The reference (a transfer reference or cheque number) is optional, but if you give one, the app won't let you record the same reference twice on the same lease. Click **Record payment**.

By default the payment pays the oldest unpaid month first. If it's more than is owed, the rest is kept as **credit** and is used automatically on the next charge. If it's less, the month shows what's still owed, with a **Partial** label.

To decide yourself which months a payment covers, choose **Choose which charges it pays** and type an amount against each month.

The **Charges** table on the lease page shows each month's amount, what's been paid and what's left. The **Ledger** below it lists everything in date order with a running balance. A positive balance means the tenant owes you; a negative one means they've paid ahead.

If a payment bounces, click **Reverse…** on its line in the ledger, give a reason, and confirm. The payment stays in the history marked "Reversed", and the months it paid are owed again.

## When a tenant leaves

On the lease page, in **Move-out**, enter the last day the tenant had the unit and click **Record move-out**. The lease ends. The final month is charged only up to that day; if it was already charged in full, the app adds a correcting line rather than changing the original. Any rent paid for days after the move-out becomes credit.

Then, in the **Deposit** section:

1. Add any **deductions**: an amount and a reason, for example 150.00 for carpet cleaning. Each one needs a reason, because that's what you'll show the tenant.
2. The app shows **Refund due**: the deposit minus the deductions. If the deductions come to more than the deposit, the difference is charged to the tenant as "Deductions above deposit" and the refund is 0.00.
3. When you've paid the refund, click **Mark … refund paid**. The button shows the exact amount, so check it against what you sent. After that, the deposit is closed.

**Refunds** in the top bar lists every tenant who has left and whose refund you haven't recorded yet.

## Setting up (not part of the timed task)

- **Properties:** type the property name and its units separated by commas ("A, B, C"), then click **Add property**.
- **Tenants:** a name plus a phone number or email.
- **Leases → New lease:** choose the unit and tenant; the dates default to a one-year lease starting next month. Save it, then on the next page type the deposit and click **Record and activate**. A lease with no deposit needs a **waiver** (a date and a reason) before it can be activated.
- **Change the rent** and **Renew this lease** are on the lease page, under Terms and Renew.

## What the app won't do

- Take payments online, send reminders, or give tenants a login.
- Charge late fees.
- Let you edit or delete a payment or a charge. Mistakes are fixed by adding a correcting line (a reversal, an adjustment), so the history always explains the balance.
