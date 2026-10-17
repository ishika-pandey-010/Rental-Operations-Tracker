import Link from "next/link";

export const metadata = { title: "Home" };

// US-01 AC1: a new landlord lands here. Until the dashboard (US-23) exists,
// the home page is a getting-started checklist (OQ-07).
export default function HomePage() {
  return (
    <>
      <h1>Getting started</h1>
      <p className="muted">Four steps to your first rent charge.</p>
      <ol className="steps card">
        <li>
          <span className="step-text">
            <Link href="/properties">Add your first property</Link> and its units
          </span>
        </li>
        <li>
          <span className="step-text">
            <Link href="/tenants">Add a tenant</Link> with a phone number or email
          </span>
        </li>
        <li>
          <span className="step-text">
            <Link href="/leases">Create a lease</Link> for a unit and tenant
          </span>
        </li>
        <li>
          <span className="step-text">Record the deposit (or a waiver) and activate the lease</span>
        </li>
      </ol>
    </>
  );
}
