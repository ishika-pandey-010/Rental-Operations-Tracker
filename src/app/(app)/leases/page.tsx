import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { LEASE_SELECT, rentFor, unitName, type LeaseRow } from "./data";

export const metadata = { title: "Leases" };

const ORDER = { active: 0, draft: 1, ended: 2 } as const;

// US-05: every lease, active first
export default async function LeasesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("leases").select(LEASE_SELECT).order("start_date", { ascending: false });
  const leases = ((data ?? []) as unknown as LeaseRow[]).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const today = todayISO();

  return (
    <>
      <div className="page-head">
        <h1>Leases</h1>
        <Link className="button" href="/leases/new">
          New lease
        </Link>
      </div>
      {leases.length === 0 ? (
        <p className="empty">No leases yet. A lease links a tenant to a unit with a rent and a due day.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Unit</th>
                <th scope="col">Tenant</th>
                <th scope="col">Term</th>
                <th scope="col" className="num">
                  Rent
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/leases/${l.id}`}>{unitName(l)}</Link>
                  </td>
                  <td>{l.tenant.full_name}</td>
                  <td>
                    {l.start_date} to {l.move_out_date ?? l.end_date}
                  </td>
                  <td className="num">{formatMoney(rentFor(l, today)?.monthly_rent_cents)}</td>
                  <td>
                    <span className={`badge ${l.status}`}>{l.status[0].toUpperCase() + l.status.slice(1)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
