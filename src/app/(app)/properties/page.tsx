import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Flash } from "@/components/form";
import { AddPropertyForm } from "./forms";

export const metadata = { title: "Properties" };

type Unit = { id: string; label: string; archived_at: string | null };
type Property = { id: string; name: string; address: string | null; units: Unit[] };

// US-03 Properties and units
export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("id, name, address, units(id, label, archived_at)")
    .is("archived_at", null)
    .order("name");
  const properties = (data ?? []) as Property[];

  return (
    <>
      <h1>Properties</h1>
      <Flash message={done} />
      <AddPropertyForm focus={properties.length === 0} />
      {properties.length === 0 ? (
        <p className="empty">No properties yet. Add the first one above, with its units, in one go.</p>
      ) : (
        <div className="grid">
          {properties.map((p) => {
            const units = p.units.filter((u) => !u.archived_at).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
            return (
              <article key={p.id} className="card" aria-labelledby={`prop-${p.id}`}>
                <h2 id={`prop-${p.id}`} style={{ marginTop: 0 }}>
                  <Link href={`/properties/${p.id}`}>{p.name}</Link>
                </h2>
                {p.address && <p className="muted">{p.address}</p>}
                {units.length === 0 ? (
                  <p className="muted">No units yet</p>
                ) : (
                  <ul aria-label="Units" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", listStyle: "none", padding: 0 }}>
                    {units.map((u) => (
                      <li key={u.id} className="badge draft">
                        {u.label}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
