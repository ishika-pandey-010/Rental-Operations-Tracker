import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Flash } from "@/components/form";
import { AddTenantForm } from "./forms";

export const metadata = { title: "Tenants" };

// US-04 Tenants
export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("id, full_name, email, phone")
    .is("archived_at", null)
    .order("full_name");
  const tenants = data ?? [];

  return (
    <>
      <h1>Tenants</h1>
      <Flash message={done} />
      <AddTenantForm focus={tenants.length === 0} />
      {tenants.length === 0 ? (
        <p className="empty">No tenants yet. Add one above; you&apos;ll pick them when you create a lease.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Phone</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/tenants/${t.id}`}>{t.full_name}</Link>
                  </td>
                  <td>{t.email ? <a href={`mailto:${t.email}`}>{t.email}</a> : <span className="muted">—</span>}</td>
                  <td>{t.phone ? <a href={`tel:${t.phone}`}>{t.phone}</a> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
