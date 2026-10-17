import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { monthName, todayISO } from "@/lib/dates";
import { DashboardGenerate } from "./dashboard-generate";

export const metadata = { title: "Home" };

async function count(table: string, filter?: (q: any) => any) {
  const supabase = await createClient();
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n } = await q;
  return n ?? 0;
}

type Totals = {
  units_total: number;
  units_occupied: number;
  rent_due_cents: number;
  rent_unpaid_cents: number;
  overdue_cents: number;
  deposits_held_cents: number;
};

// US-23 Dashboard: four totals, each a link to the page behind it.
async function Dashboard() {
  const today = todayISO();
  const month = today.slice(0, 7);
  const supabase = await createClient();
  const { data } = await supabase.rpc("dashboard_totals", { p_as_of: today }).single();
  const t = data as Totals;
  return (
    <>
      <h1>This month</h1>
      <p className="muted">As of {today}.</p>
      <div className="tiles">
        <Link className="tile" href="/leases">
          <div className="label">Units occupied</div>
          <div className="value">
            {t.units_occupied} of {t.units_total}
          </div>
        </Link>
        <Link className="tile" href={`/charges?month=${month}`}>
          <div className="label">Rent due in {monthName(month)}</div>
          <div className="value">{formatMoney(t.rent_due_cents)}</div>
          <div className="label">{formatMoney(t.rent_unpaid_cents)} not paid yet</div>
        </Link>
        <Link className="tile" href="/reports/overdue">
          <div className="label">Overdue</div>
          <div className="value">{formatMoney(t.overdue_cents)}</div>
        </Link>
        <Link className="tile" href="/leases">
          <div className="label">Deposits held</div>
          <div className="value">{formatMoney(t.deposits_held_cents)}</div>
        </Link>
      </div>
      <DashboardGenerate month={month} label={monthName(month)} />
    </>
  );
}

// US-01 AC1: a new landlord lands here on a getting-started checklist that
// ticks itself off (OQ-07). Once a lease is active, the dashboard (US-23)
// takes the top of the page and the checklist goes.
export default async function HomePage() {
  const [units, tenants, leases, active] = await Promise.all([
    count("units", (q) => q.is("archived_at", null)),
    count("tenants", (q) => q.is("archived_at", null)),
    count("leases"),
    count("leases", (q) => q.eq("status", "active")),
  ]);
  const steps = [
    { done: units > 0, body: <><Link href="/properties">Add your first property</Link> and its units</> },
    { done: tenants > 0, body: <><Link href="/tenants">Add a tenant</Link> with a phone number or email</> },
    { done: leases > 0, body: <><Link href="/leases/new">Create a lease</Link> for a unit and tenant</> },
    { done: active > 0, body: <>Record the deposit (or a waiver) and activate the lease</> },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  if (remaining === 0) return <Dashboard />;

  return (
    <>
      <h1>Getting started</h1>
      <p className="muted">
        {remaining === 0 ? "Setup is done. Your active leases are ready to be charged rent." : `${remaining} of 4 steps to go before your first rent charge.`}
      </p>
      <ol className="steps card" aria-label="Setup steps">
        {steps.map((s, i) => (
          <li key={i} className={s.done ? "done" : undefined}>
            <span className="step-text">
              {s.body}
              {s.done && <span className="sr-only"> (Done)</span>}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
