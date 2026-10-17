// US-13, US-16: the charges table and the lease ledger (server components).
import { CURRENCY, formatMoney } from "@/lib/money";
import { formatTimestamp } from "@/lib/dates";
import { ReverseForm } from "./reverse-form";
import { ledgerLines } from "./ledger-rows";

export type ChargeBalance = {
  charge_id: string;
  kind: "rent" | "deposit_shortfall";
  period: string | null;
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

export function LedgerTable({
  rows,
  userId,
  leaseId,
  reversed,
  today,
}: {
  rows: LedgerRow[];
  userId: string;
  leaseId: string;
  reversed: Set<string>;
  today: string;
}) {
  const lines = ledgerLines(rows, reversed, CURRENCY);
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
          {rows.map((r, i) => {
            const line = lines[i];
            return line.sub ? (
              <tr key={r.ref_id} className="sub">
                <td />
                <td style={{ paddingLeft: "1.5rem" }}>↳ {line.entry}</td>
                <td />
                <td />
              </tr>
            ) : (
              <tr key={r.ref_id}>
                <td>{line.date}</td>
                <td>
                  {r.description}
                  {r.entry_type === "payment" && reversed.has(r.ref_id) && (
                    <>
                      {" "}
                      <span className="badge reversed">Reversed</span>
                    </>
                  )}
                  {r.entry_type === "payment" && (
                    <span className="hint">
                      Recorded {formatTimestamp(r.created_at)} by {r.created_by === userId ? "you" : "another user"}
                    </span>
                  )}
                  {r.entry_type === "payment" && !reversed.has(r.ref_id) && (
                    <ReverseForm leaseId={leaseId} paymentId={r.ref_id} today={today} />
                  )}
                </td>
                <td className="num">{line.amount}</td>
                <td className="num" data-testid="running-balance">
                  {line.balance}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
