import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { AsOfForm, validDate } from "@/components/as-of";

export const metadata = { title: "Pending refunds" };

type Row = {
  lease_id: string;
  tenant_name: string;
  unit_name: string;
  ended_on: string;
  held_cents: number;
  deductions_cents: number;
  refund_due_cents: number;
  days_since_end: number;
};

// US-21 Pending refunds: deposits still held after the tenant left
export default async function RefundsPage({ searchParams }: { searchParams: Promise<{ as_of?: string }> }) {
  const { as_of } = await searchParams;
  const asOf = validDate(as_of, todayISO());
  const supabase = await createClient();
  const { data } = await supabase.rpc("pending_refunds", { p_as_of: asOf });
  const rows = (data ?? []) as Row[];

  return (
    <>
      <div className="page-head">
        <h1>Pending refunds</h1>
      </div>
      <p className="muted">Ended leases where you still hold a deposit and haven&apos;t recorded the refund.</p>
      <AsOfForm asOf={asOf} action="/reports/refunds" />
      {rows.length === 0 ? (
        <p className="empty">No refunds waiting as of {asOf}.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Tenant</th>
                <th scope="col">Unit</th>
                <th scope="col">Ended</th>
                <th scope="col" className="num">Since</th>
                <th scope="col" className="num">Held</th>
                <th scope="col" className="num">Deductions</th>
                <th scope="col" className="num">Refund due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.lease_id}>
                  <td>
                    <Link href={`/leases/${r.lease_id}`}>{r.tenant_name}</Link>
                  </td>
                  <td>{r.unit_name}</td>
                  <td>{r.ended_on}</td>
                  <td className="num">
                    {r.days_since_end} day{r.days_since_end === 1 ? "" : "s"}
                  </td>
                  <td className="num">{formatMoney(r.held_cents)}</td>
                  <td className="num">{formatMoney(r.deductions_cents)}</td>
                  <td className="num">{formatMoney(r.refund_due_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
