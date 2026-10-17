// US-13, US-16: the charges table and the lease ledger (server components).
import { formatMoney } from "@/lib/money";
import { formatTimestamp } from "@/lib/dates";

export type ChargeBalance = {
  charge_id: string;
  description: string;
  due_date: string;
  value_cents: number;
  allocated_cents: number;
  balance_cents: number;
  status: "open" | "partial" | "paid" | "cancelled";
};

export type LedgerRow = {
  seq: number;
  entry_date: string;
  entry_type: "charge" | "adjustment" | "payment" | "allocation" | "reversal";
  description: string;
  ref_id: string;
  amount_cents: number;
  allocation_cents: number | null;
  balance_cents: number;
  created_at: string;
  created_by?: string;
};

const STATUS = { open: "Open", partial: "Partial", paid: "Paid", cancelled: "Cancelled" };

export function ChargesTable({ charges }: { charges: ChargeBalance[] }) {
  if (charges.length === 0) return <p className="muted">No charges yet. Rent is charged from the Charges page each month.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Charge</th>
            <th scope="col">Due</th>
            <th scope="col" className="num">Amount</th>
            <th scope="col" className="num">Paid</th>
            <th scope="col" className="num">Balance</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {charges.map((c) => (
            <tr key={c.charge_id}>
              <th scope="row" style={{ fontWeight: 400, color: "inherit", fontSize: "inherit" }}>
                {c.description}
              </th>
              <td>{c.due_date}</td>
              <td className="num">{formatMoney(c.value_cents)}</td>
              <td className="num">{formatMoney(c.allocated_cents)}</td>
              <td className="num">{formatMoney(c.balance_cents)}</td>
              <td>
                <span className={`badge ${c.status}`}>{STATUS[c.status]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LedgerTable({ rows, userId }: { rows: LedgerRow[]; userId: string }) {
  if (rows.length === 0)
    return <p className="muted">Nothing charged or paid yet. Charges, payments and where each payment went will appear here in date order.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Entry</th>
            <th scope="col" className="num">Amount</th>
            <th scope="col" className="num">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) =>
            r.entry_type === "allocation" ? (
              <tr key={r.ref_id} className="sub">
                <td />
                <td style={{ paddingLeft: "1.5rem" }}>
                  ↳ {r.description}: {formatMoney(r.allocation_cents)}
                </td>
                <td />
                <td />
              </tr>
            ) : (
              <tr key={r.ref_id}>
                <td>{r.entry_date}</td>
                <td>
                  {r.description}
                  {r.entry_type === "payment" && (
                    <span className="hint">
                      Recorded {formatTimestamp(r.created_at)} by {r.created_by === userId ? "you" : "another user"}
                    </span>
                  )}
                </td>
                <td className="num">{formatMoney(r.amount_cents)}</td>
                <td className="num" data-testid="running-balance">
                  {formatMoney(r.balance_cents)}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
