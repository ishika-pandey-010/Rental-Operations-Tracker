import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Flash } from "@/components/form";
import { AddUnitForm, ArchivePropertyButton, ArchiveUnitButton, PropertyDetailsForm } from "../forms";

type Unit = { id: string; label: string; archived_at: string | null };

// US-03 Properties and units: one property, its units, archive rules (FR-03)
export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, name, address, archived_at, units(id, label, archived_at)")
    .eq("id", id)
    .maybeSingle();
  if (!property) notFound();

  const units = (property.units as Unit[]).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const active = units.filter((u) => !u.archived_at);
  const archived = units.filter((u) => u.archived_at);

  return (
    <>
      <p>
        <Link href="/properties">← Properties</Link>
      </p>
      <h1>{property.name}</h1>
      <Flash message={done} />
      {property.archived_at && <p className="alert warn">This property is archived.</p>}
      <PropertyDetailsForm id={property.id} name={property.name} address={property.address} />

      <section className="card" aria-labelledby="units-h">
        <h2 id="units-h" style={{ marginTop: 0 }}>
          Units
        </h2>
        {active.length === 0 ? (
          <p className="muted">No active units. Add one below.</p>
        ) : (
          <ul aria-label="Active units" style={{ listStyle: "none", padding: 0 }}>
            {active.map((u) => (
              <li key={u.id} style={{ display: "flex", gap: "1rem", alignItems: "center", padding: "0.35rem 0", borderBottom: "1px solid var(--border)" }}>
                <strong style={{ flex: 1 }}>{u.label}</strong>
                <ArchiveUnitButton id={u.id} propertyId={property.id} label={u.label} />
              </li>
            ))}
          </ul>
        )}
        <AddUnitForm propertyId={property.id} />
        {archived.length > 0 && (
          <>
            <h3>Archived units</h3>
            <ul aria-label="Archived units" className="muted">
              {archived.map((u) => (
                <li key={u.id}>{u.label}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      {!property.archived_at && (
        <section className="card" aria-labelledby="archive-h">
          <h2 id="archive-h" style={{ marginTop: 0 }}>
            Archive
          </h2>
          <p className="muted">Archived properties are hidden from lists and from new leases. Their history stays.</p>
          <ArchivePropertyButton id={property.id} name={property.name} />
        </section>
      )}
    </>
  );
}
