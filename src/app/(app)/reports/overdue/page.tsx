import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { AsOfForm, validDate } from "@/components/as-of";

export const metadata = { title: "Overdue rent" };

type Row = {
  charge_id: string;
  lease_id: string;
  tenant_name: string;
  unit_name: string;
  description: string;
  due_date: string;
  balance_cents: number;
  days_overdue: number;
};

// US-20 Overdue rent: who to chase today
export default async function OverduePage({ searchParams }: { searchParams: Promise<{ as_of?: string }> }) {
  const { as_of } = await searchParams;
  const asOf = validDate(as_of, todayISO());
  const supabase = await createClient();
  const { data } = await supabase.rpc("overdue_rent", { p_as_of: asOf });
  const rows = (data ?? []) as Row[];
  const total = rows.reduce((s, r) => s + BigInt(r.balance_cents), 0n);

  return (
    <>
      <div className="page-head">
        <h1>Overdue rent</h1>
        {rows.length > 0 && (
          <a className="button secondary" href={`/reports/overdue.csv?as_of=${asOf}`}>
            Export CSV
          </a>
        )}
      </div>
      <p className="muted">Charges past their due date with money still owed. A charge counts as overdue from the day after it&apos;s due.</p>
      <AsOfForm asOf={asOf} action="/reports/overdue" />
      {rows.length === 0 ? (
        <p className="empty">Nobody is behind as of {asOf}.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Tenant</th>
                <th scope="col">Unit</th>
                <th scope="col">Charge</th>
                <th scope="col">Due</th>
                <th scope="col" className="num">Overdue</th>
                <th scope="col" className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.charge_id}>
                  <td>
                    <Link href={`/leases/${r.lease_id}`}>{r.tenant_name}</Link>
                  </td>
                  <td>{r.unit_name}</td>
                  <td>{r.description}</td>
                  <td>{r.due_date}</td>
                  <td className="num">
                    {r.days_overdue} day{r.days_overdue === 1 ? "" : "s"}
                  </td>
                  <td className="num">{formatMoney(r.balance_cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={5}>
                  Total overdue
                </th>
                <td className="num" data-testid="overdue-total">
                  <strong>{formatMoney(total)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
