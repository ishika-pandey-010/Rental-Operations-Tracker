# Competitive analysis

Research date: 2026-10-15. Sources are each project's public README or the vendor's own help pages, so feature claims are the makers' own descriptions. Star counts are from GitHub search on that date.

## Open-source projects

| Project | Stars | Stack | What it does well | Gap for our persona |
| --- | --- | --- | --- | --- |
| [microrealestate](https://github.com/microrealestate/microrealestate) | ~1.2k | Docker microservices, MongoDB, self-hosted | Rents with balances that recalculate when a payment is recorded; lease templates; emailed receipts and notices; tenant portal; second-user access | Self-hosting on a Linux machine is a barrier for a non-technical landlord. Source-available (SUL v2.0) since Feb 2026, with commercial use and more than 5 units excluded |
| [OpenProperty](https://github.com/clawnify/OpenProperty) | ~24 | Cloudflare Workers + D1 | One rent charge per active lease per month, generated idempotently; charge status updates from payments; late fee and grace-day policy; work orders and vendors; a clear "what's intentionally not included" section | README describes the deposit only as a lease field: no deductions or refund workflow |
| [online-rental-property-manager](https://github.com/bigprof-software/online-rental-property-manager) | ~178 | — | Properties, units, applications, leases, tenants | Description covers records, not a rent ledger with partial payments |
| [hausverwaltung](https://github.com/fgilde/hausverwaltung) | ~14 | — | Rental and HOA (WEG) administration | Aimed at German HOA administration; broader than our scope |

## Commercial tools (from their help and learning pages)

| Source | What it tells us |
| --- | --- |
| [Buildium — tenant ledger](https://www.buildium.com/dictionary/tenant-ledger/), [rent ledger](https://www.buildium.com/dictionary/rent-ledger/) | A tenant ledger records each payment's date, amount, method and reference, with a running balance after each transaction → FR-10, FR-21 |
| [SimplifyEm — partial rent payments](https://www.simplifyem.com/simplifyem-faqs/how-do-i-enter-partial-rent-payments/) | Partial payments are a common, explicitly supported workflow → FR-11 |
| [Rentec Direct — security deposits](https://rentecdirect.com/blog/feature-friday-tenant-security-deposits) | Deposits tracked in their own ledger, separate from rent, with partial deposits and returns at move-out → FR-14 – FR-16, D-08 |
| [Baselane — prorated rent](https://baselane.com/resources/how-to-figure-out-prorated-rent) | Proration conventions vary (e.g. a 30-day standard in California guidance); early move-out can create a prepaid-rent refund → FR-09, D-04, PRD Q1 |
| [Idealogic — property management software architecture](https://idealogic.io/blog/property-management-software) | Argues for an append-only ledger with balances computed from entries → D-03, NFR-02, NFR-04 |

## What we took

| Practice | Seen in | Where it lands |
| --- | --- | --- |
| Balance updates itself from recorded payments | microrealestate, OpenProperty | NFR-04: balances are views |
| Idempotent monthly charge generation | OpenProperty | FR-08, D-06, R-01 |
| A written "not included, and why" list | OpenProperty | PRD §8 |
| Payment record fields (date, amount, method, reference) | Buildium | FR-10 |
| Deposits in a separate ledger with deductions and refunds | Rentec Direct | FR-14 – FR-16, D-08 |
| Append-only ledger, corrections as new entries | Idealogic | D-03, NFR-02 |
| Feature list with concrete fields and behaviour, not adjectives | microrealestate, OpenProperty READMEs | README, user stories |

## Where we differ on purpose

| They have | We don't (v1) | Why |
| --- | --- | --- |
| Tenant portal (microrealestate) | No tenant logins | PRD §8: doubles auth/RLS surface; not needed for P1–P5 |
| Late fees, work orders, vendors (OpenProperty) | Parked for v2 | D-12 |
| Self-hosting as the main install path | Hosted web app | Persona isn't technical |

## Our position

The open-source tools record rent well, but none of the READMEs we reviewed describe **database-enforced** money rules (no duplicate charges, no over-allocation, no active lease without a deposit decision) together with a **full deposit-to-refund lifecycle**. That combination is the product's reason to exist, and every rule has a named test ([traceability](traceability.md)).
