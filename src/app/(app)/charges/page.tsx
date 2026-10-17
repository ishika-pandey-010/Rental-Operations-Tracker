import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Flash } from "@/components/form";
import { formatMoney } from "@/lib/money";
import { monthName, todayISO } from "@/lib/dates";
import { GenerateForm } from "./generate-form";

export const metadata = { title: "Charges" };

type ChargeRow = {
  id: string;
  lease_id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  lease: { tenant: { full_name: string }; unit: { label: string; property: { name: string } } };
};

// US-10, US-11: generate a month's rent and see what it created
export default async function ChargesPage({ searchParams }: { searchParams: Promise<{ month?: string; done?: string }> }) {
  const { month: m, done } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : todayISO().slice(0, 7);
  const supabase = await createClient();
  const [{ data }, { count: activeLeases }] = await Promise.all([
    supabase
      .from("charges")
      .select("id, lease_id, description, amount_cents, due_date, lease:leases(tenant:tenants(full_name), unit:units(label, property:properties(name)))")
      .eq("kind", "rent")
      .eq("period", `${month}-01`)
      .order("due_date"),
    supabase.from("leases").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  const charges = (data ?? []) as unknown as ChargeRow[];

  return (
    <>
      <h1>Charges</h1>
      <Flash message={done} />
      {!activeLeases && charges.length === 0 ? (
        <p className="empty">
          No active leases to charge yet. <Link href="/leases">Activate a lease</Link> first.
        </p>
      ) : (
        <GenerateForm month={month} />
      )}
      <h2>Rent for {monthName(month)}</h2>
      {charges.length === 0 ? (
        <p className="muted">Nothing charged for {monthName(month)} yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Unit</th>
                <th scope="col">Tenant</th>
                <th scope="col">Charge</th>
                <th scope="col">Due</th>
                <th scope="col" className="num">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id}>
                  <th scope="row" style={{ fontWeight: 400, color: "inherit", fontSize: "inherit" }}>
                    <Link href={`/leases/${c.lease_id}`}>
                      {c.lease.unit.property.name} · {c.lease.unit.label}
                    </Link>
                  </th>
                  <td>{c.lease.tenant.full_name}</td>
                  <td>{c.description}</td>
                  <td>{c.due_date}</td>
                  <td className="num">{formatMoney(c.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
