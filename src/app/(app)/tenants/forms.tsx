"use client";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { addTenant, archiveTenant, updateTenant } from "./actions";

type Tenant = { id: string; full_name: string; email: string | null; phone: string | null };

const CONTACT_ERROR = "Add a phone number or email";

function TenantFields({ values, focus }: { values: Partial<Record<string, string>>; focus?: "full_name" | "email" }) {
  return (
    <div className="row">
      <div className="field">
        <label htmlFor="t-name">Full name</label>
        <input id="t-name" name="full_name" required autoFocus={focus === "full_name"} defaultValue={values.full_name} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="t-email">Email</label>
        <input id="t-email" name="email" type="email" autoFocus={focus === "email"} defaultValue={values.email ?? ""} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="t-phone">Phone</label>
        <input id="t-phone" name="phone" type="tel" defaultValue={values.phone ?? ""} autoComplete="off" />
      </div>
    </div>
  );
}

export function AddTenantForm({ focus }: { focus: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(addTenant, {});
  return (
    <form action={action} className="card" key={state.seq}>
      <h2 style={{ marginTop: 0 }}>Add a tenant</h2>
      <p className="hint">A name, plus a phone number or an email so you can reach them about a balance.</p>
      <FormMessage state={state} />
      <TenantFields
        values={state.values ?? {}}
        focus={state.error === CONTACT_ERROR ? "email" : focus || state.seq ? "full_name" : undefined}
      />
      <SubmitButton pending="Adding…">Add tenant</SubmitButton>
    </form>
  );
}

export function EditTenantForm({ tenant }: { tenant: Tenant }) {
  const [state, action] = useActionState<FormState, FormData>(updateTenant, {});
  const values = state.values ?? { full_name: tenant.full_name, email: tenant.email ?? "", phone: tenant.phone ?? "" };
  return (
    <form action={action} className="card" key={state.seq}>
      <FormMessage state={state} />
      <input type="hidden" name="id" value={tenant.id} />
      <TenantFields values={values} focus={state.error === CONTACT_ERROR ? "email" : undefined} />
      <SubmitButton>Save tenant</SubmitButton>
    </form>
  );
}

export function ArchiveTenantButton({ tenant }: { tenant: Tenant }) {
  const [state, action] = useActionState<FormState, FormData>(archiveTenant, {});
  return (
    <form action={action}>
      <FormMessage state={state} />
      <input type="hidden" name="id" value={tenant.id} />
      <input type="hidden" name="full_name" value={tenant.full_name} />
      <SubmitButton className="danger" pending="Archiving…">
        Archive tenant
      </SubmitButton>
    </form>
  );
}
