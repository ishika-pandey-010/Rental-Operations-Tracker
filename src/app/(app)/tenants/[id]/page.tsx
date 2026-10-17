import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArchiveTenantButton, EditTenantForm } from "../forms";

// US-04 Tenants: edit contact details, archive
export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, full_name, email, phone, archived_at")
    .eq("id", id)
    .maybeSingle();
  if (!tenant) notFound();

  return (
    <>
      <p>
        <Link href="/tenants">← Tenants</Link>
      </p>
      <h1>{tenant.full_name}</h1>
      {tenant.archived_at && <p className="alert warn">This tenant is archived.</p>}
      <EditTenantForm tenant={tenant} />
      {!tenant.archived_at && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Archive</h2>
          <p className="muted">Archived tenants are hidden from lists and from new leases. Their leases and payments stay.</p>
          <ArchiveTenantButton tenant={tenant} />
        </section>
      )}
    </>
  );
}
