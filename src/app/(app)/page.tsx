import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Home" };

async function count(table: string, filter?: (q: any) => any) {
  const supabase = await createClient();
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n } = await q;
  return n ?? 0;
}

// US-01 AC1: a new landlord lands here. Until the dashboard (US-23) exists,
// the home page is a getting-started checklist that ticks itself off (OQ-07).
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
