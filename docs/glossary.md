# Glossary

Terms used across the PRD, stories, data model and UAT sheet. If a doc uses a word differently from this page, the doc is wrong.

| Term | Meaning |
| --- | --- |
| **Landlord** | The single account owner. Owns every property, unit, tenant and lease in their account. |
| **Property** | A building or address. Has one or more units. |
| **Unit** | A rentable space inside a property (flat, room, shop). At most one active lease at a time. |
| **Tenant** | A person or company named on a lease. Has no login (no tenant portal). |
| **Lease** | An agreement between a tenant and a unit, with start date, end date, monthly rent and due day. Status: `draft`, `active`, `ended`. |
| **Rent schedule** | The effective-dated list of monthly rent amounts for a lease. A mid-lease rent change adds a row; it never edits the old one. |
| **Period** | A calendar month, stored as its first day (`2026-11-01`). |
| **Charge** | An amount the tenant owes for a period. One rent charge per lease per period. |
| **Payment** | Money received from a tenant, with date, amount, method and reference. |
| **Allocation** | The part of a payment applied to a specific charge. One payment can be split across several charges. |
| **Partial payment** | A payment whose allocations leave a charge with a balance above zero. |
| **Credit** | The unallocated remainder of a payment (an overpayment). It is applied to the next open charge. |
| **Reversal** | A row that cancels an earlier payment or charge (for example a bounced payment). The original row stays. |
| **Balance** | Charge amount minus allocations to it. Always derived, never stored. |
| **Overdue** | A charge past its due date with a balance above zero. |
| **Proration** | Charging part of a month: monthly rent × days occupied ÷ days in that month. |
| **Deposit** | Money held against damage or unpaid rent. Tracked separately from rent; never counted as income. |
| **Deposit waiver** | An explicit, logged decision that a lease has no deposit. Lets a lease become active without a deposit row. |
| **Deduction** | An amount withheld from a deposit, with a reason. |
| **Refund** | Deposit minus deductions, paid back after the lease ends. |
| **Amount owed** | What remains when deductions exceed the deposit. Becomes a charge, never a negative refund. |
| **RLS** | Row-level security: Postgres rules that limit every query to the landlord's own rows. |
