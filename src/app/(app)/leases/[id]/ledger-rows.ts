// US-16, US-22: one definition of what a ledger row shows, used by the page
// table and the CSV export so the two can't drift apart (TC-RPT-06).
import { formatMoney } from "@/lib/money";
import type { LedgerRow } from "./money";

export type LedgerLine = { date: string; entry: string; amount: string; balance: string; sub: boolean };

export function ledgerLines(rows: LedgerRow[], reversed: Set<string>, currency: string | null): LedgerLine[] {
  return rows.map((r) =>
    r.entry_type === "allocation"
      ? { date: "", entry: `${r.description}: ${formatMoney(r.allocation_cents, currency)}`, amount: "", balance: "", sub: true }
      : {
          date: r.entry_date,
          entry: r.description + (r.entry_type === "payment" && reversed.has(r.ref_id) ? " (reversed)" : ""),
          amount: formatMoney(r.amount_cents, currency),
          balance: formatMoney(r.balance_cents, currency),
          sub: false,
        },
  );
}
